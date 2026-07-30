import fs from "node:fs/promises";
import path from "node:path";
import { randomId } from "./crypto";
import { CASHBACK_RATE, PARTNERS } from "./catalog";
import type {
  Application,
  ApplicationStatus,
  NotificationLog,
  PartnerInquiry,
  PartnerSummary,
  Settings,
  StatusEvent,
} from "./types";

/**
 * 데이터 스토어
 *
 * 기획서 6장의 DB 구성(Vercel Postgres / Supabase)으로 교체할 수 있도록
 * 모든 접근을 이 모듈의 함수로 한정한다. 현재 구현은 로컬 JSON 파일 기반이며,
 * 스키마는 db/schema.sql 과 1:1 대응한다.
 *
 * 주의: 파일 스토어는 단일 프로세스 전제다. 서버리스(다중 인스턴스) 배포 전에
 *      반드시 Postgres 어댑터로 교체할 것. (README 참고)
 */

interface Database {
  version: number;
  settings: Settings;
  applications: Application[];
  inquiries: PartnerInquiry[];
  notifications: NotificationLog[];
}

const DATA_DIR = path.resolve(
  process.cwd(),
  process.env.NP_DATA_DIR || ".data"
);
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

// 개발 서버 HMR 로 모듈이 재평가돼도 상태가 유지되도록 globalThis 에 보관한다.
const globalRef = globalThis as unknown as {
  __npStore?: { db: Database | null; lock: Promise<unknown> };
};
const state = (globalRef.__npStore ??= { db: null, lock: Promise.resolve() });

async function load(): Promise<Database> {
  if (state.db) return state.db;
  try {
    const raw = await fs.readFile(DATA_FILE, "utf8");
    const parsed = JSON.parse(raw) as Database;
    state.db = { ...initialDatabase(), ...parsed };
  } catch {
    state.db = initialDatabase();
  }
  return state.db;
}

