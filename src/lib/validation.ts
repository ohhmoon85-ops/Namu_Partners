/** 접수·문의 입력 검증 — 클라이언트/서버 공용 (서버에서 반드시 재검증) */

export interface FieldErrors {
  [field: string]: string;
}

const NAME_RE = /^[가-힣a-zA-Z][가-힣a-zA-Z\s]{0,19}$/;
const PHONE_RE = /^01[016789]\d{7,8}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function digitsOnly(value: string): string {
  return (value ?? "").replace(/\D/g, "");
}

export function validateName(value: string): string | null {
  const v = (value ?? "").trim();
  if (!v) return "이름을 입력해 주세요.";
  if (!NAME_RE.test(v)) return "이름은 한글 또는 영문 2~20자로 입력해 주세요.";
  if (v.replace(/\s/g, "").length < 2) return "이름은 2자 이상 입력해 주세요.";
  return null;
}

export function validatePhone(value: string): string | null {
  const v = digitsOnly(value);
  if (!v) return "휴대폰 번호를 입력해 주세요.";
  if (!PHONE_RE.test(v)) return "휴대폰 번호 형식이 올바르지 않습니다.";
  return null;
}

export function validateEmail(value: string): string | null {
  const v = (value ?? "").trim();
  if (!v) return "이메일을 입력해 주세요.";
  if (!EMAIL_RE.test(v)) return "이메일 형식이 올바르지 않습니다.";
  return null;
}

/**
 * 생년월일 검증 — 주민등록번호 대신 생년월일만 수집 (기획서 5.2)
 * @param minAge 가입 가능 최소 연령
 * @param maxAge 가입 가능 최대 연령
 */
export function validateBirth(value: string, minAge = 15, maxAge = 80): string | null {
  const digits = digitsOnly(value);
  if (!digits) return "생년월일을 입력해 주세요.";
  if (digits.length !== 8) return "생년월일 8자리(YYYYMMDD)를 입력해 주세요.";

  const year = Number(digits.slice(0, 4));
  const month = Number(digits.slice(4, 6));
  const day = Number(digits.slice(6, 8));
  const date = new Date(year, month - 1, day);
  const isRealDate =
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day;
  if (!isRealDate) return "존재하지 않는 날짜입니다.";

  const now = new Date();
  if (date.getTime() > now.getTime()) return "생년월일이 미래로 입력되었습니다.";

  const age = calculateAge(date, now);
  if (age < minAge) return `만 ${minAge}세 이상부터 가입 신청이 가능합니다.`;
  if (age > maxAge) return `만 ${maxAge}세를 초과하여 온라인 신청이 어렵습니다. 고객센터로 문의해 주세요.`;
  return null;
}

export function calculateAge(birth: Date, now = new Date()): number {
  let age = now.getFullYear() - birth.getFullYear();
  const beforeBirthday =
    now.getMonth() < birth.getMonth() ||
    (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate());
  if (beforeBirthday) age -= 1;
  return age;
}

/** YYYYMMDD 또는 YYYY-MM-DD → YYYY-MM-DD 정규화 */
export function normalizeBirth(value: string): string {
  const d = digitsOnly(value);
  if (d.length !== 8) return "";
  return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
}

/** 접수번호 형식 검증 — NP-YYYYMMDD-NNNN */
export function validateTicket(value: string): string | null {
  const v = (value ?? "").trim().toUpperCase();
  if (!v) return "접수번호를 입력해 주세요.";
  if (!/^NP-\d{8}-\d{4,}$/.test(v)) {
    return "접수번호 형식이 올바르지 않습니다. (예: NP-20260730-0001)";
  }
  return null;
}

export function collectErrors(
  checks: Record<string, string | null>
): FieldErrors | null {
  const errors: FieldErrors = {};
  for (const [field, message] of Object.entries(checks)) {
    if (message) errors[field] = message;
  }
  return Object.keys(errors).length > 0 ? errors : null;
}
