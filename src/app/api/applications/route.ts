import { NextResponse } from "next/server";
import { getPartner, getProduct } from "@/lib/catalog";
import { encrypt, hashValue } from "@/lib/crypto";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import {
  IntakePausedError,
  createApplication,
  findActiveDuplicate,
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
  const productId = String(body.productId ?? "");
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

  const partner = getPartner(partnerCode);
  if (!partner) {
    return NextResponse.json(
      { ok: false, error: "유효하지 않은 협약단체입니다." },
      { status: 400 }
    );
  }

  const product = getProduct(productId);
  if (!product) {
    return NextResponse.json(
      { ok: false, error: "유효하지 않은 상품입니다." },
      { status: 400 }
    );
  }

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
  const phoneHash = hashValue(phoneDigits);

  const duplicate = await findActiveDuplicate(phoneHash, product.id);
  if (duplicate) {
    return NextResponse.json(
      {
        ok: false,
        error: `이미 진행 중인 신청이 있습니다. (접수번호 ${duplicate.ticket})`,
        ticket: duplicate.ticket,
      },
      { status: 409 }
    );
  }

  try {
    const application = await createApplication({
      partnerCode: partner.code,
      partnerName: partner.name,
      productId: product.id,
      productName: product.name,
      designerPremium: product.designerPremium,
      groupPremium: product.groupPremium,
      // 개인정보는 암호화하여 저장한다. (기획서 6장 보안)
      nameEnc: encrypt(name),
      phoneEnc: encrypt(phoneDigits),
      birthEnc: encrypt(normalizeBirth(birth)),
      phoneHash,
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
    console.error("[api/applications] 접수 실패", error);
    return NextResponse.json(
      { ok: false, error: "접수 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요." },
      { status: 500 }
    );
  }
}
