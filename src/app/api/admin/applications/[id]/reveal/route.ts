import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { decrypt } from "@/lib/crypto";
import { getById } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/applications/[id]/reveal — 개인정보 원문 조회
 *
 * 상담 착수 시에만 사용하는 별도 엔드포인트로 분리했다.
 * 목록 API 는 항상 마스킹된 값만 반환하므로, 원문 접근은 이 경로의
 * 서버 로그로 추적할 수 있다. (기획서 6장 접근권한 분리)
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await params;
  const application = await getById(id);
  if (!application) {
    return NextResponse.json(
      { ok: false, error: "접수 건을 찾을 수 없습니다." },
      { status: 404 }
    );
  }

  console.info(
    `[audit] 개인정보 원문 조회 — ticket=${application.ticket} at=${new Date().toISOString()}`
  );

  return NextResponse.json({
    ok: true,
    name: decrypt(application.nameEnc),
    phone: decrypt(application.phoneEnc),
    birth: decrypt(application.birthEnc),
  });
}
