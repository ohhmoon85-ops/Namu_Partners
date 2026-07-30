import type { Metadata, Viewport } from "next";
import "./globals.css";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";

/**
 * ⚠️ 메타데이터는 검색 결과·카카오톡 링크 미리보기에 그대로 노출된다.
 *    협약단체 캐시백 관련 표현을 절대 넣지 말 것.
 */
export const metadata: Metadata = {
  title: {
    default: "나무파트너스 | 같은 보험, 더 가벼운 보험료",
    template: "%s | 나무파트너스",
  },
  description:
    "이미 알아보신 그 상품 그대로, 설계사 가입 대비 평균 17.5% 절감. 단체의 힘으로 누리는 합리적인 보험 — 나무파트너스.",
  keywords: ["단체보험", "보험료 절감", "보험 비교", "단체 가입", "나무파트너스"],
  openGraph: {
    title: "같은 보험, 더 가벼운 보험료 — 나무파트너스",
    description:
      "이미 알아보신 상품 그대로, 설계사 가입 대비 평균 17.5% 절감. 국내 보험사 전 상품 취급.",
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
