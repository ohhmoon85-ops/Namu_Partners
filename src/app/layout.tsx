import type { Metadata, Viewport } from "next";
import "./globals.css";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";

export const metadata: Metadata = {
  title: {
    default: "나무파트너스 | 같은 보험, 더 가벼운 보험료",
    template: "%s | 나무파트너스",
  },
  description:
    "설계사 가입 대비 평균 17.5% 절감. 단체의 힘으로 누리는 합리적인 보험 — 협약단체에는 회원 보험료의 3%를 캐시백으로 돌려드립니다.",
  keywords: ["단체보험", "협약단체", "보험료 절감", "캐시백", "나무파트너스"],
  openGraph: {
    title: "같은 보험, 더 가벼운 보험료 — 나무파트너스",
    description:
      "설계사 가입 대비 평균 17.5% 절감 · 협약단체 3% 캐시백. 단체보험 프로모션 플랫폼.",
    type: "website",
    locale: "ko_KR",
    siteName: "나무파트너스",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1F3864",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <head>
        {/* Pretendard — 기획서 5.1 타이포그래피 (CDN 미가용 시 시스템 산세리프로 폴백) */}
        <link
          rel="stylesheet"
          as="style"
          crossOrigin="anonymous"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
      </head>
      <body className="min-h-dvh bg-white antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-navy focus:px-4 focus:py-2 focus:text-white"
        >
          본문 바로가기
        </a>
        <SiteHeader />
        <main id="main">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
