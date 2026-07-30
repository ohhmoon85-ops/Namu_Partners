"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { number, percent, waitTimeText } from "@/lib/format";
import { SAVING_RATE } from "@/lib/catalog";

interface Snapshot {
  ticket: string;
  queueNumber: number;
  status: string;
  ahead: number;
  aheadAtEntry: number;
  progress: number;
  estimatedMinutes: number;
  throughputPerMinute: number;
  totalWaiting: number;
  notifyOptIn: boolean;
  partnerName: string;
  /** 신청 요약 (상품명 또는 보험 종류) */
  requestLabel: string;
}

const POLL_INTERVAL_MS = 3000;

/**
 * 가상 대기실 (기획서 4.3)
 *
 * ⚠️ 협약단체 캐시백은 이 화면에 노출하지 않는다. 대기 중 콘텐츠는
 *    절감 구조와 진행 안내로만 구성한다.
 */
export default function WaitingRoom({ initial }: { initial: Snapshot }) {
  const [snapshot, setSnapshot] = useState<Snapshot>(initial);
  const [offline, setOffline] = useState(false);
  const [savingOptIn, setSavingOptIn] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const served = snapshot.status !== "queued";

  const poll = useCallback(async () => {
    try {
      const res = await fetch(`/api/queue/${snapshot.ticket}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("poll failed");
      const data = await res.json();
      setSnapshot((prev) => ({ ...prev, ...data }));
      setOffline(false);
    } catch {
      // 일시적 네트워크 오류로 순번을 잃지 않도록 안내만 하고 폴링은 계속한다.
      setOffline(true);
    }
  }, [snapshot.ticket]);

  useEffect(() => {
    if (served) return;
    const tick = () => {
      timer.current = setTimeout(async () => {
        // 백그라운드 탭에서는 폴링을 건너뛰어 서버 부하를 줄인다.
        if (document.visibilityState === "visible") await poll();
        tick();
      }, POLL_INTERVAL_MS);
    };
    tick();
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [poll, served]);

  async function toggleNotify(next: boolean) {
    setSavingOptIn(true);
    // 낙관적 업데이트 — 실패 시 되돌린다.
    setSnapshot((prev) => ({ ...prev, notifyOptIn: next }));
    try {
      const res = await fetch(`/api/queue/${snapshot.ticket}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notifyOptIn: next }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setSnapshot((prev) => ({ ...prev, notifyOptIn: !next }));
    } finally {
      setSavingOptIn(false);
    }
  }

  if (served) return <ServedView snapshot={snapshot} />;

  return (
    <div className="bg-navy-900 pb-20 text-white">
      <div className="container-np max-w-2xl pt-14">
        <div className="text-center">
          <span className="chip border border-gold/40 bg-gold/10 text-gold-400">
            접수 대기 중
          </span>
          <h1 className="mt-5 text-[24px] font-extrabold leading-tight sm:text-[30px]">
            신청이 몰리고 있습니다
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed text-white/65">
            순서대로 안전하게 접수해 드리고 있습니다.
            <br />
            이 화면을 유지하시면 순번이 자동으로 앞당겨집니다.
          </p>
        </div>

        {/* 대기 현황 카드 */}
        <div className="glass mt-9 text-center">
          <p className="text-sm text-white/60">현재 회원님 앞에</p>
          <p className="mt-2 flex items-baseline justify-center gap-2">
            <span
              className="stat-figure text-[72px] text-gold-400 sm:text-[88px]"
              aria-live="polite"
            >
              {number(snapshot.ahead)}
            </span>
            <span className="text-[22px] font-bold">명</span>
          </p>
          <p className="mt-1 text-sm text-white/60">이 대기 중입니다</p>

          <div className="mt-7">
            <div
              className="h-2.5 w-full overflow-hidden rounded-full bg-white/12"
              role="progressbar"
              aria-valuenow={snapshot.progress}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="대기 진행률"
            >
              <div
                className="shimmer h-full rounded-full bg-gradient-to-r from-gold to-gold-400 transition-[width] duration-700 ease-out"
                style={{ width: `${Math.max(3, snapshot.progress)}%` }}
              />
            </div>
            <div className="mt-2.5 flex justify-between text-[12px] text-white/55">
              <span>진행률 {snapshot.progress}%</span>
              <span>예상 대기 {waitTimeText(snapshot.estimatedMinutes)}</span>
            </div>
          </div>

          <dl className="mt-7 grid grid-cols-3 gap-3 border-t border-white/12 pt-5 text-center">
            <div>
              <dt className="text-[11px] text-white/50">내 대기번호</dt>
              <dd className="mt-1 text-[15px] font-bold">
                {number(snapshot.queueNumber)}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] text-white/50">전체 대기</dt>
              <dd className="mt-1 text-[15px] font-bold">
                {number(snapshot.totalWaiting)}명
              </dd>
            </div>
            <div>
              <dt className="text-[11px] text-white/50">처리 속도</dt>
              <dd className="mt-1 text-[15px] font-bold">
                분당 {number(snapshot.throughputPerMinute)}건
              </dd>
            </div>
          </dl>
        </div>

        {offline && (
          <p
            role="status"
            className="mt-4 rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 text-center text-[13px] text-amber-200"
          >
            연결이 원활하지 않습니다. 순번은 그대로 유지되니 잠시만 기다려 주세요.
          </p>
        )}

        {/* 자리 비움 허용 — 기획서 4.3 */}
        <div className="glass mt-5">
          <div className="flex items-start gap-3">
            <span className="relative mt-1 flex h-2.5 w-2.5 shrink-0">
              <span className="pulse-ring absolute inset-0" />
              <span className="h-2.5 w-2.5 rounded-full bg-gold" />
            </span>
            <div className="flex-1">
              <p className="text-[15px] font-bold">기다리지 않아도 괜찮습니다</p>
              <p className="mt-1.5 text-[13px] leading-relaxed text-white/65">
                알림 수신을 신청하시면 순서가 도래했을 때 알림톡·문자로 알려드립니다.
                페이지를 닫아도 대기번호 {number(snapshot.queueNumber)}번은 그대로
                유지됩니다.
              </p>
              <label className="mt-4 flex cursor-pointer items-center gap-3">
                <input
                  type="checkbox"
                  checked={snapshot.notifyOptIn}
                  disabled={savingOptIn}
                  onChange={(e) => toggleNotify(e.target.checked)}
                  className="h-5 w-5 accent-[#B99A5B]"
                />
                <span className="text-[14px] font-semibold">
                  순서 도래 시 알림 받기
                </span>
              </label>
            </div>
          </div>
        </div>

        <p className="mt-5 rounded-xl bg-white/[0.06] p-4 text-center text-[13px] text-white/60">
          접수번호{" "}
          <strong className="font-bold text-white">{snapshot.ticket}</strong>
          <br />
          <span className="text-[12px]">
            접수번호는 문자로도 안내되며, 조회 페이지에서 진행상태를 확인할 수 있습니다.
          </span>
        </p>
      </div>

      {/* 대기 중 콘텐츠 — 대기시간을 홍보 접점으로 전환 (기획서 4.3) */}
      <WaitingContent />
    </div>
  );
}

