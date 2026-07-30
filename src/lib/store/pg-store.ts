import { PG_ERROR, pgErrorCode, query, queryOne } from "@/lib/db";
import type {
  Application,
  ApplicationStatus,
  InsuranceCategory,
  NotificationLog,
  Partner,
  PartnerInquiry,
  PartnerSummary,
  PublicStats,
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
  type QueueSnapshot,
  type StoreApi,
} from "./contract";

/**
 * Supabase(Postgres) 저장소 — `namu` 스키마
 *
 * 순번 발급·대기열 소진·중복 차단은 DB 함수가 원자적으로 처리한다.
 * (db/supabase/001_init_namu.sql, 002_market_products.sql 참고)
 */

/* ─────────────────────── 행 → 도메인 매핑 ─────────────────────── */

type Row = Record<string, unknown>;

function iso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? value : d.toISOString();
  }
  return new Date(0).toISOString();
}

function num(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function mapHistory(value: unknown): StatusEvent[] {
  if (!Array.isArray(value)) return [];
  return value.map((e) => {
    const event = e as { status: ApplicationStatus; at: unknown; note: unknown };
    const mapped: StatusEvent = { status: event.status, at: iso(event.at) };
    if (event.note) mapped.note = String(event.note);
    return mapped;
  });
}

function mapApplication(row: Row): Application {
  return {
    id: String(row.id),
    ticket: String(row.ticket),
    queueNumber: Number(row.queue_number),
    aheadAtEntry: Number(row.ahead_at_entry),
    partnerCode: String(row.partner_code),
    partnerName: String(row.partner_name),
    categoryCode: String(row.category_code ?? ""),
    categoryName: String(row.category_name ?? ""),
    insurer: String(row.insurer ?? ""),
    productName: String(row.product_name ?? ""),
    quotedPremium: num(row.quoted_premium),
    estimatedPremium: num(row.estimated_premium),
    finalPremium: num(row.final_premium),
    nameEnc: String(row.name_enc),
    phoneEnc: String(row.phone_enc),
    birthEnc: String(row.birth_enc),
    phoneHash: String(row.phone_hash),
    gender: (row.gender as "M" | "F" | "") ?? "",
    memo: String(row.memo ?? ""),
    notifyOptIn: Boolean(row.notify_opt_in),
    marketingOptIn: Boolean(row.marketing_opt_in),
    agreedAt: iso(row.agreed_at),
    status: row.status as ApplicationStatus,
    history: mapHistory(row.history),
    adminNote: String(row.admin_note ?? ""),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

function mapPartner(row: Row): Partner {
  return {
    code: String(row.code),
    name: String(row.name),
    memberCount: Number(row.member_count),
    category: String(row.category ?? ""),
    contractedAt: String(row.contracted_at ?? ""),
    active: Boolean(row.active),
  };
}

function mapCategory(row: Row): InsuranceCategory {
  return {
    code: String(row.code),
    name: String(row.name),
    examples: String(row.examples ?? ""),
    sortOrder: Number(row.sort_order ?? 0),
    active: Boolean(row.active),
  };
}

function mapInquiry(row: Row): PartnerInquiry {
  return {
    id: String(row.id),
    orgName: String(row.org_name),
    contactName: String(row.contact_name),
    position: String(row.position ?? ""),
    phoneEnc: String(row.phone_enc),
    emailEnc: String(row.email_enc),
    memberCount: Number(row.member_count),
    message: String(row.message ?? ""),
    handled: Boolean(row.handled),
    createdAt: iso(row.created_at),
  };
}

function mapSettings(row: Row): Settings {
  return {
    throughputPerMinute: Number(row.throughput_per_minute),
    lastAdvanceAt: iso(row.last_advance_at),
    lastQueueNumber: Number(row.last_queue_number ?? 0),
    intakePaused: Boolean(row.intake_paused),
  };
}

/** 접수 조회 시 진행 이력을 한 번에 가져온다 (N+1 방지) */
const APPLICATION_SELECT = `
  select a.*,
         coalesce((
           select json_agg(
                    json_build_object('status', e.status, 'at', e.created_at, 'note', e.note)
                    order by e.created_at, e.id)
             from namu.application_events e
            where e.application_id = a.id
         ), '[]'::json) as history
    from namu.applications a
`;

const SETTINGS_SELECT = `
  select s.throughput_per_minute,
         s.last_advance_at,
         s.intake_paused,
         coalesce(pg_sequence_last_value('namu.queue_number_seq'::regclass), 0)
           as last_queue_number
    from namu.settings s
   where s.id = true
`;

/* ─────────────────────── 구현 ─────────────────────── */

export const pgStore: StoreApi = {
  /* 카탈로그 --------------------------------------------------------- */

  async listPartners(): Promise<Partner[]> {
    const rows = await query(
      `select code, name, category, member_count, active,
              to_char(contracted_at, 'YYYY-MM-DD') as contracted_at
         from namu.partners
        where active
        order by member_count desc`
    );
    return rows.map(mapPartner);
  },

  async getPartner(code: string): Promise<Partner | null> {
    const row = await queryOne(
      `select code, name, category, member_count, active,
              to_char(contracted_at, 'YYYY-MM-DD') as contracted_at
         from namu.partners
        where code = upper(btrim($1)) and active`,
      [code ?? ""]
    );
    return row ? mapPartner(row) : null;
  },

  async listCategories(): Promise<InsuranceCategory[]> {
    const rows = await query(
      `select * from namu.insurance_categories where active order by sort_order, code`
    );
    return rows.map(mapCategory);
  },

  async getCategory(code: string): Promise<InsuranceCategory | null> {
    const row = await queryOne(
      `select * from namu.insurance_categories where code = $1 and active`,
      [code ?? ""]
    );
    return row ? mapCategory(row) : null;
  },

  /* 접수 ------------------------------------------------------------- */

  async createApplication(input: NewApplicationInput): Promise<Application> {
    let created: Row | null;
    try {
      created = await queryOne(
        `select * from namu.create_application(
           $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
        [
          input.partnerCode,
          input.categoryCode,
          input.insurer,
          input.productName,
          input.quotedPremium,
          input.memo,
          input.nameEnc,
          input.phoneEnc,
          input.birthEnc,
          input.phoneHash,
          input.gender,
          input.notifyOptIn,
          input.marketingOptIn,
        ]
      );
    } catch (error) {
      switch (pgErrorCode(error)) {
        case PG_ERROR.INTAKE_PAUSED:
          throw new IntakePausedError();
        case PG_ERROR.INVALID_PARTNER:
          throw new InvalidCatalogError("유효하지 않은 협약단체입니다.");
        case PG_ERROR.INVALID_CATEGORY:
          throw new InvalidCatalogError("보험 종류를 선택해 주세요.");
        case PG_ERROR.DUPLICATE_APPLICATION: {
          // 안내 문구에 기존 접수번호를 담기 위해 한 번 더 조회한다.
          const existing = await queryOne<{ ticket: string }>(
            `select ticket from namu.applications
              where phone_hash = $1 and category_code = $2
                and status not in ('completed', 'cancelled')
              limit 1`,
            [input.phoneHash, input.categoryCode]
          );
          throw new DuplicateApplicationError(existing?.ticket);
        }
        default:
          throw error;
      }
    }

    if (!created) throw new Error("접수 생성에 실패했습니다.");

    // 진행 이력은 트리거가 기록하므로 커밋된 상태를 다시 읽어 반환한다.
    const full = await this.getById(String(created.id));
    return full ?? mapApplication({ ...created, history: [] });
  },

  async getByTicket(ticket: string): Promise<Application | null> {
    const row = await queryOne(
      `${APPLICATION_SELECT} where a.ticket = upper(btrim($1))`,
      [ticket ?? ""]
    );
    return row ? mapApplication(row) : null;
  },

  async getById(id: string): Promise<Application | null> {
    const row = await queryOne(`${APPLICATION_SELECT} where a.id = $1`, [id]);
    return row ? mapApplication(row) : null;
  },

  async findForLookup(ticket: string, phoneHash: string): Promise<Application | null> {
    const row = await queryOne(
      `${APPLICATION_SELECT}
        where a.ticket = upper(btrim($1)) and a.phone_hash = $2`,
      [ticket ?? "", phoneHash]
    );
    return row ? mapApplication(row) : null;
  },

  async listApplications(filter: ListFilter = {}): Promise<Application[]> {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (filter.status && filter.status !== "all") {
      params.push(filter.status);
      conditions.push(`a.status = $${params.length}::namu.application_status`);
    }
    if (filter.partnerCode && filter.partnerCode !== "all") {
      params.push(filter.partnerCode);
      conditions.push(`a.partner_code = $${params.length}`);
    }
    if (filter.query?.trim()) {
      params.push(`%${filter.query.trim().toUpperCase()}%`);
      const p = `$${params.length}`;
      conditions.push(
        `(a.ticket like ${p} or upper(a.partner_name) like ${p}
          or upper(a.insurer) like ${p} or upper(a.product_name) like ${p})`
      );
    }
    params.push(Math.min(Math.max(filter.limit ?? 200, 1), 1000));

    const where = conditions.length ? `where ${conditions.join(" and ")}` : "";
    const rows = await query(
      `${APPLICATION_SELECT} ${where} order by a.queue_number desc limit $${params.length}`,
      params
    );
    return rows.map(mapApplication);
  },

  async updateStatus(
    id: string,
    status: ApplicationStatus,
    note?: string
  ): Promise<Application | null> {
    try {
      // set_status() 는 이력에 메모까지 남긴다.
      await queryOne(
        `select * from namu.set_status($1, $2::namu.application_status, $3)`,
        [id, status, note ?? null]
      );
    } catch (error) {
      if (pgErrorCode(error) === PG_ERROR.APPLICATION_NOT_FOUND) return null;
      throw error;
    }
    return this.getById(id);
  },

  async setAdminNote(id: string, note: string): Promise<Application | null> {
    const row = await queryOne(
      `update namu.applications set admin_note = $2 where id = $1 returning id`,
      [id, note]
    );
    return row ? this.getById(id) : null;
  },

  async setNotifyOptIn(ticket: string, optIn: boolean): Promise<Application | null> {
    const row = await queryOne<{ id: string }>(
      `update namu.applications
          set notify_opt_in = $2
        where ticket = upper(btrim($1))
        returning id`,
      [ticket ?? "", optIn]
    );
    return row ? this.getById(row.id) : null;
  },

  async setFinalPremium(id: string, amount: number | null): Promise<Application | null> {
    const value =
      amount === null || !Number.isFinite(amount) || amount <= 0
        ? null
        : Math.round(amount);
    const row = await queryOne(
      `update namu.applications set final_premium = $2 where id = $1 returning id`,
      [id, value]
    );
    return row ? this.getById(id) : null;
  },

  /* 대기열 ----------------------------------------------------------- */

  async pollQueue(ticket: string): Promise<QueuePollResult> {
    const row = await queryOne(`select * from namu.poll_queue($1)`, [ticket ?? ""]);

    // 접수번호가 없으면 스냅샷도 없다. (poll_queue 내부의 대기열 소진은 이미 반영됨)
    if (!row) return { snapshot: null, served: [] };

    const snapshot: QueueSnapshot = {
      ticket: String(row.ticket),
      queueNumber: Number(row.queue_number),
      status: row.status as ApplicationStatus,
      ahead: Number(row.ahead),
      aheadAtEntry: Number(row.ahead_at_entry),
      progress: Number(row.progress),
      estimatedMinutes: Number(row.estimated_minutes),
      throughputPerMinute: Number(row.throughput_per_minute),
      totalWaiting: Number(row.total_waiting),
      notifyOptIn: Boolean(row.notify_opt_in),
      partnerName: String(row.partner_name),
      requestLabel: String(row.request_label ?? ""),
    };

    // 이번 호출로 접수 확정된 건이 있을 때만 추가 조회한다.
    const servedTickets = (row.served_tickets as string[] | null) ?? [];
    if (servedTickets.length === 0) return { snapshot, served: [] };

    const rows = await query(
      `${APPLICATION_SELECT} where a.ticket = any($1::text[]) order by a.queue_number`,
      [servedTickets]
    );
    return { snapshot, served: rows.map(mapApplication) };
  },

  async serveNext(count: number): Promise<Application[]> {
    const served = await query<{ ticket: string }>(
      `select ticket from namu.serve_next($1)`,
      [Math.max(0, Math.round(count))]
    );
    if (served.length === 0) return [];

    const rows = await query(
      `${APPLICATION_SELECT} where a.ticket = any($1::text[]) order by a.queue_number`,
      [served.map((r) => r.ticket)]
    );
    return rows.map(mapApplication);
  },

  /* 설정 ------------------------------------------------------------- */

  async getSettings(): Promise<Settings> {
    const row = await queryOne(SETTINGS_SELECT);
    if (!row) throw new Error("namu.settings 행이 없습니다. 초기화 스크립트를 실행하세요.");
    return mapSettings(row);
  },

  async updateSettings(
    patch: Partial<Pick<Settings, "throughputPerMinute" | "intakePaused">>
  ): Promise<Settings> {
    const throughput =
      typeof patch.throughputPerMinute === "number"
        ? Math.min(600, Math.max(1, Math.round(patch.throughputPerMinute)))
        : null;
    const paused =
      typeof patch.intakePaused === "boolean" ? patch.intakePaused : null;

    await query(
      `update namu.settings
          set throughput_per_minute = coalesce($1, throughput_per_minute),
              intake_paused         = coalesce($2, intake_paused)
        where id = true`,
      [throughput, paused]
    );
    return this.getSettings();
  },

  /* 협약 문의 -------------------------------------------------------- */

  async createInquiry(input): Promise<PartnerInquiry> {
    const row = await queryOne(
      `insert into namu.partner_inquiries
         (org_name, contact_name, position, phone_enc, email_enc, member_count, message)
       values ($1,$2,$3,$4,$5,$6,$7)
       returning *`,
      [
        input.orgName,
        input.contactName,
        input.position,
        input.phoneEnc,
        input.emailEnc,
        input.memberCount,
        input.message,
      ]
    );
    if (!row) throw new Error("문의 저장에 실패했습니다.");
    return mapInquiry(row);
  },

  async listInquiries(): Promise<PartnerInquiry[]> {
    const rows = await query(
      `select * from namu.partner_inquiries order by created_at desc limit 500`
    );
    return rows.map(mapInquiry);
  },

  async markInquiryHandled(id: string, handled: boolean): Promise<PartnerInquiry | null> {
    const row = await queryOne(
      `update namu.partner_inquiries set handled = $2 where id = $1 returning *`,
      [id, handled]
    );
    return row ? mapInquiry(row) : null;
  },

  /* 알림 ------------------------------------------------------------- */

  async logNotification(entry): Promise<void> {
    await query(
      `insert into namu.notification_logs
         (application_id, ticket, channel, template, ok, detail)
       values ($1,$2,$3,$4,$5,$6)`,
      [
        entry.applicationId || null,
        entry.ticket,
        entry.channel,
        entry.template,
        entry.ok,
        entry.detail,
      ]
    );
  },

  async listNotifications(limit = 50): Promise<NotificationLog[]> {
    const rows = await query(
      `select * from namu.notification_logs order by created_at desc limit $1`,
      [Math.min(Math.max(limit, 1), 200)]
    );
    return rows.map((row) => ({
      id: String(row.id),
      applicationId: String(row.application_id ?? ""),
      ticket: String(row.ticket),
      channel: row.channel as NotificationLog["channel"],
      template: String(row.template),
      ok: Boolean(row.ok),
      detail: String(row.detail ?? ""),
      createdAt: iso(row.created_at),
    }));
  },

  /* 집계 ------------------------------------------------------------- */

  async getPublicStats(): Promise<PublicStats> {
    const row = await queryOne(
      `select s.*, (namu.saving_rate() * 100) as average_saving_rate
         from namu.public_stats() s`
    );
    return {
      partnerCount: Number(row?.partner_count ?? 0),
      applicationCount: Number(row?.application_count ?? 0),
      completedCount: Number(row?.completed_count ?? 0),
      totalSaving: Number(row?.total_saving ?? 0),
      averageSavingRate: Number(row?.average_saving_rate ?? 0),
    };
  },

  async getPartnerSummaries(): Promise<PartnerSummary[]> {
    const rows = await query(`select * from namu.partner_summaries`);
    return rows.map((row) => ({
      code: String(row.code),
      name: String(row.name),
      applicationCount: Number(row.application_count),
      completedCount: Number(row.completed_count),
      annualizedPremium: Number(row.annualized_premium),
      cashback: Number(row.cashback),
    }));
  },
};
