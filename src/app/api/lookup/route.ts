import { NextResponse } from "next/server";
import { decrypt, hashValue } from "@/lib/crypto";
import { maskName } from "@/lib/format";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { findForLookup } from "@/lib/store";
import { digitsOnly, validatePhone, validateTicket } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/lookup — 접수 조회 (기획서 화면 4번)
 * 접수번호 + 휴대폰 번호가 모두 일치할 때만 진행상태를 반환한다.
 */
export async function POST(request: Request) {
  // 접수번호 대입 시도를 막기 위해 조회는 더 촘촘히 제한한다.
  const limit = rateLimit(`lookup:${clientIp(request)}`, 10, 60_000);
  if (!limit.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: `조회 시도가 너무 잦습니다. ${limit.retryAfter}초 후 다시 시도해 주세요.`,
      },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } }
    );
  }

  let body: { ticket?: unknown; phone?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "요청 형식이 올바르지 않습니다." },
      { status: 400 }
    );
  }

  const ticket = String(body.ticket ?? "").trim().toUpperCase();
  const phone = String(body.phone ?? "");

  const ticketError = validateTicket(ticket);
  const phoneError = validatePhone(phone);
  if (ticketError || phoneError) {
    return NextResponse.json(
      {
        ok: false,
        error: "입력 내용을 확인해 주세요.",
        fields: {
          ...(ticketError ? { ticket: ticketError } : {}),
          ...(phoneError ? { phone: phoneError } : {}),
        },
      },
      { status: 400 }
    );
  }

  const application = await findForLookup(ticket, hashValue(digitsOnly(phone)));
  if (!application) {
    // 존재 여부를 구분해 알려주지 않는다 (접수번호 열거 방지).
    return NextResponse.json(
      { ok: false, error: "일치하는 접수 내역이 없습니다. 입력하신 정보를 확인해 주세요." },
      { status: 404 }
    );
  }

  return NextResponse.json({
    ok: true,
    application: {
      ticket: application.ticket,
      queueNumber: application.queueNumber,
      status: application.status,
      partnerName: application.partnerName,
      categoryName: application.categoryName,
      insurer: application.insurer,
      productName: application.productName,
      quotedPremium: application.quotedPremium,
      estimatedPremium: application.estimatedPremium,
      finalPremium: application.finalPremium,
      applicantName: maskName(decrypt(application.nameEnc)),
      notifyOptIn: application.notifyOptIn,
      createdAt: application.createdAt,
      updatedAt: application.updatedAt,
      history: application.history,
    },
  });
}
