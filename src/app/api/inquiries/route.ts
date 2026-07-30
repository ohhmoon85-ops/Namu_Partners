import { NextResponse } from "next/server";
import { encrypt } from "@/lib/crypto";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { createInquiry } from "@/lib/store";
import {
  collectErrors,
  digitsOnly,
  validateEmail,
  validateName,
  validatePhone,
} from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/inquiries — 협약 문의 접수 (기획서 화면 5번, B2B)
 */
export async function POST(request: Request) {
  const limit = rateLimit(`inquiry:${clientIp(request)}`, 3, 60_000);
  if (!limit.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: `요청이 너무 잦습니다. ${limit.retryAfter}초 후 다시 시도해 주세요.`,
      },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "요청 형식이 올바르지 않습니다." },
      { status: 400 }
    );
  }

  if (body.privacyAgreed !== true) {
    return NextResponse.json(
      { ok: false, error: "개인정보 수집·이용 동의가 필요합니다." },
      { status: 400 }
    );
  }

  const orgName = String(body.orgName ?? "").trim();
  const contactName = String(body.contactName ?? "").trim();
  const position = String(body.position ?? "").trim();
  const phone = String(body.phone ?? "");
  const email = String(body.email ?? "").trim();
  const memberCount = Number(body.memberCount ?? 0);
  const message = String(body.message ?? "").trim().slice(0, 2000);

  const fields = collectErrors({
    orgName: orgName.length < 2 ? "단체명을 입력해 주세요." : null,
    contactName: validateName(contactName),
    phone: validatePhone(phone),
    email: validateEmail(email),
    memberCount:
      !Number.isFinite(memberCount) || memberCount < 1
        ? "회원 수를 숫자로 입력해 주세요."
        : null,
  });
  if (fields) {
    return NextResponse.json(
      { ok: false, error: "입력 내용을 확인해 주세요.", fields },
      { status: 400 }
    );
  }

  try {
    await createInquiry({
      orgName,
      contactName,
      position,
      phoneEnc: encrypt(digitsOnly(phone)),
      emailEnc: encrypt(email),
      memberCount: Math.round(memberCount),
      message,
    });
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    console.error("[api/inquiries] 문의 접수 실패", error);
    return NextResponse.json(
      { ok: false, error: "문의 접수 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
