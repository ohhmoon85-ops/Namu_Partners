import type { MetadataRoute } from "next";

/** 접수·대기·관리자 화면은 색인에서 제외한다. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // /partners 는 캐시백 내용을 담은 단체 담당자 전용 페이지로, 색인에서 제외한다.
      disallow: ["/admin", "/api/", "/waiting/", "/status", "/partners"],
    },
  };
}
