import { cookies } from "next/headers";
import { safeEqual, signSession, verifySession } from "./crypto";

/**
 * 관리자 인증 (기획서 6장 "접근권한 분리")
 * 단일 운영자 비밀번호 + HMAC 서명 세션 쿠키.
 * 운영 인원이 늘어나면 계정별 SSO/OTP 로 교체할 지점이다.
 */

export const ADMIN_COOKIE = "np_admin";
const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8시간

const DEV_PASSWORD = "namu-admin";

function adminPassword(): string {
  const password = process.env.ADMIN_PASSWORD;
  if (password) return password;
  if (process.env.NODE_ENV === "production") {
    throw new Error("ADMIN_PASSWORD 환경변수가 설정되지 않았습니다.");
  }
  return DEV_PASSWORD;
}

export function checkPassword(input: string): boolean {
  if (!input) return false;
  return safeEqual(input, adminPassword());
}

export function issueSession(): { name: string; value: string; maxAge: number } {
  return {
    name: ADMIN_COOKIE,
    value: signSession("admin", SESSION_TTL_MS),
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  };
}

export async function isAuthenticated(): Promise<boolean> {
  const store = await cookies();
  return verifySession(store.get(ADMIN_COOKIE)?.value);
}

/** API 라우트 가드 — 인증되지 않았으면 401 응답을 반환한다. */
export async function requireAdmin(): Promise<Response | null> {
  if (await isAuthenticated()) return null;
  return Response.json(
    { ok: false, error: "관리자 인증이 필요합니다." },
    { status: 401 }
  );
}
