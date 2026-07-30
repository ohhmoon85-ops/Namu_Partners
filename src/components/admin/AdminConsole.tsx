"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PARTNERS } from "@/lib/catalog";
import { formatDateTime, number, won } from "@/lib/format";
import {
  APPLICATION_STATUSES,
  STATUS_LABEL,
  type ApplicationStatus,
  type NotificationLog,
  type PartnerSummary,
  type Settings,
  type StatusEvent,
} from "@/lib/types";

interface AdminApplication {
  id: string;
  ticket: string;
  queueNumber: number;
  status: ApplicationStatus;
  partnerCode: string;
  partnerName: string;
  productName: string;
  groupPremium: number;
  designerPremium: number;
  name: string;
  phone: string;
  birth: string;
  gender: string;
  notifyOptIn: boolean;
  adminNote: string;
  createdAt: string;
  updatedAt: string;
  history: StatusEvent[];
}

interface Inquiry {
  id: string;
  orgName: string;
  contactName: string;
  position: string;
  phone: string;
  email: string;
  memberCount: number;
  message: string;
  handled: boolean;
  createdAt: string;
}

interface Overview {
  settings: Settings;
  statusCounts: Record<ApplicationStatus, number>;
  totals: {
    applications: number;
    waiting: number;
    completed: number;
    annualizedPremium: number;
    cashback: number;
  };
  partnerSummaries: PartnerSummary[];
  inquiries: Inquiry[];
  notifications: NotificationLog[];
}

type Tab = "applications" | "partners" | "inquiries" | "queue";

const TABS: { key: Tab; label: string }[] = [
  { key: "applications", label: "접수 관리" },
  { key: "partners", label: "단체별 실적·캐시백" },
  { key: "inquiries", label: "협약 문의" },
  { key: "queue", label: "대기열 운영" },
];

