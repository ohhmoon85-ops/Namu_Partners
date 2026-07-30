import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { notifyServed } from "@/lib/notify";
import { serveNext, updateSettings } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * PATCH /api/admin/queue — 대기열 운영 설정 변경
 * body: { throughputPerMinute?: number, intakePaused?: boolean }
 */
export async function PATCH(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "요청 형식 오류" }, { status: 400 });
  }

  const patch: { throughputPerMinute?: number; intakePaused?: boolean } = {};
  if (body.throughputPerMinute !== undefined) {
    const value = Number(body.throughputPerMinute);
    if (!Number.isFinite(value) || value < 1) {
      return NextResponse.json(
        { ok: false, error: "분당 처리 건수는 1 이상의 숫자여야 합니다." },
        { status: 400 }
      );
    }
    patch.throughputPerMinute = value;
  }
  if (typeof body.intakePaused === "boolean") {
    patch.intakePaused = body.intakePaused;
  }

  const settings = await updateSettings(patch);
  return NextResponse.json({ ok: true, settings });
}

/**
 * POST /api/admin/queue — 대기열 수동 소진
 * body: { count: number } — 앞에서부터 count 건을 즉시 접수 확정한다.
 */
export async function POST(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  let body: { count?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "요청 형식 오류" }, { status: 400 });
  }

  const count = Math.min(1000, Math.max(1, Math.round(Number(body.count) || 1)));
  const served = await serveNext(count);
  if (served.length > 0) void notifyServed(served);

  return NextResponse.json({ ok: true, served: served.length });
}
