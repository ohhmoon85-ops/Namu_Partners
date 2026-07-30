import fs from "node:fs/promises";
import path from "node:path";
import { randomId } from "@/lib/crypto";
import { CASHBACK_RATE, PARTNERS, PRODUCTS, savingRate } from "@/lib/catalog";
import type {
  Application,
  ApplicationStatus,
  NotificationLog,
  Partner,
  PartnerInquiry,
  PartnerSummary,
  Product,
  Settings,
  StatusEvent,
} from "@/lib/types";
import {
  DuplicateApplicationError,
  IntakePausedError,
  InvalidCatalogError,
  type ListFilter,
  type NewApplicationInput,
  type QueuePollResult,
  type StoreApi,
} from "./contract";

/**
 * 로컬 JSON 파일 저장소 — DATABASE_URL 이 없을 때 사용한다.
 *
 * 개발·데모 전용이다. 단일 프로세스를 전제로 하므로 서버리스 다중 인스턴스
 * 환경에서는 절대 사용하지 말 것. 운영은 pg-store(Supabase)를 쓴다.
 * 카탈로그(협약단체·상품)는 src/lib/catalog.ts 의 시드 상수를 그대로 쓴다.
 */

interface Database {
  version: number;
  settings: Settings;
  applications: Application[];
  inquiries: PartnerInquiry[];
  notifications: NotificationLog[];
}

const DATA_DIR = path.resolve(process.cwd(), process.env.NP_DATA_DIR || ".data");
const DATA_FILE = path.join(DATA_DIR, "store.json");

function initialDatabase(): Database {
  return {
    version: 1,
    settings: {
      throughputPerMinute: 12,
      lastAdvanceAt: new Date().toISOString(),
      lastQueueNumber: 0,
      intakePaused: false,
    },
    applications: [],
    inquiries: [],
    notifications: [],
  };
}

const globalRef = globalThis as unknown as {
  __npStore?: { db: Database | null; lock: Promise<unknown> };
};
const state = (globalRef.__npStore ??= { db: null, lock: Promise.resolve() });

async function load(): Promise<Database> {
  if (state.db) return state.db;
  try {
    const raw = await fs.readFile(DATA_FILE, "utf8");
    state.db = { ...initialDatabase(), ...(JSON.parse(raw) as Database) };
  } catch {
    state.db = initialDatabase();
  }
  return state.db;
}