export default function AdminConsole() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("applications");
  const [overview, setOverview] = useState<Overview | null>(null);
  const [applications, setApplications] = useState<AdminApplication[]>([]);
  const [statusFilter, setStatusFilter] = useState<ApplicationStatus | "all">("all");
  const [partnerFilter, setPartnerFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadOverview = useCallback(async () => {
    const res = await fetch("/api/admin/overview", { cache: "no-store" });
    if (res.status === 401) {
      router.refresh();
      return;
    }
    const data = await res.json();
    if (data.ok) setOverview(data);
  }, [router]);

  const loadApplications = useCallback(async () => {
    const params = new URLSearchParams({
      status: statusFilter,
      partner: partnerFilter,
    });
    if (query.trim()) params.set("q", query.trim());
    const res = await fetch(`/api/admin/applications?${params}`, {
      cache: "no-store",
    });
    if (res.status === 401) {
      router.refresh();
      return;
    }
    const data = await res.json();
    if (data.ok) setApplications(data.applications);
  }, [statusFilter, partnerFilter, query, router]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      await Promise.all([loadOverview(), loadApplications()]);
    } catch {
      setError("데이터를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [loadOverview, loadApplications]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function logout() {
    await fetch("/api/admin/session", { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="min-h-dvh bg-mist">
      <header className="border-b border-line bg-white">
        <div className="container-np flex h-16 items-center justify-between">
          <div className="flex items-baseline gap-3">
            <span className="text-[16px] font-extrabold text-navy-900">
              나무파트너스 관리자
            </span>
            <span className="hidden text-[12px] text-muted sm:block">
              접수 · 대기열 · 캐시백 운영
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={refresh}
              className="btn-ghost !min-h-[38px] !px-3 !text-[13px]"
            >
              새로고침
            </button>
            <button
              type="button"
              onClick={logout}
              className="btn-ghost !min-h-[38px] !px-3 !text-[13px]"
            >
              로그아웃
            </button>
          </div>
        </div>
      </header>

      <div className="container-np py-8">
        {error && (
          <p role="alert" className="mb-5 rounded-xl bg-red-50 p-4 text-[13px] text-red-700">
            {error}
          </p>
        )}

        {overview && <SummaryCards overview={overview} />}

        <nav className="mt-8 flex gap-1 overflow-x-auto border-b border-line">
          {TABS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setTab(item.key)}
              className={`shrink-0 border-b-2 px-4 py-3 text-[14px] font-semibold transition-colors ${
                tab === item.key
                  ? "border-navy text-navy"
                  : "border-transparent text-muted hover:text-navy-900"
              }`}
            >
              {item.label}
              {item.key === "inquiries" && overview
                ? ` (${overview.inquiries.filter((i) => !i.handled).length})`
                : ""}
            </button>
          ))}
        </nav>

        <div className="mt-6">
          {loading && !overview ? (
            <p className="py-16 text-center text-[14px] text-muted">불러오는 중…</p>
          ) : (
            <>
              {tab === "applications" && (
                <ApplicationsTab
                  applications={applications}
                  statusFilter={statusFilter}
                  setStatusFilter={setStatusFilter}
                  partnerFilter={partnerFilter}
                  setPartnerFilter={setPartnerFilter}
                  query={query}
                  setQuery={setQuery}
                  onChanged={refresh}
                />
              )}
              {tab === "partners" && overview && (
                <PartnersTab summaries={overview.partnerSummaries} totals={overview.totals} />
              )}
              {tab === "inquiries" && overview && (
                <InquiriesTab inquiries={overview.inquiries} onChanged={refresh} />
              )}
              {tab === "queue" && overview && (
                <QueueTab
                  settings={overview.settings}
                  waiting={overview.totals.waiting}
                  notifications={overview.notifications}
                  onChanged={refresh}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── 상단 요약 카드 ───────────────────────── */

function SummaryCards({ overview }: { overview: Overview }) {
  const cards = [
    { label: "총 접수", value: `${number(overview.totals.applications)}건` },
    { label: "대기 중", value: `${number(overview.totals.waiting)}건` },
    { label: "청약 완료", value: `${number(overview.totals.completed)}건` },
    { label: "누적 연환산 보험료", value: won(overview.totals.annualizedPremium) },
    { label: "예상 캐시백 합계 (3%)", value: won(overview.totals.cashback) },
  ];
  return (
    <dl className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {cards.map((card) => (
        <div key={card.label} className="rounded-xl border border-line bg-white p-4">
          <dt className="text-[12px] text-muted">{card.label}</dt>
          <dd className="mt-1.5 text-[19px] font-extrabold tracking-tight text-navy-900">
            {card.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/* ───────────────────────── 접수 관리 탭 ───────────────────────── */

function ApplicationsTab({
  applications,
  statusFilter,
  setStatusFilter,
  partnerFilter,
  setPartnerFilter,
  query,
  setQuery,
  onChanged,
}: {
  applications: AdminApplication[];
  statusFilter: ApplicationStatus | "all";
  setStatusFilter: (v: ApplicationStatus | "all") => void;
  partnerFilter: string;
  setPartnerFilter: (v: string) => void;
  query: string;
  setQuery: (v: string) => void;
  onChanged: () => void;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <section>
      <div className="flex flex-col gap-3 sm:flex-row">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as ApplicationStatus | "all")}
          aria-label="상태 필터"
          className="field sm:max-w-[180px]"
        >
          <option value="all">전체 상태</option>
          {APPLICATION_STATUSES.map((status) => (
            <option key={status} value={status}>
              {STATUS_LABEL[status]}
            </option>
          ))}
        </select>

        <select
          value={partnerFilter}
          onChange={(e) => setPartnerFilter(e.target.value)}
          aria-label="단체 필터"
          className="field sm:max-w-[220px]"
        >
          <option value="all">전체 단체</option>
          {PARTNERS.map((p) => (
            <option key={p.code} value={p.code}>
              {p.name}
            </option>
          ))}
        </select>

        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="접수번호 또는 단체명 검색"
          aria-label="검색"
          className="field flex-1"
        />
      </div>

      {applications.length === 0 ? (
        <p className="py-16 text-center text-[14px] text-muted">
          조건에 해당하는 접수 건이 없습니다.
        </p>
      ) : (
        <ul className="mt-5 space-y-2">
          {applications.map((app) => (
            <li key={app.id}>
              <ApplicationRow
                app={app}
                expanded={expanded === app.id}
                onToggle={() => setExpanded(expanded === app.id ? null : app.id)}
                onChanged={onChanged}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ApplicationRow({
  app,
  expanded,
  onToggle,
  onChanged,
}: {
  app: AdminApplication;
  expanded: boolean;
  onToggle: () => void;
  onChanged: () => void;
}) {
  const [note, setNote] = useState(app.adminNote);
  const [revealed, setRevealed] = useState<{
    name: string;
    phone: string;
    birth: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    try {
      await fetch("/api/admin/applications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: app.id, ...body }),
      });
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  async function reveal() {
    const res = await fetch(`/api/admin/applications/${app.id}/reveal`);
    const data = await res.json();
    if (data.ok) setRevealed({ name: data.name, phone: data.phone, birth: data.birth });
  }

  return (
    <div className="rounded-xl border border-line bg-white">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex w-full flex-wrap items-center gap-x-4 gap-y-2 p-4 text-left"
      >
        <span className="font-mono text-[13px] font-bold text-navy-900">
          {app.ticket}
        </span>
        <StatusBadge status={app.status} />
        <span className="text-[13px] text-muted">{app.partnerName}</span>
        <span className="text-[13px] text-muted">{app.productName}</span>
        <span className="ml-auto text-[12px] text-muted">
          {formatDateTime(app.createdAt)}
        </span>
      </button>

      {expanded && (
        <div className="border-t border-line p-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <dl className="space-y-2 text-[13px]">
              <Row label="신청자" value={revealed?.name ?? app.name} />
              <Row label="휴대폰" value={revealed?.phone ?? app.phone} />
              <Row label="생년월일" value={revealed?.birth ?? app.birth} />
              <Row
                label="성별"
                value={app.gender === "M" ? "남성" : app.gender === "F" ? "여성" : "-"}
              />
              <Row label="대기번호" value={number(app.queueNumber)} />
              <Row label="알림 수신" value={app.notifyOptIn ? "동의" : "미동의"} />
              <Row
                label="보험료"
                value={`${won(app.groupPremium)} /월 (설계사 ${won(app.designerPremium)})`}
              />
            </dl>

            <div>
              <p className="text-[12px] font-semibold text-navy-900">진행 이력</p>
              <ol className="mt-2 space-y-1.5 text-[12px] text-muted">
                {app.history.map((event, i) => (
                  <li key={`${event.status}-${i}`}>
                    {formatDateTime(event.at)} · {STATUS_LABEL[event.status]}
                    {event.note ? ` (${event.note})` : ""}
                  </li>
                ))}
              </ol>
            </div>
          </div>

          {!revealed && (
            <button
              type="button"
              onClick={reveal}
              className="btn-ghost mt-4 !min-h-[36px] !px-3 !text-[12px]"
            >
              연락처 원문 보기 (조회 기록 남음)
            </button>
          )}

          <div className="mt-5 border-t border-line pt-4">
            <p className="text-[12px] font-semibold text-navy-900">상태 변경</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {APPLICATION_STATUSES.filter((s) => s !== "queued").map((status) => (
                <button
                  key={status}
                  type="button"
                  disabled={busy || app.status === status}
                  onClick={() => patch({ status })}
                  className={`rounded-lg border px-3 py-2 text-[12px] font-semibold transition-colors disabled:opacity-40 ${
                    app.status === status
                      ? "border-navy bg-navy text-white"
                      : "border-line bg-white text-navy-900 hover:border-navy-300"
                  }`}
                >
                  {STATUS_LABEL[status]}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-5">
            <label className="text-[12px] font-semibold text-navy-900" htmlFor={`note-${app.id}`}>
              내부 메모
            </label>
            <div className="mt-2 flex gap-2">
              <input
                id={`note-${app.id}`}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="상담 내용, 특이사항 등"
                className="field flex-1 !py-2.5 !text-[13px]"
              />
              <button
                type="button"
                disabled={busy || note === app.adminNote}
                onClick={() => patch({ adminNote: note })}
                className="btn-ghost !min-h-[42px] !px-4 !text-[13px]"
              >
                저장
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: ApplicationStatus }) {
  const tone =
    status === "completed"
      ? "bg-emerald-50 text-emerald-700"
      : status === "cancelled"
        ? "bg-red-50 text-red-600"
        : status === "queued"
          ? "bg-amber-50 text-amber-700"
          : "bg-navy-50 text-navy";
  return <span className={`chip ${tone}`}>{STATUS_LABEL[status]}</span>;
}

/* ─────────────────── 단체별 실적·캐시백 탭 (기획서 4.4) ─────────────────── */

function PartnersTab({
  summaries,
  totals,
}: {
  summaries: PartnerSummary[];
  totals: Overview["totals"];
}) {
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);

  return (
    <section>
      <div className="overflow-x-auto rounded-xl border border-line bg-white">
        <table className="w-full min-w-[720px] border-collapse text-[13px]">
          <thead>
            <tr className="border-b border-line bg-mist text-left text-navy-900">
              <th className="px-4 py-3 font-bold">협약단체</th>
              <th className="px-4 py-3 text-right font-bold">신청 건수</th>
              <th className="px-4 py-3 text-right font-bold">성사 건수</th>
              <th className="px-4 py-3 text-right font-bold">연환산 보험료</th>
              <th className="px-4 py-3 text-right font-bold">예상 캐시백 (3%)</th>
              <th className="px-4 py-3 font-bold">전용 초대 링크</th>
            </tr>
          </thead>
          <tbody>
            {summaries.map((row) => (
              <tr key={row.code} className="border-b border-line last:border-0">
                <td className="px-4 py-3">
                  <span className="font-semibold text-navy-900">{row.name}</span>
                  <span className="ml-2 font-mono text-[11px] text-muted">{row.code}</span>
                </td>
                <td className="px-4 py-3 text-right text-navy-900">
                  {number(row.applicationCount)}
                </td>
                <td className="px-4 py-3 text-right text-navy-900">
                  {number(row.completedCount)}
                </td>
                <td className="px-4 py-3 text-right text-navy-900">
                  {won(row.annualizedPremium)}
                </td>
                <td className="px-4 py-3 text-right font-bold text-navy-900">
                  {won(row.cashback)}
                </td>
                <td className="px-4 py-3">
                  <CopyLink url={origin ? `${origin}/apply?code=${row.code}` : ""} />
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-mist font-bold text-navy-900">
              <td className="px-4 py-3">합계</td>
              <td className="px-4 py-3 text-right">{number(totals.applications)}</td>
              <td className="px-4 py-3 text-right">{number(totals.completed)}</td>
              <td className="px-4 py-3 text-right">{won(totals.annualizedPremium)}</td>
              <td className="px-4 py-3 text-right">{won(totals.cashback)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      <p className="mt-4 text-[12px] leading-relaxed text-muted">
        * 캐시백은 &lsquo;청약 완료&rsquo; 상태의 건만 집계됩니다 (연환산 보험료 × 3%).
        실제 정산 금액은 협약서에 정한 성사 기준 시점과 중도 해지 환수 규정을
        반영해 확정됩니다.
      </p>
    </section>
  );
}

function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // 클립보드 권한이 없는 환경에서는 조용히 무시한다.
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      disabled={!url}
      className="rounded-lg border border-line px-3 py-1.5 text-[12px] font-semibold text-navy-900 hover:border-navy-300 disabled:opacity-40"
    >
      {copied ? "복사됨 ✓" : "링크 복사"}
    </button>
  );
}

/* ───────────────────────── 협약 문의 탭 ───────────────────────── */

function InquiriesTab({
  inquiries,
  onChanged,
}: {
  inquiries: Inquiry[];
  onChanged: () => void;
}) {
  async function toggle(id: string, handled: boolean) {
    await fetch("/api/admin/inquiries", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, handled }),
    });
    onChanged();
  }

  if (inquiries.length === 0) {
    return (
      <p className="py-16 text-center text-[14px] text-muted">
        접수된 협약 문의가 없습니다.
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {inquiries.map((inquiry) => (
        <li key={inquiry.id} className="rounded-xl border border-line bg-white p-5">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-[15px] font-bold text-navy-900">
              {inquiry.orgName}
            </span>
            <span className="chip bg-mist text-muted">
              회원 {number(inquiry.memberCount)}명
            </span>
            {inquiry.handled ? (
              <span className="chip bg-emerald-50 text-emerald-700">처리 완료</span>
            ) : (
              <span className="chip bg-amber-50 text-amber-700">미처리</span>
            )}
            <span className="ml-auto text-[12px] text-muted">
              {formatDateTime(inquiry.createdAt)}
            </span>
          </div>

          <dl className="mt-4 grid gap-2 text-[13px] sm:grid-cols-2">
            <Row
              label="담당자"
              value={`${inquiry.contactName}${inquiry.position ? ` (${inquiry.position})` : ""}`}
            />
            <Row label="연락처" value={inquiry.phone} />
            <Row label="이메일" value={inquiry.email} />
          </dl>

          {inquiry.message && (
            <p className="mt-4 whitespace-pre-wrap rounded-lg bg-mist p-4 text-[13px] leading-relaxed text-muted">
              {inquiry.message}
            </p>
          )}

          <button
            type="button"
            onClick={() => toggle(inquiry.id, !inquiry.handled)}
            className="btn-ghost mt-4 !min-h-[38px] !px-4 !text-[13px]"
          >
            {inquiry.handled ? "미처리로 되돌리기" : "처리 완료로 표시"}
          </button>
        </li>
      ))}
    </ul>
  );
}

/* ───────────────────────── 대기열 운영 탭 ───────────────────────── */

function QueueTab({
  settings,
  waiting,
  notifications,
  onChanged,
}: {
  settings: Settings;
  waiting: number;
  notifications: NotificationLog[];
  onChanged: () => void;
}) {
  const [throughput, setThroughput] = useState(String(settings.throughputPerMinute));
  const [serveCount, setServeCount] = useState("10");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setThroughput(String(settings.throughputPerMinute));
  }, [settings.throughputPerMinute]);

  async function patch(body: Record<string, unknown>, successText: string) {
    setBusy(true);
    setMessage("");
    try {
      const res = await fetch("/api/admin/queue", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      setMessage(res.ok ? successText : data.error || "변경에 실패했습니다.");
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  async function serve() {
    setBusy(true);
    setMessage("");
    try {
      const res = await fetch("/api/admin/queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count: Number(serveCount) || 1 }),
      });
      const data = await res.json();
      setMessage(res.ok ? `${data.served}건을 접수 확정했습니다.` : "처리에 실패했습니다.");
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-xl border border-line bg-white p-6">
        <p className="text-[15px] font-bold text-navy-900">대기열 상태</p>
        <p className="mt-4 text-[13px] text-muted">
          현재 대기 인원{" "}
          <strong className="text-[19px] font-extrabold text-navy-900">
            {number(waiting)}
          </strong>
          명 · 예상 소진{" "}
          <strong className="font-bold text-navy-900">
            {waiting === 0
              ? "0분"
              : `약 ${Math.ceil(waiting / Math.max(1, settings.throughputPerMinute))}분`}
          </strong>
        </p>

        <div className="mt-6">
          <label className="label" htmlFor="throughput">
            분당 접수 처리 건수
          </label>
          <div className="flex gap-2">
            <input
              id="throughput"
              type="number"
              min={1}
              max={600}
              value={throughput}
              onChange={(e) => setThroughput(e.target.value)}
              className="field flex-1"
            />
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                patch(
                  { throughputPerMinute: Number(throughput) },
                  "처리 속도를 변경했습니다."
                )
              }
              className="btn-ghost !px-5"
            >
              적용
            </button>
          </div>
          <p className="mt-2 text-[12px] leading-relaxed text-muted">
            대기열은 이 속도로 자동 소진됩니다. 실제 상담 인력의 처리 능력에 맞춰
            설정하면 예상 대기시간 안내가 정확해집니다.
          </p>
        </div>

        <div className="mt-6 border-t border-line pt-6">
          <label className="label" htmlFor="serve-count">
            대기열 수동 처리
          </label>
          <div className="flex gap-2">
            <input
              id="serve-count"
              type="number"
              min={1}
              value={serveCount}
              onChange={(e) => setServeCount(e.target.value)}
              className="field flex-1"
            />
            <button
              type="button"
              disabled={busy || waiting === 0}
              onClick={serve}
              className="btn-ghost !px-5"
            >
              즉시 접수
            </button>
          </div>
          <p className="mt-2 text-[12px] text-muted">
            대기열 앞에서부터 입력한 건수만큼 즉시 접수 확정합니다.
          </p>
        </div>

        <div className="mt-6 border-t border-line pt-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[14px] font-bold text-navy-900">신규 접수 일시 중지</p>
              <p className="mt-1 text-[12px] leading-relaxed text-muted">
                켜면 신청 페이지에서 접수를 받지 않습니다. 이미 접수된 건은 계속
                처리됩니다.
              </p>
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                patch(
                  { intakePaused: !settings.intakePaused },
                  settings.intakePaused
                    ? "접수를 재개했습니다."
                    : "신규 접수를 중지했습니다."
                )
              }
              className={`relative h-8 w-14 shrink-0 rounded-full transition-colors ${
                settings.intakePaused ? "bg-red-500" : "bg-line"
              }`}
              aria-pressed={settings.intakePaused}
              aria-label="신규 접수 일시 중지"
            >
              <span
                className={`absolute top-1 h-6 w-6 rounded-full bg-white transition-all ${
                  settings.intakePaused ? "left-7" : "left-1"
                }`}
              />
            </button>
          </div>
        </div>

        {message && (
          <p role="status" className="mt-5 rounded-lg bg-navy-50 p-3 text-[13px] text-navy">
            {message}
          </p>
        )}
      </div>

      <div className="rounded-xl border border-line bg-white p-6">
        <p className="text-[15px] font-bold text-navy-900">최근 알림 발송 이력</p>
        {notifications.length === 0 ? (
          <p className="mt-6 text-[13px] text-muted">발송 이력이 없습니다.</p>
        ) : (
          <ul className="mt-4 divide-y divide-line">
            {notifications.map((log) => (
              <li key={log.id} className="flex items-center gap-3 py-2.5 text-[12px]">
                <span
                  className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                    log.ok ? "bg-emerald-500" : "bg-red-500"
                  }`}
                />
                <span className="font-mono text-navy-900">{log.ticket}</span>
                <span className="text-muted">{log.channel}</span>
                <span className="truncate text-muted">{log.detail}</span>
                <span className="ml-auto shrink-0 text-muted">
                  {formatDateTime(log.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-5 text-[12px] leading-relaxed text-muted">
          * NOTIFY_PROVIDER 환경변수가 설정되지 않은 경우 실제 발송 없이 콘솔에만
          기록됩니다.
        </p>
      </div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="shrink-0 text-muted">{label}</dt>
      <dd className="text-right font-semibold text-navy-900">{value}</dd>
    </div>
  );
}
