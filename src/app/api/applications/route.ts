import { NextResponse } from "next/server";
import { encrypt, hashValue } from "@/lib/crypto";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import {
  DuplicateApplicationError,
  IntakePausedError,
  InvalidCatalogError,
  createApplication,
  getCategory,
  getPartner,
} from "@/lib/store";
import {
  collectErrors,
  digitsOnly,
  normalizeBirth,
  validateBirth,
  validateName,
  validatePhone,
} from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/applications — 가입 상담 접수 (기획서 4.2 4단계)
 * 접수 즉시 저장하고 순번을 발급한다. (소프트 대기열)
 */
export async function POST(request: Request) {
  const limit = rateLimit(`apply:${clientIp(request)}`, 5, 60_000);
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

  const partnerCode = String(body.partnerCode ?? "");
  const categoryCode = String(body.categoryCode ?? "");
  const insurer = String(body.insurer ?? "").trim().slice(0, 40);
  const productName = String(body.productName ?? "").trim().slice(0, 80);
  const memo = String(body.memo ?? "").trim().slice(0, 500);
  const name = String(body.name ?? "").trim();
  const phone = String(body.phone ?? "");
  const birth = String(body.birth ?? "");
  const genderRaw = String(body.gender ?? "");
  const gender = genderRaw === "M" || genderRaw === "F" ? genderRaw : "";

  // 개인정보 수집·이용 동의는 접수의 전제조건이다. (기획서 9장)
  if (body.privacyAgreed !== true) {
    return NextResponse.json(
      { ok: false, error: "개인정보 수집·이용 동의가 필요합니다." },
      { status: 400 }
    );
  }

  // 저장소가 최종 검증을 하지만, 사용자에게 빠르고 구체적인 오류를 주기 위해 먼저 확인한다.
  const partner = await getPartner(partnerCode);
  if (!partner) {
    return NextResponse.json(
      { ok: false, error: "유효하지 않은 협약단체입니다." },
      { status: 400 }
    );
  }

  const category = await getCategory(categoryCode);
  if (!category) {
    return NextResponse.json(
      { ok: false, error: "보험 종류를 선택해 주세요." },
      { status: 400 }
    );
  }

  // 고객이 시장에서 안내받은 보험료 — 선택 입력이며 검증된 값이 아니다.
  const quotedRaw = Number(body.quotedPremium);
  const quotedPremium =
    Number.isFinite(quotedRaw) && quotedRaw > 0
      ? Math.min(Math.round(quotedRaw), 100_000_000)
      : null;

  // 클라이언트 검증을 신뢰하지 않고 서버에서 재검증한다.
  const fields = collectErrors({
    name: validateName(name),
    phone: validatePhone(phone),
    birth: validateBirth(birth),
  });
  if (fields) {
    return NextResponse.json(
      { ok: false, error: "입력 내용을 확인해 주세요.", fields },
      { status: 400 }
    );
  }

  const phoneDigits = digitsOnly(phone);

  try {
    // 중복 접수 차단은 저장소가 원자적으로 처리한다.
    // (사전 조회 후 삽입하면 동시 요청에서 경합이 발생한다)
    const application = await createApplication({
      partnerCode: partner.code,
      categoryCode: category.code,
      insurer,
      productName,
      quotedPremium,
      memo,
      // 개인정보는 암호화하여 저장한다. (기획서 6장 보안)
      nameEnc: encrypt(name),
      phoneEnc: encrypt(phoneDigits),
      birthEnc: encrypt(normalizeBirth(birth)),
      phoneHash: hashValue(phoneDigits),
      gender,
      notifyOptIn: body.notifyOptIn === true,
      marketingOptIn: body.marketingOptIn === true,
    });

    return NextResponse.json(
      {
        ok: true,
        ticket: application.ticket,
        queueNumber: application.queueNumber,
        aheadAtEntry: application.aheadAtEntry,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof IntakePausedError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 503 });
    }
    if (error instanceof DuplicateApplicationError) {
      return NextResponse.json(
        { ok: false, error: error.message, ticket: error.ticket },
        { status: 409 }
      );
    }
    if (error instanceof InvalidCatalogError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }
    console.error("[api/applications] 접수 실패", error);
    return NextResponse.json(
      { ok: false, error: "접수 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요." },
      { status: 500 }
    );
  }
}
