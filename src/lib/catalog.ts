import type { InsuranceCategory, Partner } from "./types";

/**
 * 협약단체 · 보험 종류 시드 데이터
 *
 * ⚠️ 협약단체 목록은 화면 검증용 예시입니다. 실제 협약 체결 결과로 교체하세요.
 *
 * 보험 상품 목록은 두지 않습니다. 나무파트너스는 특정 상품을 판매하는 것이
 * 아니라 국내 보험사의 상품 전반을 취급하며, 가입자는 시장에서 이미 상품을
 * 정한 뒤 더 저렴하게 가입하러 옵니다. 따라서 플랫폼은 "어떤 종류인지"만
 * 분류받고, 보험사·상품명·안내받은 보험료는 가입자가 직접 입력합니다.
 */

export const PARTNERS: Partner[] = [
  {
    code: "ARMY",
    name: "대한민국육군협회",
    memberCount: 42000,
    category: "공익·안보 단체",
    contractedAt: "2026-06-15",
    active: true,
  },
  {
    code: "NAMU",
    name: "나무상공인연합회",
    memberCount: 18500,
    category: "소상공인 단체",
    contractedAt: "2026-06-28",
    active: true,
  },
  {
    code: "HANBIT",
    name: "한빛교직원공제회",
    memberCount: 26400,
    category: "교직원 공제",
    contractedAt: "2026-07-03",
    active: true,
  },
  {
    code: "MIRAE",
    name: "미래운수노동조합",
    memberCount: 9800,
    category: "노동조합",
    contractedAt: "2026-07-11",
    active: true,
  },
  {
    code: "SEJONG",
    name: "세종전자산업협회",
    memberCount: 12300,
    category: "산업 협회",
    contractedAt: "2026-07-20",
    active: true,
  },
];

/** 가입 신청 시 선택하는 보험 종류 */
export const INSURANCE_CATEGORIES: InsuranceCategory[] = [
  {
    code: "medical",
    name: "실손의료비 (실비)",
    examples: "입원·통원 실제 부담 의료비",
    sortOrder: 1,
    active: true,
  },
  {
    code: "critical",
    name: "암·3대질병",
    examples: "암, 뇌혈관질환, 허혈성심장질환 진단비",
    sortOrder: 2,
    active: true,
  },
  {
    code: "life",
    name: "종신·정기 (사망보장)",
    examples: "종신보험, 정기보험, 유족 생활자금",
    sortOrder: 3,
    active: true,
  },
  {
    code: "accident",
    name: "상해·재해",
    examples: "상해사망·후유장해, 골절, 입원일당",
    sortOrder: 4,
    active: true,
  },
  {
    code: "driver",
    name: "운전자",
    examples: "교통사고처리지원금, 변호사 선임비용, 벌금",
    sortOrder: 5,
    active: true,
  },
  {
    code: "child",
    name: "어린이·태아",
    examples: "자녀 종합보장, 태아보험",
    sortOrder: 6,
    active: true,
  },
  {
    code: "dental",
    name: "치아",
    examples: "임플란트, 크라운, 충전치료",
    sortOrder: 7,
    active: true,
  },
  {
    code: "care",
    name: "간병·치매",
    examples: "장기요양등급, 치매 진단·간병자금",
    sortOrder: 8,
    active: true,
  },
  {
    code: "property",
    name: "화재·재물",
    examples: "주택화재, 상가·사업장 재물, 배상책임",
    sortOrder: 9,
    active: true,
  },
  {
    code: "etc",
    name: "기타 / 잘 모르겠어요",
    examples: "위에 없는 보험이거나 상담을 통해 정하고 싶은 경우",
    sortOrder: 10,
    active: true,
  },
];

export function getCategory(code: string): InsuranceCategory | undefined {
  return INSURANCE_CATEGORIES.find((c) => c.code === code && c.active);
}

export function getPartner(code: string): Partner | undefined {
  const normalized = (code ?? "").trim().toUpperCase();
  return PARTNERS.find((p) => p.code === normalized && p.active);
}

/**
 * 평균 절감률 — 랜딩의 "평균 17.5%" 표기 기준값.
 * 기획서 3.3 각주 요구사항에 따라 산출 근거를 화면에 병기한다.
 * (근거 문구는 src/lib/company.ts 의 savingBasis)
 */
export const SAVING_RATE = 0.175;

/** 안내받은 보험료로부터 예상 보험료를 계산한다. */
export function estimatePremium(quotedPremium: number): number {
  return Math.round(quotedPremium * (1 - SAVING_RATE));
}

/**
 * 협약단체 캐시백 비율.
 *
 * ⚠️ 이 값과 관련된 어떤 수치도 가입자(회원) 대상 화면에 노출하지 않는다.
 *    관리자 화면과 협약단체 전용 안내 페이지에서만 사용한다.
 */
export const CASHBACK_RATE = 0.03;
