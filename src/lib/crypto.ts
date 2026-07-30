import crypto from "node:crypto";

/**
 * 개인정보 암호화 / 세션 서명 유틸 (서버 전용)
 * 기획서 6장 보안 · 9장 개인정보보호 요구사항 구현.
 *
 * - 저장: AES-256-GCM (인증 암호화) — 이름/휴대폰/생년월일/이메일
 * - 대조: HMAC-SHA256 — 복호화 없이 접수 조회 시 휴대폰 번호 일치 확인
 */

const DEV_SECRET = "namu-partners-dev-secret-do-not-use-in-production";

function masterSecret(): string {
  const secret = process.env.NP_SECRET;
  if (secret && secret.length >= 16) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "NP_SECRET 환경변수가 설정되지 않았습니다. 운영 배포 전 32자 이상의 임의 문자열을 지정하세요."
    );
  }
  return DEV_SECRET;
}

let cachedKey: Buffer | null = null;
function key(): Buffer {
  if (!cachedKey) {
    cachedKey = crypto.scryptSync(masterSecret(), "namu-partners-v1", 32);
  }
  return cachedKey;
}

/** AES-256-GCM 암호화 → "v1:iv:tag:ciphertext" (base64url) */
export function encrypt(plain: string): string {
  if (plain === "") return "";
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [
    "v1",
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    enc.toString("base64url"),
  ].join(":");
}

/** 복호화 실패 시 빈 문자열을 반환한다 (시크릿 교체 등으로 인한 전체 장애 방지) */
export function decrypt(payload: string): string {
  if (!payload) return "";
  const parts = payload.split(":");
  if (parts.length !== 4 || parts[0] !== "v1") return "";
  try {
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      key(),
      Buffer.from(parts[1], "base64url")
    );
    decipher.setAuthTag(Buffer.from(parts[2], "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(parts[3], "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return "";
  }
}

/** 조회 대조용 단방향 해시 */
export function hashValue(value: string): string {
  return crypto.createHmac("sha256", key()).update(value).digest("hex");
}

/** 타이밍 공격에 안전한 문자열 비교 */
export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/** 관리자 세션 토큰 발급 — "payload.signature" */
export function signSession(subject: string, ttlMs: number): string {
  const payload = Buffer.from(
    JSON.stringify({ sub: subject, exp: Date.now() + ttlMs })
  ).toString("base64url");
  const sig = crypto.createHmac("sha256", key()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifySession(token: string | undefined): boolean {
  if (!token) return false;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return false;
  const expected = crypto
    .createHmac("sha256", key())
    .update(payload)
    .digest("base64url");
  if (!safeEqual(sig, expected)) return false;
  try {
    const { exp } = JSON.parse(Buffer.from(payload, "base64url").toString());
    return typeof exp === "number" && exp > Date.now();
  } catch {
    return false;
  }
}

export function randomId(): string {
  return crypto.randomUUID();
}
