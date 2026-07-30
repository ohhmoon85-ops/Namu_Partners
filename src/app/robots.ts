import type { MetadataRoute } from "next";

/** 접수·대기·관리자 화면은 색인에서 제외한다. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/api/", "/waiting/", "/status"],
    },
  };
}
