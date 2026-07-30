import type { Metadata } from "next";
import ApplyWizard from "@/components/apply/ApplyWizard";
import {
  getPartner,
  getProduct,
  getSettings,
  listPartners,
  listProducts,
} from "@/lib/store";
import Link from "next/link";

export const metadata: Metadata = {
  title: "보험 가입 신청",
  description:
    "소속 단체와 상품을 선택하고 3분 만에 가입 상담을 신청하세요. 설계사 가입 대비 평균 17.5% 절감.",
};

export const dynamic = "force-dynamic";

export default async function ApplyPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string; product?: string }>;
}) {
  const params = await searchParams;
  const [settings, partners, products] = await Promise.all([
    getSettings(),
    listPartners(),
    listProducts(),
  ]);

  // 기획서 5.2 — 단체 코드 자동 인식 (초대 링크 / QR 파라미터)
  const partner = params.code ? await getPartner(params.code) : null;
  const product = params.product ? await getProduct(params.product) : null;

  if (settings.intakePaused) {
    return (
      <div className="container-np max-w-2xl py-24 text-center">
        <h1 className="text-[24px] font-extrabold text-navy-900">
          현재 신규 접수가 일시 중지되었습니다
        </h1>
        <p className="mt-4 text-[15px] leading-relaxed text-muted">
          신청이 집중되어 접수를 잠시 중단했습니다. 잠시 후 다시 시도해 주시거나
          고객센터로 문의해 주세요.
        </p>
        <Link href="/" className="btn-ghost mt-8">
          메인으로 돌아가기
        </Link>
      </div>
    );
  }

  return (
    <ApplyWizard
      partners={partners}
      products={products}
      initialPartnerCode={partner?.code ?? ""}
      initialProductId={product?.id ?? ""}
    />
  );
}