async function persist(db: Database): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const tmp = `${DATA_FILE}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(db, null, 2), "utf8");
  await fs.rename(tmp, DATA_FILE); // 원자적 교체
}

/** 읽기-수정-쓰기를 직렬화해 순번 중복을 막는다. */
async function transaction<T>(fn: (db: Database) => T | Promise<T>): Promise<T> {
  const run = state.lock.then(async () => {
    const db = await load();
    const result = await fn(db);
    await persist(db);
    return result;
  });
  state.lock = run.catch(() => undefined);
  return run;
}

async function read<T>(fn: (db: Database) => T | Promise<T>): Promise<T> {
  await state.lock.catch(() => undefined);
  return fn(await load());
}

function buildTicket(queueNumber: number, at: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const date = `${at.getFullYear()}${pad(at.getMonth() + 1)}${pad(at.getDate())}`;
  return `NP-${date}-${String(queueNumber).padStart(4, "0")}`;
}

/**
 * 경과 시간과 분당 처리량만큼 대기열을 소진시킨다.
 * transaction 내부에서만 호출할 것.
 */
function applyQueueDrain(db: Database, now: Date): Application[] {
  const queued = db.applications
    .filter((a) => a.status === "queued")
    .sort((a, b) => a.queueNumber - b.queueNumber);

  if (queued.length === 0) {
    db.settings.lastAdvanceAt = now.toISOString();
    return [];
  }

  const rate = Math.max(1, db.settings.throughputPerMinute);
  const last = new Date(db.settings.lastAdvanceAt).getTime();
  const elapsedMs = now.getTime() - (Number.isNaN(last) ? now.getTime() : last);
  if (elapsedMs <= 0) return [];

  const msPerItem = 60_000 / rate;
  const capacity = Math.min(Math.floor(elapsedMs / msPerItem), queued.length);
  if (capacity <= 0) return [];

  const serving = queued.slice(0, capacity);
  const at = now.toISOString();
  for (const app of serving) {
    app.status = "received";
    app.updatedAt = at;
    app.history.push({ status: "received", at });
  }

  // 처리한 건수만큼만 기준 시각을 전진시켜 소수점 잔여 시간을 보존한다.
  db.settings.lastAdvanceAt = new Date(last + serving.length * msPerItem).toISOString();
  return serving;
}

export const jsonStore: StoreApi = {
  /* ─────────────────────── 카탈로그 ─────────────────────── */

  async listPartners(): Promise<Partner[]> {
    return PARTNERS.filter((p) => p.active);
  },

  async getPartner(code: string): Promise<Partner | null> {
    const normalized = (code ?? "").trim().toUpperCase();
    return PARTNERS.find((p) => p.code === normalized && p.active) ?? null;
  },

  async listProducts(): Promise<Product[]> {
    return PRODUCTS;
  },

  async getProduct(id: string): Promise<Product | null> {
    return PRODUCTS.find((p) => p.id === id) ?? null;
  },

  /* ─────────────────────── 접수 ─────────────────────── */

  async createApplication(input: NewApplicationInput): Promise<Application> {
    const partner = await this.getPartner(input.partnerCode);
    if (!partner) throw new InvalidCatalogError("유효하지 않은 협약단체입니다.");

    const product = await this.getProduct(input.productId);
    if (!product) throw new InvalidCatalogError("유효하지 않은 상품입니다.");

    return transaction((db) => {
      if (db.settings.intakePaused) throw new IntakePausedError();

      const duplicate = db.applications.find(
        (a) =>
          a.phoneHash === input.phoneHash &&
          a.productId === product.id &&
          a.status !== "cancelled" &&
          a.status !== "completed"
      );
      if (duplicate) throw new DuplicateApplicationError(duplicate.ticket);

      const now = new Date();
      const nowIso = now.toISOString();

      // 순번을 발급하기 전에 대기열을 먼저 소진시켜야 "앞 대기 인원"이 정확하다.
      applyQueueDrain(db, now);

      const queueNumber = db.settings.lastQueueNumber + 1;
      db.settings.lastQueueNumber = queueNumber;

      const aheadAtEntry = db.applications.filter((a) => a.status === "queued").length;

      const application: Application = {
        id: randomId(),
        ticket: buildTicket(queueNumber, now),
        queueNumber,
        aheadAtEntry,
        partnerCode: partner.code,
        partnerName: partner.name,
        productId: product.id,
        productName: product.name,
        designerPremium: product.designerPremium,
        groupPremium: product.groupPremium,
        nameEnc: input.nameEnc,
        phoneEnc: input.phoneEnc,
        birthEnc: input.birthEnc,
        phoneHash: input.phoneHash,
        gender: input.gender,
        notifyOptIn: input.notifyOptIn,
        marketingOptIn: input.marketingOptIn,
        agreedAt: nowIso,
        status: "queued",
        history: [{ status: "queued", at: nowIso }],
        adminNote: "",
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      db.applications.push(application);
      return application;
    });
  },

  async getByTicket(ticket: string): Promise<Application | null> {
    const normalized = (ticket ?? "").trim().toUpperCase();
    return read((db) => db.applications.find((a) => a.ticket === normalized) ?? null);
  },

  async getById(id: string): Promise<Application | null> {
    return read((db) => db.applications.find((a) => a.id === id) ?? null);
  },

  async findForLookup(ticket: string, phoneHash: string): Promise<Application | null> {
    const app = await this.getByTicket(ticket);
    if (!app || app.phoneHash !== phoneHash) return null;
    return app;
  },

  async listApplications(filter: ListFilter = {}): Promise<Application[]> {
    return read((db) => {
      let rows = [...db.applications].sort((a, b) => b.queueNumber - a.queueNumber);
      if (filter.status && filter.status !== "all") {
        rows = rows.filter((a) => a.status === filter.status);
      }
      if (filter.partnerCode && filter.partnerCode !== "all") {
        rows = rows.filter((a) => a.partnerCode === filter.partnerCode);
      }
      if (filter.query) {
        const q = filter.query.trim().toUpperCase();
        rows = rows.filter(
          (a) => a.ticket.includes(q) || a.partnerName.toUpperCase().includes(q)
        );
      }
      return filter.limit ? rows.slice(0, filter.limit) : rows;
    });
  },

  async updateStatus(
    id: string,
    status: ApplicationStatus,
    note?: string
  ): Promise<Application | null> {
    return transaction((db) => {
      const app = db.applications.find((a) => a.id === id);
      if (!app) return null;
      const at = new Date().toISOString();
      app.status = status;
      app.updatedAt = at;
      const event: StatusEvent = { status, at };
      if (note) event.note = note;
      app.history.push(event);
      return app;
    });
  },

  async setAdminNote(id: string, note: string): Promise<Application | null> {
    return transaction((db) => {
      const app = db.applications.find((a) => a.id === id);
      if (!app) return null;
      app.adminNote = note;
      app.updatedAt = new Date().toISOString();
      return app;
    });
  },

  async setNotifyOptIn(ticket: string, optIn: boolean): Promise<Application | null> {
    const normalized = (ticket ?? "").trim().toUpperCase();
    return transaction((db) => {
      const app = db.applications.find((a) => a.ticket === normalized);
      if (!app) return null;
      app.notifyOptIn = optIn;
      app.updatedAt = new Date().toISOString();
      return app;
    });
  },

  /* ─────────────────────── 대기열 ─────────────────────── */

  async pollQueue(ticket: string): Promise<QueuePollResult> {
    const normalized = (ticket ?? "").trim().toUpperCase();
    return transaction((db) => {
      const served = applyQueueDrain(db, new Date());
      const app = db.applications.find((a) => a.ticket === normalized);
      if (!app) return { snapshot: null, served };

      const queued = db.applications.filter((a) => a.status === "queued");
      const ahead =
        app.status === "queued"
          ? queued.filter((a) => a.queueNumber < app.queueNumber).length
          : 0;

      const rate = Math.max(1, db.settings.throughputPerMinute);
      const base = Math.max(app.aheadAtEntry, 1);

      return {
        snapshot: {
          ticket: app.ticket,
          queueNumber: app.queueNumber,
          status: app.status,
          ahead,
          aheadAtEntry: app.aheadAtEntry,
          progress:
            app.status === "queued"
              ? Math.min(100, Math.max(0, Math.round(((base - ahead) / base) * 100)))
              : 100,
          estimatedMinutes: ahead === 0 ? 0 : ahead / rate,
          throughputPerMinute: rate,
          totalWaiting: queued.length,
          notifyOptIn: app.notifyOptIn,
          partnerName: app.partnerName,
          productName: app.productName,
        },
        served,
      };
    });
  },

  async serveNext(count: number): Promise<Application[]> {
    return transaction((db) => {
      const queued = db.applications
        .filter((a) => a.status === "queued")
        .sort((a, b) => a.queueNumber - b.queueNumber)
        .slice(0, Math.max(0, count));
      const at = new Date().toISOString();
      for (const app of queued) {
        app.status = "received";
        app.updatedAt = at;
        app.history.push({ status: "received", at, note: "관리자 수동 처리" });
      }
      return queued;
    });
  },

  /* ─────────────────────── 설정 ─────────────────────── */

  async getSettings(): Promise<Settings> {
    return read((db) => ({ ...db.settings }));
  },

  async updateSettings(
    patch: Partial<Pick<Settings, "throughputPerMinute" | "intakePaused">>
  ): Promise<Settings> {
    return transaction((db) => {
      if (typeof patch.throughputPerMinute === "number") {
        db.settings.throughputPerMinute = Math.min(
          600,
          Math.max(1, Math.round(patch.throughputPerMinute))
        );
      }
      if (typeof patch.intakePaused === "boolean") {
        db.settings.intakePaused = patch.intakePaused;
      }
      return { ...db.settings };
    });
  },

  /* ─────────────────────── 협약 문의 ─────────────────────── */

  async createInquiry(input): Promise<PartnerInquiry> {
    return transaction((db) => {
      const inquiry: PartnerInquiry = {
        ...input,
        id: randomId(),
        handled: false,
        createdAt: new Date().toISOString(),
      };
      db.inquiries.push(inquiry);
      return inquiry;
    });
  },

  async listInquiries(): Promise<PartnerInquiry[]> {
    return read((db) =>
      [...db.inquiries].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    );
  },

  async markInquiryHandled(id: string, handled: boolean): Promise<PartnerInquiry | null> {
    return transaction((db) => {
      const inquiry = db.inquiries.find((i) => i.id === id);
      if (!inquiry) return null;
      inquiry.handled = handled;
      return inquiry;
    });
  },

  /* ─────────────────────── 알림 ─────────────────────── */

  async logNotification(entry): Promise<void> {
    await transaction((db) => {
      db.notifications.push({
        ...entry,
        id: randomId(),
        createdAt: new Date().toISOString(),
      });
      if (db.notifications.length > 500) {
        db.notifications = db.notifications.slice(-500);
      }
    });
  },

  async listNotifications(limit = 50): Promise<NotificationLog[]> {
    return read((db) => [...db.notifications].reverse().slice(0, limit));
  },

  /* ─────────────────────── 집계 ─────────────────────── */

  async getPublicStats() {
    return read((db) => {
      const applications = db.applications.filter((a) => a.status !== "cancelled");
      const totalSaving = applications.reduce(
        (sum, a) => sum + (a.designerPremium - a.groupPremium) * 12,
        0
      );
      const avgRate =
        PRODUCTS.reduce((acc, p) => acc + savingRate(p), 0) / (PRODUCTS.length || 1);

      return {
        partnerCount: PARTNERS.filter((p) => p.active).length,
        applicationCount: applications.length,
        completedCount: applications.filter((a) => a.status === "completed").length,
        totalSaving,
        averageSavingRate: avgRate,
      };
    });
  },

  async getPartnerSummaries(): Promise<PartnerSummary[]> {
    return read((db) => {
      const byCode = new Map<string, PartnerSummary>();
      for (const partner of PARTNERS) {
        byCode.set(partner.code, {
          code: partner.code,
          name: partner.name,
          applicationCount: 0,
          completedCount: 0,
          annualizedPremium: 0,
          cashback: 0,
        });
      }

      for (const app of db.applications) {
        if (app.status === "cancelled") continue;
        let row = byCode.get(app.partnerCode);
        if (!row) {
          // 협약 해지 등으로 카탈로그에서 사라진 단체의 과거 실적도 누락 없이 표시한다.
          row = {
            code: app.partnerCode,
            name: app.partnerName,
            applicationCount: 0,
            completedCount: 0,
            annualizedPremium: 0,
            cashback: 0,
          };
          byCode.set(app.partnerCode, row);
        }
        row.applicationCount += 1;
        // 캐시백은 청약 완료(성사) 건만 정산 대상 — 기획서 9장
        if (app.status === "completed") {
          row.completedCount += 1;
          row.annualizedPremium += app.groupPremium * 12;
        }
      }

      for (const row of byCode.values()) {
        row.cashback = Math.round(row.annualizedPremium * CASHBACK_RATE);
      }

      return [...byCode.values()].sort(
        (a, b) => b.applicationCount - a.applicationCount
      );
    });
  },
};
