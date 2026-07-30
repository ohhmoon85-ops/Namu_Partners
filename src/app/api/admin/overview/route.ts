import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { decrypt } from "@/lib/crypto";
import { maskPhone } from "@/lib/format";
import {
  getPartnerSummaries,
  getSettings,
  listApplications,
  listInquiries,
  listNotifications,
  listPartners,
  storeBackend,
} from "@/lib/store";
import { APPLICATION_STATUSES, type ApplicationStatus } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/admin/overview — 대시보드 집계 (기획서 4.4 · 화면 7번) */
export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  const [settings, summaries, applications, inquiries, notifications, partners] =
    await Promise.all([
      getSettings(),
      getPartnerSummaries(),
      listApplications({ limit: 1000 }),
      listInquiries(),
      listNotifications(30),
      listPartners(),
    ]);

  const statusCounts = Object.fromEntries(
    APPLICATION_STATUSES.map((status) => [
      status,
      applications.filter((a) => a.status === status).length,
    ])
  ) as Record<ApplicationStatus, number>;

  const totalCashback = summaries.reduce((sum, s) => sum + s.cashback, 0);
  const totalAnnualized = summaries.reduce((sum, s) => sum + s.annualizedPremium, 0);

  return NextResponse.json({
    ok: true,
    // 운영자가 지금 어떤 저장소로 동작 중인지 화면에서 바로 확인할 수 있게 한다.
    backend: storeBackend,
    settings,
    partners: partners.map((p) => ({ code: p.code, name: p.name })),
    statusCounts,
    totals: {
      applications: applications.length,
      waiting: statusCounts.queued,
      completed: statusCounts.completed,
      annualizedPremium: totalAnnualized,
      cashback: totalCashback,
    },
    partnerSummaries: summaries,
    inquiries: inquiries.map((i) => ({
      id: i.id,
      orgName: i.orgName,
      contactName: i.contactName,
      position: i.position,
      phone: maskPhone(decrypt(i.phoneEnc)),
      email: decrypt(i.emailEnc),
      memberCount: i.memberCount,
      message: i.message,
      handled: i.handled,
      createdAt: i.createdAt,
    })),
    notifications,
  });
}
