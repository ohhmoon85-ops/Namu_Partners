/**
 * 도메인 타입 정의
 * 기획서 4.2(가입 플로우), 4.3(대기열), 4.4(협약단체 관리) 기준
 */

/** 접수 진행 상태 — 기획서 4.3 "접수 완료 → 서류 검토 → 담당자 배정 → 청약 진행" */
export const APPLICATION_STATUSES = [
  "queued", // 대기열 대기 중 (아직 접수 확정 전)
  "received", // 접수 완료
  "reviewing", // 서류 검토
  "assigned", // 담당자 배정
  "contracting", // 청약 진행
  "completed", // 청약 완료 (성사 — 캐시백 정산 대상)
  "cancelled", // 취소/철회
] as const;

export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

/** 조회 페이지 타임라인에 노출하는 단계 (queued/cancelled 제외) */
export const TIMELINE_STATUSES: ApplicationStatus[] = [
  "received",
  "reviewing",
  "assigned",
  "contracting",
  "completed",
];

export const STATUS_LABEL: Record<ApplicationStatus, string> = {
  queued: "대기 중",
  received: "접수 완료",
  reviewing: "서류 검토",
  assigned: "담당자 배정",
  contracting: "청약 진행",
  completed: "청약 완료",
  cancelled: "취소",
};

export const STATUS_DESCRIPTION: Record<ApplicationStatus, string> = {
  queued: "접수 순번을 기다리고 있습니다.",
  received: "신청서가 정상 접수되었습니다.",
  reviewing: "요청하신 상품의 인수 조건을 확인하고 있습니다.",
  assigned: "전담 상담 담당자가 배정되었습니다.",
  contracting: "담당자가 연락드려 청약 절차를 진행합니다.",
  completed: "청약이 완료되었습니다. 증권은 보험사에서 발송됩니다.",
  cancelled: "신청이 취소되었습니다.",
};

/** 협약단체 */
export interface Partner {
  /** 단체 코드 — 초대 링크(?code=)·QR 에 사용 (기획서 4.4) */
  code: string;
  name: string;
  /** 소속 회원 규모 (안내용) */
  memberCount: number;
  category: string;
  /** 협약 체결일 (YYYY-MM-DD) */
  contractedAt: string;
  active: boolean;
}

/**
 * 보험 종류
 *
 * 나무파트너스는 특정 상품을 판매하는 것이 아니라 국내 보험사의 모든 상품을
 * 취급한다. 가입자는 시장에서 이미 상품을 정한 뒤 더 저렴하게 가입하러 오므로,
 * 플랫폼은 상품 목록을 제시하지 않고 "어떤 종류인지"만 분류받는다.
 */
export interface InsuranceCategory {
  code: string;
  name: string;
  /** 어떤 보험이 여기 속하는지 예시 */
  examples: string;
  sortOrder: number;
  active: boolean;
}

/** 접수 건 */
export interface Application {
  id: string;
  /** 접수번호 — 조회 페이지 입력값 (예: NP-20260730-0001) */
  ticket: string;
  /** 전체 대기열 통합 순번 */
  queueNumber: number;
  /** 접수 시점의 내 앞 대기 인원 — 진행률 바 기준값 */
  aheadAtEntry: number;

  partnerCode: string;
  partnerName: string;

  // ── 가입 희망 상품 (고객이 시장에서 확인한 것) ──
  categoryCode: string;
  categoryName: string;
  /** 희망 보험사 (선택) */
  insurer: string;
  /** 고객이 입력한 상품명 (선택) */
  productName: string;
  /** 설계사·비교사이트에서 안내받은 월 보험료 (선택, 원) */
  quotedPremium: number | null;
  /** 안내 시점의 예상 보험료 = quotedPremium × (1 − 절감률) */
  estimatedPremium: number | null;
  /** 청약 완료 시 담당자가 입력하는 확정 월 보험료 — 캐시백 정산 기준 */
  finalPremium: number | null;

  // 개인정보는 AES-256-GCM 으로 암호화하여 보관한다 (기획서 6장/9장)
  nameEnc: string;
  phoneEnc: string;
  birthEnc: string;
  /** 조회·중복확인용 HMAC (복호화 없이 대조) */
  phoneHash: string;
  gender: "M" | "F" | "";

  /** 상담 시 참고할 요청사항 */
  memo: string;

  /** 순서 도래 시 알림톡/문자 수신 동의 (기획서 4.3 자리 비움 허용) */
  notifyOptIn: boolean;
  /** 개인정보 수집·이용 동의 시각 */
  agreedAt: string;
  /** 마케팅 수신 동의(선택 항목) */
  marketingOptIn: boolean;

  status: ApplicationStatus;
  history: StatusEvent[];
  adminNote: string;
  createdAt: string;
  updatedAt: string;
}

export interface StatusEvent {
  status: ApplicationStatus;
  at: string;
  note?: string;
}

/** 협약 문의 (B2B) */
export interface PartnerInquiry {
  id: string;
  orgName: string;
  contactName: string;
  position: string;
  phoneEnc: string;
  emailEnc: string;
  memberCount: number;
  message: string;
  handled: boolean;
  createdAt: string;
}

/** 알림 발송 로그 */
export interface NotificationLog {
  id: string;
  applicationId: string;
  ticket: string;
  channel: "alimtalk" | "sms" | "console";
  template: string;
  ok: boolean;
  detail: string;
  createdAt: string;
}

/** 운영 설정 — 대기열 처리 속도 등 */
export interface Settings {
  /** 분당 접수 처리 건수 (소프트 대기열 소진 속도) */
  throughputPerMinute: number;
  /** 대기열 마지막 소진 계산 기준 시각 */
  lastAdvanceAt: string;
  /** 누적 발급 순번 */
  lastQueueNumber: number;
  /** 접수 자체를 일시 중지 */
  intakePaused: boolean;
}

/**
 * 랜딩 신뢰 지표 (기획서 3.3)
 *
 * ⚠️ 캐시백 관련 수치는 절대 포함하지 않는다. 가입자 대상 화면에는
 *    협약단체 캐시백을 노출하지 않는 것이 운영 방침이다.
 */
export interface PublicStats {
  partnerCount: number;
  applicationCount: number;
  completedCount: number;
  /** 누적 연환산 절감액(원) — 안내받은 보험료를 입력한 건만 집계 */
  totalSaving: number;
  /** 평균 절감률(%) */
  averageSavingRate: number;
}

/** 협약단체별 실적·캐시백 집계 (기획서 4.4) — 관리자 전용 */
export interface PartnerSummary {
  code: string;
  name: string;
  applicationCount: number;
  completedCount: number;
  /** 성사 건 기준 연환산 누적 보험료 */
  annualizedPremium: number;
  /** 연환산 보험료 × 3% */
  cashback: number;
}
