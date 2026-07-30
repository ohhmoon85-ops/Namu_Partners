"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

/**
 * 모바일 하단 고정 CTA — 기획서 5.2 "CTA 버튼 하단 고정(Sticky)"
 * 히어로 영역을 지나면 나타난다.
 */
export default function StickyCta() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 420);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 px-4 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-3 backdrop-blur-md transition-transform duration-300 md:hidden ${
        show ? "translate-y-0" : "translate-y-full"
      }`}
      aria-hidden={!show}
    >
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-semibold text-muted">
            설계사 가입 대비 평균
          </p>
          <p className="text-[17px] font-extrabold leading-tight text-navy-900">
            17.5% 절감
          </p>
        </div>
        <Link
          href="/apply"
          tabIndex={show ? 0 : -1}
          className="btn-primary flex-1 !min-h-[52px] !px-4"
        >
          내 보험료 확인하기
        </Link>
      </div>
    </div>
  );
}