/* ──────────────────── 접수 완료 화면 ──────────────────── */

function ServedView({ snapshot }: { snapshot: Snapshot }) {
  return (
    <div className="container-np max-w-2xl py-20">
      <div className="text-center">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-navy-50">
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="m5 12.5 4.5 4.5L19 7.5"
              stroke="#1F3864"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <h1 className="mt-6 text-[26px] font-extrabold tracking-tight text-navy-900">
          접수가 완료되었습니다
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-muted">
          담당자가 순차적으로 연락드려 보장 내용과 최종 보험료를 안내해
          드립니다.
        </p>
      </div>

      <dl className="card mt-9 space-y-3 text-[14px]">
        <div className="flex items-center justify-between gap-4">
          <dt className="text-muted">접수번호</dt>
          <dd className="text-[17px] font-extrabold tracking-tight text-navy-900">
            {snapshot.ticket}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-4">
          <dt className="text-muted">소속 단체</dt>
          <dd className="font-semibold text-navy-900">{snapshot.partnerName}</dd>
        </div>
        <div className="flex items-center justify-between gap-4">
          <dt className="text-muted">신청 내용</dt>
          <dd className="font-semibold text-navy-900">{snapshot.requestLabel}</dd>
        </div>
      </dl>

      <div className="mt-6 rounded-xl bg-mist p-5 text-[13px] leading-relaxed text-muted">
        <p className="font-bold text-navy-900">다음 단계 안내</p>
        <ol className="mt-3 space-y-1.5">
          <li>1. 서류 검토 — 제출하신 정보를 확인합니다.</li>
          <li>2. 담당자 배정 — 전담 상담 담당자가 배정됩니다.</li>
          <li>3. 청약 진행 — 유선/모바일로 청약 절차를 진행합니다.</li>
        </ol>
        <p className="mt-3">
          접수번호와 휴대폰 번호로 언제든 진행상태를 조회하실 수 있습니다.
        </p>
      </div>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Link href={`/status?ticket=${snapshot.ticket}`} className="btn-primary flex-1">
          진행상태 조회하기
        </Link>
        <Link href="/" className="btn-ghost flex-1">
          메인으로
        </Link>
      </div>
    </div>
  );
}

