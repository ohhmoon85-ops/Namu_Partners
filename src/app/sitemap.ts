import type { MetadataRoute } from "next";

/** SEO 대응 (기획서 6장) — 배포 도메인은 NEXT_PUBLIC_SITE_URL 로 지정한다. */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "https://namupartners.example";
  // /partners 는 단체 담당자 전용이므로 사이트맵에 포함하지 않는다.
  const routes = [
    { path: "/", priority: 1 },
    { path: "/apply", priority: 0.9 },
    { path: "/faq", priority: 0.6 },
    { path: "/privacy", priority: 0.3 },
    { path: "/terms", priority: 0.3 },
  ];

  return routes.map((route) => ({
    url: `${base}${route.path}`,
    changeFrequency: "weekly" as const,
    priority: route.priority,
  }));
}
