/**
 * 단순 고정 윈도 레이트 리미터 (인메모리)
 *
 * 접수·조회 엔드포인트의 자동화 남용을 막기 위한 최소 방어선이다.
 * 다중 인스턴스 배포 시에는 Upstash Redis 등 공유 저장소 기반으로 교체할 것.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const globalRef = globalThis as unknown as {
  __npRateLimit?: Map<string, Bucket>;
};
const buckets = (globalRef.__npRateLimit ??= new Map<string, Bucket>());

export interface RateLimitResult {
  ok: boolean;
  /** 남은 허용 횟수 */
  remaining: number;
  /** 재시도까지 남은 초 */
  retryAfter: number;
}

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    // 버킷이 무한히 쌓이지 않도록 만료된 항목을 가끔 정리한다.
    if (buckets.size > 5000) {
      for (const [k, v] of buckets) {
        if (v.resetAt <= now) buckets.delete(k);
      }
    }
    return { ok: true, remaining: limit - 1, retryAfter: 0 };
  }

  bucket.count += 1;
  if (bucket.count > limit) {
    return {
      ok: false,
      remaining: 0,
      retryAfter: Math.ceil((bucket.resetAt - now) / 1000),
    };
  }
  return { ok: true, remaining: limit - bucket.count, retryAfter: 0 };
}

/** 프록시 뒤에서도 동작하도록 클라이언트 IP 를 추출한다. */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") || "unknown";
}
