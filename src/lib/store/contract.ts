import type {
  Application,
  ApplicationStatus,
  NotificationLog,
  Partner,
  PartnerInquiry,
  PartnerSummary,
  Product,
  PublicStats,
  Settings,
} from "@/lib/types";

/**
 * 데이터 저장소 계약
 *
 * 두 구현이 이 인터페이스를 만족한다.
 *   · json-store : 로컬 JSON 파일 (DATABASE_URL 미설정 시 — 개발·데모용)
 *   · pg-store   : Supabase/Postgres `namu` 스키마 (운영)
 *
 * 화면과 API 는 이 계약에만 의존하므로, 저장소를 바꿔도 상위 코드는 그대로다.
 */

export interface NewApplicationInput {
  partnerCode: string;
  productId: string;
  /** 이미 암호화된 값이 들어온다 (평문을 저장소에 넘기지 않는다) */
  nameEnc: string;
  phoneEnc: string;
  birthEnc: string;
  phoneHash: string;
  gender: "M" | "F" | "";
  notifyOptIn: boolean;
  marketingOptIn: boolean;
}

export interface ListFilter {
  status?: ApplicationStatus | "all";
  partnerCode?: string;
  query?: string;
  limit?: number;
}

/** 대기실 화면에 필요한 스냅샷 (기획서 4.3) */
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

export interface QueuePollResult {
  snapshot: QueueSnapshot | null;
  /** 이번 호출로 접수 확정된 건 — 알림 발송 대상 */
  served: Application[];
}

export type NewInquiryInput = Omit<
  PartnerInquiry,
  "id" | "createdAt" | "handled"
>;

export type NewNotificationLog = Omit<NotificationLog, "id" | "createdAt">;

export interface StoreApi {
  // 카탈로그 -----------------------------------------------------------
  listPartners(): Promise<Partner[]>;
  getPartner(code: string): Promise<Partner | null>;
  listProducts(): Promise<Product[]>;
  getProduct(id: string): Promise<Product | null>;

  // 접수 ---------------------------------------------------------------
  createApplication(input: NewApplicationInput): Promise<Application>;
  getByTicket(ticket: string): Promise<Application | null>;
  getById(id: string): Promise<Application | null>;
  findForLookup(ticket: string, phoneHash: string): Promise<Application | null>;
  listApplications(filter?: ListFilter): Promise<Application[]>;
  updateStatus(
    id: string,
    status: ApplicationStatus,
    note?: string
  ): Promise<Application | null>;
  setAdminNote(id: string, note: string): Promise<Application | null>;
  setNotifyOptIn(ticket: string, optIn: boolean): Promise<Application | null>;

  // 대기열 -------------------------------------------------------------
  pollQueue(ticket: string): Promise<QueuePollResult>;
  serveNext(count: number): Promise<Application[]>;

  // 설정 ---------------------------------------------------------------
  getSettings(): Promise<Settings>;
  updateSettings(
    patch: Partial<Pick<Settings, "throughputPerMinute" | "intakePaused">>
  ): Promise<Settings>;

  // 협약 문의 ----------------------------------------------------------
  createInquiry(input: NewInquiryInput): Promise<PartnerInquiry>;
  listInquiries(): Promise<PartnerInquiry[]>;
  markInquiryHandled(id: string, handled: boolean): Promise<PartnerInquiry | null>;

  // 알림 ---------------------------------------------------------------
  logNotification(entry: NewNotificationLog): Promise<void>;
  listNotifications(limit?: number): Promise<NotificationLog[]>;

  // 집계 ---------------------------------------------------------------
  getPublicStats(): Promise<PublicStats>;
  getPartnerSummaries(): Promise<PartnerSummary[]>;
}

/* ─────────────────────── 도메인 오류 ─────────────────────── */

export class IntakePausedError extends Error {
  constructor() {
    super("현재 신규 접수가 일시 중지되었습니다.");
    this.name = "IntakePausedError";
  }
}

export class DuplicateApplicationError extends Error {
  constructor(public readonly ticket?: string) {
    super(
      ticket
        ? `이미 진행 중인 신청이 있습니다. (접수번호 ${ticket})`
        : "이미 진행 중인 신청이 있습니다."
    );
    this.name = "DuplicateApplicationError";
  }
}

export class InvalidCatalogError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidCatalogError";
  }
}