async function persist(db: Database): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const tmp = `${DATA_FILE}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(db, null, 2), "utf8");
  await fs.rename(tmp, DATA_FILE); // 원자적 교체 — 쓰기 중 크래시 시 원본 보존
}

/**
 * 읽기-수정-쓰기를 직렬화한다.
 * 순번 발급·대기열 소진이 동시에 일어나도 순번 중복이 발생하지 않도록 보장.
 */
async function transaction<T>(fn: (db: Database) => T | Promise<T>): Promise<T> {
  const run = state.lock.then(async () => {
    const db = await load();
    const result = await fn(db);
    await persist(db);
    return result;
  });
  // 실패해도 이후 트랜잭션이 막히지 않도록 체인은 항상 resolve 시킨다.
  state.lock = run.catch(() => undefined);
  return run;
}

async function read<T>(fn: (db: Database) => T | Promise<T>): Promise<T> {
  await state.lock.catch(() => undefined);
  return fn(await load());
}

/* ────────────────────────────── 접수 ────────────────────────────── */

export interface NewApplicationInput {
  partnerCode: string;
  partnerName: string;
  productId: string;
  productName: string;
  designerPremium: number;
  groupPremium: number;
  nameEnc: string;
  phoneEnc: string;
  birthEnc: string;
  phoneHash: string;
  gender: "M" | "F" | "";
  notifyOptIn: boolean;
  marketingOptIn: boolean;
}

function buildTicket(queueNumber: number, at: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const date = `${at.getFullYear()}${pad(at.getMonth() + 1)}${pad(at.getDate())}`;
  return `NP-${date}-${String(queueNumber).padStart(4, "0")}`;
}

export async function createApplication(
  input: NewApplicationInput
): Promise<Application> {
  return transaction((db) => {
    if (db.settings.intakePaused) {
      throw new IntakePausedError();
    }
    const now = new Date();
    const nowIso = now.toISOString();

    // 대기열 소진을 먼저 반영한 뒤 순번을 발급해야 "내 앞 대기 인원"이 정확하다.
    applyQueueDrain(db, now);

    const queueNumber = db.settings.lastQueueNumber + 1;
    db.settings.lastQueueNumber = queueNumber;

    const aheadAtEntry = db.applications.filter((a) => a.status === "queued").length;

    const application: Application = {
      id: randomId(),
      ticket: buildTicket(queueNumber, now),
      queueNumber,
      aheadAtEntry,
      partnerCode: input.partnerCode,
      partnerName: input.partnerName,
      productId: input.productId,
      productName: input.productName,
      designerPremium: input.designerPremium,
      groupPremium: input.groupPremium,
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
}

export class IntakePausedError extends Error {
  constructor() {
    super("현재 신규 접수가 일시 중지되었습니다.");
    this.name = "IntakePausedError";
  }
}

export async function getByTicket(ticket: string): Promise<Application | null> {
  const normalized = ticket.trim().toUpperCase();
  return read((db) => db.applications.find((a) => a.ticket === normalized) ?? null);
}

export async function getById(id: string): Promise<Application | null> {
  return read((db) => db.applications.find((a) => a.id === id) ?? null);
}

/** 접수번호 + 휴대폰 해시가 모두 일치할 때만 반환 (조회 페이지) */
export async function findForLookup(
  ticket: string,
  phoneHash: string
): Promise<Application | null> {
  const app = await getByTicket(ticket);
  if (!app || app.phoneHash !== phoneHash) return null;
  return app;
}

/** 동일 휴대폰 + 동일 상품의 진행 중 접수가 있는지 확인 (중복 접수 방지) */
export async function findActiveDuplicate(
  phoneHash: string,
  productId: string
): Promise<Application | null> {
  return read(
    (db) =>
      db.applications.find(
        (a) =>
          a.phoneHash === phoneHash &&
          a.productId === productId &&
          a.status !== "cancelled" &&
          a.status !== "completed"
      ) ?? null
  );
}

export interface ListFilter {
  status?: ApplicationStatus | "all";
  partnerCode?: string;
  query?: string;
  limit?: number;
}

export async function listApplications(
  filter: ListFilter = {}
): Promise<Application[]> {
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
}

export async function updateStatus(
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
}

export async function setAdminNote(
  id: string,
  note: string
): Promise<Application | null> {
  return transaction((db) => {
    const app = db.applications.find((a) => a.id === id);
    if (!app) return null;
    app.adminNote = note;
    app.updatedAt = new Date().toISOString();
    return app;
  });
}

/** 대기 중 신청자가 뒤늦게 알림 수신을 신청하는 경우 (기획서 4.3 자리 비움 허용) */
export async function setNotifyOptIn(
  ticket: string,
  optIn: boolean
): Promise<Application | null> {
  const normalized = ticket.trim().toUpperCase();
  return transaction((db) => {
    const app = db.applications.find((a) => a.ticket === normalized);
    if (!app) return null;
    app.notifyOptIn = optIn;
    app.updatedAt = new Date().toISOString();
    return app;
  });
}

/* ────────────────────────────── 대기열 ────────────────────────────── */

/**
 * 경과 시간과 분당 처리량에 따라 대기열을 소진시킨다. (소프트 대기열)
 * transaction 내부에서만 호출할 것.
 * @returns 이번 호출로 접수 확정된 건 목록
 */
function applyQueueDrain(db: Database, now: Date): Application[] {
  const queued = db.applications
    .filter((a) => a.status === "queued")
    .sort((a, b) => a.queueNumber - b.queueNumber);

  if (queued.length === 0) {
    // 대기 인원이 없으면 다음 폭주에 대비해 기준 시각을 현재로 리셋한다.
    db.settings.lastAdvanceAt = now.toISOString();
    return [];
  }

  const rate = Math.max(1, db.settings.throughputPerMinute);
  const last = new Date(db.settings.lastAdvanceAt).getTime();
  const elapsedMs = now.getTime() - (Number.isNaN(last) ? now.getTime() : last);
  if (elapsedMs <= 0) return [];

  const msPerItem = 60_000 / rate;
  const capacity = Math.floor(elapsedMs / msPerItem);
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

export interface QueueSnapshot {
  ticket: string;
  queueNumber: number;
  status: ApplicationStatus;
  /** 내 앞 대기 인원 */
  ahead: number;
  aheadAtEntry: number;
  /** 진행률 0~100 */
  progress: number;
  /** 예상 대기시간(분) */
  estimatedMinutes: number;
  throughputPerMinute: number;
  totalWaiting: number;
  notifyOptIn: boolean;
  partnerName: string;
  productName: string;
}

/**
 * 대기열을 소진시킨 뒤 해당 접수 건의 현재 대기 상태를 반환한다.
 * @returns snapshot 과 이번 호출로 접수 확정된 건(알림 발송 대상)
 */
export async function pollQueue(
  ticket: string
): Promise<{ snapshot: QueueSnapshot | null; served: Application[] }> {
  const normalized = ticket.trim().toUpperCase();
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
    const progress =
      app.status === "queued"
        ? Math.min(100, Math.max(0, Math.round(((base - ahead) / base) * 100)))
        : 100;

    return {
      snapshot: {
        ticket: app.ticket,
        queueNumber: app.queueNumber,
        status: app.status,
        ahead,
        aheadAtEntry: app.aheadAtEntry,
        progress,
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
}

/** 관리자 수동 처리 — 대기열 앞에서 count 건을 즉시 접수 확정 */
export async function serveNext(count: number): Promise<Application[]> {
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
}

/* ────────────────────────────── 설정 ────────────────────────────── */

export async function getSettings(): Promise<Settings> {
  return read((db) => ({ ...db.settings }));
}

export async function updateSettings(
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
}

/* ────────────────────────── 협약 문의 (B2B) ────────────────────────── */

export async function createInquiry(
  input: Omit<PartnerInquiry, "id" | "createdAt" | "handled">
): Promise<PartnerInquiry> {
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
}

export async function listInquiries(): Promise<PartnerInquiry[]> {
  return read((db) =>
    [...db.inquiries].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  );
}

export async function markInquiryHandled(
  id: string,
  handled: boolean
): Promise<PartnerInquiry | null> {
  return transaction((db) => {
    const inquiry = db.inquiries.find((i) => i.id === id);
    if (!inquiry) return null;
    inquiry.handled = handled;
    return inquiry;
  });
}

/* ────────────────────────────── 알림 로그 ────────────────────────────── */

export async function logNotification(
  entry: Omit<NotificationLog, "id" | "createdAt">
): Promise<void> {
  await transaction((db) => {
    db.notifications.push({
      ...entry,
      id: randomId(),
      createdAt: new Date().toISOString(),
    });
    // 로그가 무한히 쌓이지 않도록 최근 500건만 보관한다.
    if (db.notifications.length > 500) {
      db.notifications = db.notifications.slice(-500);
    }
  });
}

export async function listNotifications(limit = 50): Promise<NotificationLog[]> {
  return read((db) => [...db.notifications].reverse().slice(0, limit));
}

/* ────────────────────────────── 집계 ────────────────────────────── */

export async function getPublicStats() {
  return read((db) => {
    const applications = db.applications.filter((a) => a.status !== "cancelled");
    const completed = applications.filter((a) => a.status === "completed");
    const totalSaving = applications.reduce(
      (sum, a) => sum + (a.designerPremium - a.groupPremium) * 12,
      0
    );
    return {
      partnerCount: PARTNERS.filter((p) => p.active).length,
      applicationCount: applications.length,
      completedCount: completed.length,
      totalSaving,
    };
  });
}

/** 협약단체별 실적·캐시백 집계 (기획서 4.4) */
export async function getPartnerSummaries(): Promise<PartnerSummary[]> {
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
      // 캐시백은 청약 완료(성사) 건만 정산 대상 — 기획서 9장 정산 기준
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
}
