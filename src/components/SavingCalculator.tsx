"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { SAVING_RATE, estimatePremium } from "@/lib/catalog";
import { won } from "@/lib/format";

/**
 * 절감액 계산기
 *
 * 가입자는 이미 시장에서 상품을 정하고 보험료를 안내받은 상태로 방문한다.
 * 그 금액을 넣으면 얼마를 아끼는지 즉시 보여주는 것이 가장 강한 유인이다.
 * (특정 상품을 제시하지 않으므로 광고 심의 부담도 적다)
 */
export default function SavingCalculator() {
  const [input, setInput] = useState("");

  const quoted = useMemo(() => {
    const digits = input.replace(/\D/g, "");
    return digits ? Number(digits) : 0;
  }, [input]);

  const result = useMemo(() => {
    if (quoted <= 0) return null;
    const estimated = estimatePremium(quoted);
    return {
      estimated,
      monthlySaving: quoted - estimated,
      annualSaving: (quoted - estimated) * 12,
      tenYearSaving: (quoted - estimated) * 12 * 10,
    };
  }, [quoted]);

  return (
    <div className="card">
      <label className="label" htmlFor="quoted-premium">
        설계사·비교사이트에서 안내받은 월 보험료
      </label>
      <div className="relative">
        <input
          id="quoted-premium"
          value={input ? Number(input.replace(/\D/g, "")).toLocaleString("ko-KR") : ""}
          onChange={(e) => setInput(e.target.value)}
          placeholder="예: 85,000"
          inputMode="numeric"
          className="field pr-12 text-[20px] font-bold"
        />
        <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[15px] font-semibold text-muted">
          원
        </span>
      </div>

      {result ? (
        <div className="mt-6">
          <div className="flex items-end justify-between gap-4 rounded-xl bg-mist p-4">
            <div>
              <p className="text-[12px] text-muted">지금 안내받으신 보험료</p>
              <p className="text-[17px] font-semibold text-muted line-through">
                {won(quoted)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[12px] font-semibold text-gold">나무파트너스 예상</p>
              <p className="text-[26px] font-extrabold leading-tight text-navy-900">
                {won(result.estimated)}
              </p>
            </div>
          </div>

          <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
            {[
              { label: "매월", value: result.monthlySaving },
              { label: "1년", value: result.annualSaving },
              { label: "10년", value: result.tenYearSaving },
            ].map((item) => (
              <div key={item.label} className="rounded-xl border border-gold/30 bg-gold-50 p-3">
                <dt className="text-[11px] font-semibold text-muted">{item.label}</dt>
                <dd className="mt-1 text-[15px] font-extrabold text-navy-900">
                  {won(item.value)}
                </dd>
              </div>
            ))}
          </dl>

          <Link href="/apply" className="btn-primary mt-5 w-full">
            이 조건으로 신청하기
          </Link>
        </div>
      ) : (
        <p className="mt-6 rounded-xl bg-mist p-5 text-center text-[13px] leading-relaxed text-muted">
          금액을 입력하시면 평균 {(SAVING_RATE * 100).toFixed(1)}% 기준으로
          <br />
          예상 절감액을 계산해 드립니다.
        </p>
      )}

      <p className="mt-4 text-[12px] leading-relaxed text-muted">
        * 평균 절감률을 적용한 <strong className="font-semibold">참고용 추정치</strong>입니다.
        실제 보험료는 보험사·상품·연령·성별·직업·가입 담보 및 인수 심사 결과에 따라
        달라지며, 최종 금액은 상담 단계에서 안내해 드립니다.
      </p>
    </div>
  );
}
