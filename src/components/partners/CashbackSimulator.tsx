"use client";

import { useMemo, useState } from "react";
import { CASHBACK_RATE } from "@/lib/catalog";
import { number, won } from "@/lib/format";

/**
 * 캐시백 시뮬레이터 — 협약 담당자가 기대 재정수입을 즉시 가늠할 수 있게 한다.
 * (기획서 4.1 "캐시백 구조 도해" 의 인터랙티브 확장)
 */
export default function CashbackSimulator({
  defaultMembers = 10000,
  averagePremium = 42600,
}: {
  defaultMembers?: number;
  averagePremium?: number;
}) {
  const [members, setMembers] = useState(defaultMembers);
  const [rate, setRate] = useState(5); // 가입 전환율(%)

  const result = useMemo(() => {
    const joiners = Math.round((members * rate) / 100);
    const monthlyPremium = joiners * averagePremium;
    const annualPremium = monthlyPremium * 12;
    return {
      joiners,
      monthlyCashback: Math.round(monthlyPremium * CASHBACK_RATE),
      annualCashback: Math.round(annualPremium * CASHBACK_RATE),
      annualPremium,
    };
  }, [members, rate, averagePremium]);

  return (
    <div id="simulator" className="card scroll-mt-24">
      <p className="text-[17px] font-bold text-navy-900">
        우리 단체는 얼마를 받게 되나요?
      </p>
      <p className="mt-1.5 text-[13px] text-muted">
        회원 수와 예상 가입률을 조정해 보세요.
      </p>

      <div className="mt-7 space-y-7">
        <div>
          <div className="flex items-baseline justify-between">
            <label htmlFor="members" className="text-[14px] font-semibold text-navy-900">
              소속 회원 수
            </label>
            <span className="text-[15px] font-extrabold text-navy-900">
              {number(members)}명
            </span>
          </div>
          <input
            id="members"
            type="range"
            min={100}
            max={50000}
            step={100}
            value={members}
            onChange={(e) => setMembers(Number(e.target.value))}
            className="mt-3 w-full accent-[#1F3864]"
          />
          <div className="mt-1 flex justify-between text-[11px] text-muted">
            <span>100명</span>
            <span>50,000명</span>
          </div>
        </div>

        <div>
          <div className="flex items-baseline justify-between">
            <label htmlFor="rate" className="text-[14px] font-semibold text-navy-900">
              예상 가입률
            </label>
            <span className="text-[15px] font-extrabold text-navy-900">{rate}%</span>
          </div>
          <input
            id="rate"
            type="range"
            min={1}
            max={30}
            step={1}
            value={rate}
            onChange={(e) => setRate(Number(e.target.value))}
            className="mt-3 w-full accent-[#1F3864]"
          />
          <div className="mt-1 flex justify-between text-[11px] text-muted">
            <span>1%</span>
            <span>30%</span>
          </div>
        </div>
      </div>

      <div className="mt-8 rounded-2xl bg-navy-900 p-6 text-center text-white">
        <p className="text-[13px] text-white/60">
          가입 예상 {number(result.joiners)}명 기준 · 연간 캐시백
        </p>
        <p className="mt-2 stat-figure text-[38px] text-gold-400 sm:text-[46px]">
          {won(result.annualCashback)}
        </p>
        <p className="mt-2 text-[13px] text-white/60">
          월 환산 약 {won(result.monthlyCashback)}
        </p>
      </div>

      <p className="mt-4 text-[12px] leading-relaxed text-muted">
        * 1인 월 평균 보험료 {won(averagePremium)}, 캐시백{" "}
        {(CASHBACK_RATE * 100).toFixed(0)}% 가정. 실제 지급액은 회원별 가입 상품과
        유지 현황(성사 기준·해지 시 환수 규정 포함)에 따라 달라지며, 구체적 정산
        기준은 협약서에 명시됩니다.
      </p>
    </div>
  );
}
