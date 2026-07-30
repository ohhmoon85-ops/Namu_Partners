"use client";

import Link from "next/link";
import { useState } from "react";
import { formatDateTime, formatPhone, won } from "@/lib/format";
import {
  STATUS_DESCRIPTION,
  STATUS_LABEL,
  TIMELINE_STATUSES,
  type ApplicationStatus,
  type StatusEvent,
} from "@/lib/types";
import type { FieldErrors } from "@/lib/validation";

interface Result {
  ticket: string;
  queueNumber: number;
  status: ApplicationStatus;
  partnerName: string;
  productName: string;
  groupPremium: number;
  designerPremium: number;
  applicantName: string;
  notifyOptIn: boolean;
  createdAt: string;
  updatedAt: string;
  history: StatusEvent[];
}

export default function StatusLookup({ initialTicket }: { initialTicket: string }) {
  const [ticket, setTicket] = useState(initialTicket);
  const [phone, setPhone] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setErrors({});
    try {
      const res = await fetch("/api/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticket, phone }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.fields) setErrors(data.fields);
        setError(data.error || "조회에 실패했습니다.");
        setResult(null);
        return;
      }
      setResult(data.application);
    } catch {
      setError("네트워크 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container-np max-w-2xl py-14">
      <h1 className="text-[26px] font-extrabold tracking-tight text-navy-900">
        접수 조회
      </h1>
      <p className="mt-3 text-[15px] leading-relaxed text-muted">
        접수번호와 신청 시 입력하신 휴대폰 번호로 진행상태를 확인하실 수 있습니다.
      </p>

      <form onSubmit={submit} className="card mt-8 space-y-5">
        <div>
          <label className="label" htmlFor="ticket">접수번호</label>
          <input
            id="ticket"
            value={ticket}
            onChange={(e) => setTicket(e.target.value.toUpperCase())}
            placeholder="NP-20260730-0001"
            autoComplete="off"
            aria-invalid={!!errors.ticket}
            className={`field ${errors.ticket ? "field-error" : ""}`}
          />
          {errors.ticket && (
            <p role="alert" className="mt-1.5 text-[13px] font-medium text-red-600">
              {errors.ticket}
            </p>
          )}
        </div>

        <div>
          <label className="label" htmlFor="lookup-phone">휴대폰 번호</label>
          <input
            id="lookup-phone"
            value={phone}
            onChange={(e) => setPhone(formatPhone(e.target.value))}
            placeholder="010-0000-0000"
            inputMode="numeric"
            autoComplete="tel"
            aria-invalid={!!errors.phone}
            className={`field ${errors.phone ? "field-error" : ""}`}
          />
          {errors.phone && (
            <p role="alert" className="mt-1.5 text-[13px] font-medium text-red-600">
              {errors.phone}
            </p>
          )}
        </div>

        {error && (
          <p role="alert" className="rounded-xl bg-red-50 p-4 text-[13px] font-medium text-red-700">
            {error}
          </p>
        )}

        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? "조회 중…" : "조회하기"}
        </button>
      </form>

      {result && <ResultView result={result} />}

      <p className="mt-8 text-[13px] leading-relaxed text-muted">
        접수번호를 잊으셨나요? 고객센터로 문의해 주시면 본인 확인 후
        안내해 드립니다.
      </p>
    </div>
  );
}

function ResultView({ result }: { result: Result }) {
  const cancelled = result.status === "cancelled";
  const currentIndex = TIMELINE_STATUSES.indexOf(result.status);
  const eventByStatus = new Map(result.history.map((e) => [e.status, e]));

  return (
    <section className="mt-8">
      <div className="card">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[12px] text-muted">접수번호</p>
            <p className="text-[19px] font-extrabold tracking-tight text-navy-900">
              {result.ticket}
            </p>
          </div>
          <span
            className={`chip ${
              cancelled
                ? "bg-red-50 text-red-600"
                : result.status === "completed"
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-navy text-white"
            }`}
          >
            {STATUS_LABEL[result.status]}
          </span>
        </div>

        <dl className="mt-6 space-y-3 border-t border-line pt-5 text-[14px]">
          <Row label="신청자" value={result.applicantName} />
          <Row label="소속 단체" value={result.partnerName} />
          <Row label="신청 상품" value={result.productName} />
          <Row label="단체 전용 보험료" value={`${won(result.groupPremium)} /월`} />
          <Row
            label="설계사 대비 절감"
            value={`연 ${won((result.designerPremium - result.groupPremium) * 12)}`}
          />
          <Row label="접수일시" value={formatDateTime(result.createdAt)} />
        </dl>
      </div>

      {/* 단계별 진행상태 타임라인 — 기획서 4.3 */}
      <div className="card mt-4">
        <p className="text-[15px] font-bold text-navy-900">진행 상태</p>

        {cancelled ? (
          <p className="mt-4 rounded-xl bg-red-50 p-4 text-[13px] leading-relaxed text-red-700">
            {STATUS_DESCRIPTION.cancelled} 다시 신청을 원하시면 고객센터로 문의해 주세요.
          </p>
        ) : result.status === "queued" ? (
          <div className="mt-4">
            <p className="rounded-xl bg-mist p-4 text-[13px] leading-relaxed text-muted">
              현재 접수 대기 중입니다. 대기실에서 실시간 순번을 확인하실 수 있습니다.
            </p>
            <Link href={`/waiting/${result.ticket}`} className="btn-ghost mt-4 w-full">
              대기실로 이동
            </Link>
          </div>
        ) : (
          <ol className="mt-5 space-y-0">
            {TIMELINE_STATUSES.map((status, i) => {
              const done = i <= currentIndex;
              const active = i === currentIndex;
              const event = eventByStatus.get(status);
              const last = i === TIMELINE_STATUSES.length - 1;
              return (
                <li key={status} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <span
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px] font-bold ${
                        active
                          ? "bg-gold text-white"
                          : done
                            ? "bg-navy text-white"
                            : "bg-mist text-muted"
                      }`}
                    >
                      {done && !active ? "✓" : i + 1}
                    </span>
                    {!last && (
                      <span
                        className={`w-0.5 flex-1 ${i < currentIndex ? "bg-navy" : "bg-line"}`}
                        style={{ minHeight: 32 }}
                      />
                    )}
                  </div>
                  <div className={`pb-6 ${last ? "pb-0" : ""}`}>
                    <p
                      className={`text-[14px] font-bold ${
                        done ? "text-navy-900" : "text-muted"
                      }`}
                    >
                      {STATUS_LABEL[status]}
                    </p>
                    <p className="mt-1 text-[13px] leading-relaxed text-muted">
                      {STATUS_DESCRIPTION[status]}
                    </p>
                    {event && (
                      <p className="mt-1 text-[12px] text-muted/80">
                        {formatDateTime(event.at)}
                        {event.note ? ` · ${event.note}` : ""}
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="shrink-0 text-muted">{label}</dt>
      <dd className="text-right font-semibold text-navy-900">{value}</dd>
    </div>
  );
}
