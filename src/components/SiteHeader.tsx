"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const NAV = [
  { href: "/#saving", label: "절감 원리" },
  { href: "/#products", label: "보험상품" },
  { href: "/partners", label: "협약단체" },
  { href: "/status", label: "접수조회" },
  { href: "/faq", label: "FAQ" },
];

export default function SiteHeader() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // 페이지 이동 시 모바일 메뉴를 닫는다.
  useEffect(() => setOpen(false), [pathname]);

  // 관리자 화면은 대외 헤더를 노출하지 않는다.
  if (pathname?.startsWith("/admin")) return null;

  return (
    <header
      className={`sticky top-0 z-50 transition-all duration-300 ${
        scrolled
          ? "border-b border-line bg-white/90 backdrop-blur-md"
          : "border-b border-transparent bg-white"
      }`}
    >
      <div className="container-np flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5" aria-label="나무파트너스 홈">
          <LogoMark />
          <span className="text-[17px] font-extrabold tracking-tight text-navy-900">
            나무파트너스
          </span>
        </Link>

        <nav className="hidden items-center gap-7 md:flex" aria-label="주요 메뉴">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-sm font-semibold text-navy-900/70 transition-colors hover:text-navy"
            >
              {item.label}
            </Link>
          ))}
          <Link href="/apply" className="btn-primary !min-h-[42px] !px-5 !text-sm">
            내 보험료 확인하기
          </Link>
        </nav>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex h-11 w-11 items-center justify-center rounded-lg text-navy-900 md:hidden"
          aria-expanded={open}
          aria-controls="mobile-nav"
          aria-label={open ? "메뉴 닫기" : "메뉴 열기"}
        >
          <span className="relative block h-4 w-5">
            <span
              className={`absolute left-0 h-0.5 w-5 bg-current transition-all ${
                open ? "top-1.5 rotate-45" : "top-0"
              }`}
            />
            <span
              className={`absolute left-0 top-1.5 h-0.5 w-5 bg-current transition-opacity ${
                open ? "opacity-0" : "opacity-100"
              }`}
            />
            <span
              className={`absolute left-0 h-0.5 w-5 bg-current transition-all ${
                open ? "top-1.5 -rotate-45" : "top-3"
              }`}
            />
          </span>
        </button>
      </div>

      {open && (
        <nav
          id="mobile-nav"
          className="border-t border-line bg-white px-5 pb-5 pt-2 md:hidden"
          aria-label="모바일 메뉴"
        >
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex min-h-[48px] items-center border-b border-line/70 text-[15px] font-semibold text-navy-900"
            >
              {item.label}
            </Link>
          ))}
          <Link href="/apply" className="btn-primary mt-4 w-full">
            내 보험료 확인하기
          </Link>
        </nav>
      )}
    </header>
  );
}

function LogoMark() {
  return (
    <span
      className="flex h-9 w-9 items-center justify-center rounded-lg bg-navy"
      aria-hidden="true"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <path
          d="M12 3.5 5.5 9.2v9.3a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1V9.2L12 3.5Z"
          stroke="#B99A5B"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        <path
          d="M12 19.5V12m0 0-2.6-2.2M12 12l2.6-2.2"
          stroke="#B99A5B"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}
