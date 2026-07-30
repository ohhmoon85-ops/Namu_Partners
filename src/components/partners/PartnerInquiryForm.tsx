"use client";

import { useState } from "react";
import { formatPhone } from "@/lib/format";
import type { FieldErrors } from "@/lib/validation";

const EMPTY = {
  orgName: "",
  contactName: "",
  position: "",
  phone: "",
  email: "",
  memberCount: "",
  message: "",
};

/** 협약 문의 폼 (B2B) — 기획서 4.1 · 화면 5번 */
export default function PartnerInquiryForm() {
  const [form, setForm] = useState(EMPTY);
  const [agreed, setAgreed] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);

  function update(field: keyof typeof EMPTY, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!agreed) {
      setError("개인정보 수집·이용에 동의해 주세요.");
      return;
    }
    setSending(true);
    setError("");
    setErrors({});
    try {
      const res = await fetch("/api/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          memberCount: Number(form.memberCount.replace(/\D/g, "")) || 0,
          privacyAgreed: agreed,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.fields) setErrors(data.fields);
        setError(data.error || "문의 접수에 실패했습니다.");
        return;
      }
      setDone(true);
      setForm(EMPTY);
      setAgreed(false);
    } catch {
      setError("네트워크 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setSending(false);
    }
  }

  if (done) {
    return (
      <div className="card text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-navy-50">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="m5 12.5 4.5 4.5L19 7.5"
              stroke="#1F3864"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <p className="mt-5 text-[18px] font-extrabold text-navy-900">
          문의가 접수되었습니다
        </p>
        <p className="mt-2 text-[14px] leading-relaxed text-muted">
          담당자가 영업일 기준 2일 이내에 연락드려 협약 절차를 안내해
          드리겠습니다.
        </p>
        <button
          type="button"
          onClick={() => setDone(false)}
          className="btn-ghost mt-6"
        >
          다른 문의 남기기
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="card space-y-5">
      <p className="text-[17px] font-bold text-navy-900">협약 문의하기</p>

      <Field
        id="orgName"
        label="단체명"
        value={form.orgName}
        onChange={(v) => update("orgName", v)}
        placeholder="○○협회"
        error={errors.orgName}
      />

      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          id="contactName"
          label="담당자 성함"
          value={form.contactName}
          onChange={(v) => update("contactName", v)}
          placeholder="홍길동"
          error={errors.contactName}
        />
        <Field
          id="position"
          label="직책 (선택)"
          value={form.position}
          onChange={(v) => update("position", v)}
          placeholder="사무국장"
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          id="inquiry-phone"
          label="연락처"
          value={form.phone}
          onChange={(v) => update("phone", formatPhone(v))}
          placeholder="010-0000-0000"
          inputMode="numeric"
          error={errors.phone}
        />
        <Field
          id="email"
          label="이메일"
          value={form.email}
          onChange={(v) => update("email", v)}
          placeholder="contact@example.org"
          type="email"
          error={errors.email}
        />
      </div>

      <Field
        id="memberCount"
        label="소속 회원 수"
        value={form.memberCount}
        onChange={(v) =>
          update(
            "memberCount",
            v.replace(/\D/g, "").replace(/\B(?=(\d{3})+(?!\d))/g, ",")
          )
        }
        placeholder="예: 12,000"
        inputMode="numeric"
        error={errors.memberCount}
      />

      <div>
        <label className="label" htmlFor="message">문의 내용 (선택)</label>
        <textarea
          id="message"
          value={form.message}
          onChange={(e) => update("message", e.target.value)}
          rows={4}
          placeholder="협약 조건, 진행 일정 등 궁금하신 점을 남겨 주세요."
          className="field resize-none"
        />
      </div>

      <label className="flex items-start gap-3 rounded-xl bg-mist p-4">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-0.5 h-5 w-5 shrink-0 accent-[#1F3864]"
        />
        <span className="text-[13px] leading-relaxed text-muted">
          <strong className="font-semibold text-navy-900">
            개인정보 수집·이용 동의 (필수)
          </strong>
          <br />
          수집 항목: 단체명, 담당자명, 직책, 연락처, 이메일, 회원 수 / 이용
          목적: 협약 상담 및 안내 / 보유 기간: 문의일로부터 1년
        </span>
      </label>

      {error && (
        <p role="alert" className="rounded-xl bg-red-50 p-4 text-[13px] font-medium text-red-700">
          {error}
        </p>
      )}

      <button type="submit" disabled={sending} className="btn-primary w-full">
        {sending ? "전송 중…" : "협약 문의 보내기"}
      </button>
    </form>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  placeholder,
  error,
  type = "text",
  inputMode,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  error?: string;
  type?: string;
  inputMode?: "numeric" | "text";
}) {
  return (
    <div>
      <label className="label" htmlFor={id}>{label}</label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        inputMode={inputMode}
        aria-invalid={!!error}
        className={`field ${error ? "field-error" : ""}`}
      />
      {error && (
        <p role="alert" className="mt-1.5 text-[13px] font-medium text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
