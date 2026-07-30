import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { decrypt } from "@/lib/crypto";
import { maskBirth, maskName, maskPhone } from "@/lib/format";
import { listApplications, setAdminNote, updateStatus } from "@/lib/store";
import { notifyApplicant } from "@/lib/notify";
import { APPLICATION_STATUSES, type ApplicationStatus } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/applications — 접수 목록 (기획서 화면 7번)
 * 목록에서는 개인정보를 마스킹하여 노출한다. (기획서 6장 접근권한 분리)
 */
export async function GET(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const url = new URL(request.url);
  const rows = await listApplications({
    status: (url.searchParams.get("status") as ApplicationStatus) || "all",
    partnerCode: url.searchParams.get("partner") || "all",
    query: url.searchParams.get("q") || undefined,
    limit: Number(url.searchParams.get("limit")) || 200,
  });

  return NextResponse.json({
    ok: true,
    applications: rows.map((app) => ({
      id: app.id,
      ticket: app.ticket,
      queueNumber: app.queueNumber,
      status: app.status,
      partnerCode: app.partnerCode,
      partnerName: app.partnerName,
      productName: app.productName,
      groupPremium: app.groupPremium,
      designerPremium: app.designerPremium,
      name: maskName(decrypt(app.nameEnc)),
      phone: maskPhone(decrypt(app.phoneEnc)),
      birth: maskBirth(decrypt(app.birthEnc)),
      gender: app.gender,
      notifyOptIn: app.notifyOptIn,
      adminNote: app.adminNote,
      createdAt: app.createdAt,
      updatedAt: app.updatedAt,
      history: app.history,
    })),
  });
}

/**
 * PATCH /api/admin/applications — 상태 변경 / 메모 수정
 * body: { id, status?, note?, adminNote? }
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

  const id = String(body.id ?? "");
  if (!id) {
    return NextResponse.json({ ok: false, error: "id 가 필요합니다." }, { status: 400 });
  }

  if (typeof body.adminNote === "string") {
    const updated = await setAdminNote(id, body.adminNote.slice(0, 1000));
    if (!updated) {
      return NextResponse.json(
        { ok: false, error: "접수 건을 찾을 수 없습니다." },
        { status: 404 }
      );
    }
  }

  if (body.status !== undefined) {
    const status = String(body.status) as ApplicationStatus;
    if (!APPLICATION_STATUSES.includes(status)) {
      return NextResponse.json(
        { ok: false, error: "허용되지 않는 상태값입니다." },
        { status: 400 }
      );
    }
    const updated = await updateStatus(
      id,
      status,
      typeof body.note === "string" ? body.note.slice(0, 300) : undefined
    );
    if (!updated) {
      return NextResponse.json(
        { ok: false, error: "접수 건을 찾을 수 없습니다." },
        { status: 404 }
      );
    }
    // 진행상태 변경을 신청자에게 통지한다. (기획서 4.3)
    void notifyApplicant(updated, "status_changed").catch(() => undefined);
  }

  return NextResponse.json({ ok: true });
}
