import "server-only";

import { isPostgresEnabled } from "@/lib/db";
import { jsonStore } from "./json-store";
import { pgStore } from "./pg-store";
import type { ListFilter, NewApplicationInput, StoreApi } from "./contract";
import type { ApplicationStatus, Settings } from "@/lib/types";

/**
 * 저장소 선택
 *
 *   DATABASE_URL 설정됨  → Supabase(Postgres) `namu` 스키마   [운영]
 *   미설정               → 로컬 JSON 파일                      [개발·데모]
 *
 * 화면과 API 는 항상 이 모듈만 import 한다.
 */
const impl: StoreApi = isPostgresEnabled() ? pgStore : jsonStore;

export const storeBackend: "postgres" | "json" = isPostgresEnabled()
  ? "postgres"
  : "json";

if (process.env.NODE_ENV === "production" && storeBackend === "json") {
  console.warn(
    "[store] DATABASE_URL 이 없어 로컬 JSON 파일 저장소로 동작합니다. " +
      "서버리스 다중 인스턴스 환경에서는 데이터가 인스턴스별로 갈라집니다."
  );
}

// 카탈로그
export const listPartners = () => impl.listPartners();
export const getPartner = (code: string) => impl.getPartner(code);
export const listProducts = () => impl.listProducts();
export const getProduct = (id: string) => impl.getProduct(id);

// 접수
export const createApplication = (input: NewApplicationInput) =>
  impl.createApplication(input);
export const getByTicket = (ticket: string) => impl.getByTicket(ticket);
export const getById = (id: string) => impl.getById(id);
export const findForLookup = (ticket: string, phoneHash: string) =>
  impl.findForLookup(ticket, phoneHash);
export const listApplications = (filter?: ListFilter) => impl.listApplications(filter);
export const updateStatus = (
  id: string,
  status: ApplicationStatus,
  note?: string
) => impl.updateStatus(id, status, note);
export const setAdminNote = (id: string, note: string) => impl.setAdminNote(id, note);
export const setNotifyOptIn = (ticket: string, optIn: boolean) =>
  impl.setNotifyOptIn(ticket, optIn);

// 대기열
export const pollQueue = (ticket: string) => impl.pollQueue(ticket);
export const serveNext = (count: number) => impl.serveNext(count);

// 설정
export const getSettings = () => impl.getSettings();
export const updateSettings = (
  patch: Partial<Pick<Settings, "throughputPerMinute" | "intakePaused">>
) => impl.updateSettings(patch);

// 협약 문의
export const createInquiry: StoreApi["createInquiry"] = (input) =>
  impl.createInquiry(input);
export const listInquiries = () => impl.listInquiries();
export const markInquiryHandled = (id: string, handled: boolean) =>
  impl.markInquiryHandled(id, handled);

// 알림
export const logNotification: StoreApi["logNotification"] = (entry) =>
  impl.logNotification(entry);
export const listNotifications = (limit?: number) => impl.listNotifications(limit);

// 집계
export const getPublicStats = () => impl.getPublicStats();
export const getPartnerSummaries = () => impl.getPartnerSummaries();

export {
  DuplicateApplicationError,
  IntakePausedError,
  InvalidCatalogError,
} from "./contract";
export type {
  ListFilter,
  NewApplicationInput,
  QueuePollResult,
  QueueSnapshot,
} from "./contract";
