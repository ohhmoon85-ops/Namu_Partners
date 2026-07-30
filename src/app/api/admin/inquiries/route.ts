import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { markInquiryHandled } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * PATCH /api/admin/inquiries — 협약 문의 처리 여부 변경
 * body: { id: string, handled: boolean }
 */
export async function PATCH(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  let body: { id?: unknown; handled?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "요청 형식 오류" }, { status: 400 });
  }

  const updated = await markInquiryHandled(
    String(body.id ?? ""),
    body.handled === true
  );
  if (!updated) {
    return NextResponse.json(
      { ok: false, error: "문의를 찾을 수 없습니다." },
      { status: 404 }
    );
  }
  return NextResponse.json({ ok: true, handled: updated.handled });
}