/* ──────────── 대기 중 콘텐츠 카드 (절감 사례 · 상품 · FAQ) ──────────── */

const WAIT_FAQ = [
  {
    q: "대기 중에 창을 닫아도 되나요?",
    a: "네. 접수는 이미 저장되었으며 대기번호도 유지됩니다. 알림 수신을 신청하시면 순서가 도래했을 때 알려드립니다.",
  },
  {
    q: "왜 대기가 발생하나요?",
    a: "단체 안내가 발송되면 짧은 시간에 신청이 집중됩니다. 접수 누락 없이 정확히 처리하기 위해 순서대로 접수하고 있습니다.",
  },
  {
    q: "접수 후 언제 연락이 오나요?",
    a: "접수 확정 후 영업일 기준 1~2일 이내에 담당자가 연락드립니다. 신청이 몰리는 기간에는 다소 지연될 수 있습니다.",
  },
];

function WaitingContent() {
  return (
    <div className="container-np mt-14 max-w-2xl">
      <p className="text-[13px] font-semibold uppercase tracking-[0.16em] text-white/40">
        기다리는 동안
      </p>

      <div className="mt-5 space-y-4">
        {/* 절감 원리 요약 */}
        <div className="glass">
          <p className="text-[15px] font-bold">보험료가 낮아지는 이유</p>
          <p className="mt-2 text-[13px] leading-relaxed text-white/65">
            보장을 줄여서가 아닙니다. 상품도, 보험사도, 약관도 그대로입니다.
            개별 가입 시 발생하던 모집·관리 비용을 단체 단위로 묶어 덜어내기
            때문에 평균 {percent(SAVING_RATE * 100)}가 낮아집니다.
          </p>
          <ul className="mt-4 space-y-2 text-[13px] text-white/70">
            <li className="flex gap-2.5"><span className="text-gold-400">✓</span> 보장 내용·약관 동일</li>
            <li className="flex gap-2.5"><span className="text-gold-400">✓</span> 보험사도 그대로</li>
            <li className="flex gap-2.5"><span className="text-gold-400">✓</span> 추가로 내시는 비용 없음</li>
          </ul>
        </div>

        {/* 상담 준비 안내 */}
        <div className="glass">
          <p className="text-[15px] font-bold">상담 전에 준비하시면 좋은 것</p>
          <ul className="mt-3 space-y-2.5 text-[13px] leading-relaxed text-white/65">
            <li>· 알아보신 보험사와 상품명 (있으시면)</li>
            <li>· 안내받으신 월 보험료와 보장 내용</li>
            <li>· 현재 가입 중인 보험이 있다면 그 내용</li>
            <li>· 연락받기 편한 시간대</li>
          </ul>
          <p className="mt-4 text-[12px] leading-relaxed text-white/45">
            기존 계약을 해지하고 새 계약을 체결하면 인수가 거절되거나 보험료가
            인상될 수 있습니다. 상담에서 꼭 비교해 보세요.
          </p>
        </div>

        {/* FAQ */}
        <div className="glass">
          <p className="text-[15px] font-bold">자주 묻는 질문</p>
          <div className="mt-3 space-y-2">
            {WAIT_FAQ.map((item) => (
              <details key={item.q} className="group rounded-xl bg-white/[0.06] p-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[13px] font-semibold [&::-webkit-details-marker]:hidden">
                  {item.q}
                  <span className="shrink-0 transition-transform group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="mt-3 text-[13px] leading-relaxed text-white/60">
                  {item.a}
                </p>
              </details>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
