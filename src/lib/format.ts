/** 표시 포맷 유틸 — 서버/클라이언트 공용 */

export function won(value: number): string {
  return `${Math.round(value).toLocaleString("ko-KR")}원`;
}

export function number(value: number): string {
  return Math.round(value).toLocaleString("ko-KR");
}

export function percent(value: number, digits = 1): string {
  return `${value.toFixed(digits)}%`;
}

/** 휴대폰 번호 자동 하이픈 (기획서 5.2 입력 최소화) */
export function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 11);
  if (digits.length < 4) return digits;
  if (digits.length < 8) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}

/** 생년월일 자동 하이픈 — YYYY-MM-DD */
export function formatBirth(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  if (digits.length < 5) return digits;
  if (digits.length < 7) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}`;
}

/** 이름 마스킹 — 홍길동 → 홍*동 */
export function maskName(name: string): string {
  if (!name) return "-";
  if (name.length <= 1) return name;
  if (name.length === 2) return `${name[0]}*`;
  return `${name[0]}${"*".repeat(name.length - 2)}${name[name.length - 1]}`;
}

/** 휴대폰 마스킹 — 010-1234-5678 → 010-****-5678 */
export function maskPhone(phone: string): string {
  if (!phone) return "-";
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 7) return "***";
  return `${digits.slice(0, 3)}-****-${digits.slice(-4)}`;
}

/** 생년월일 마스킹 — 1988-05-13 → 1988-**-** */
export function maskBirth(birth: string): string {
  if (!birth) return "-";
  return `${birth.slice(0, 4)}-**-**`;
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

/** 예상 대기시간 문구 */
export function waitTimeText(minutes: number): string {
  if (minutes <= 0) return "곧 접수됩니다";
  if (minutes < 1) return "1분 이내";
  if (minutes < 60) return `약 ${Math.ceil(minutes)}분`;
  const h = Math.floor(minutes / 60);
  const m = Math.ceil(minutes % 60);
  return m === 0 ? `약 ${h}시간` : `약 ${h}시간 ${m}분`;
}
