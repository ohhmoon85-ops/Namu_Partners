import type { Partner, Product } from "./types";

/**
 * 협약단체 · 보험상품 시드 데이터
 *
 * ⚠️ 아래 값은 화면 검증용 예시 데이터입니다.
 *    - 협약단체 목록: 실제 협약 체결 결과로 교체해야 합니다.
 *    - 보험료: 제휴 보험사가 확정한 요율로 교체해야 하며,
 *      확정 전까지 대외 노출용으로 사용해서는 안 됩니다. (기획서 9장 광고 규제)
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

export const PRODUCTS: Product[] = [
  {
    id: "acc-plus",
    name: "나무 단체상해보험 플러스",
    summary: "일상·업무 중 상해를 폭넓게 보장하는 기본형 단체상해보험",
    coverages: [
      { label: "상해사망", amount: "1억 원" },
      { label: "상해후유장해", amount: "1억 원 한도" },
      { label: "상해입원일당", amount: "3만 원 / 일" },
      { label: "골절·화상 진단", amount: "50만 원" },
    ],
    designerPremium: 32000,
    groupPremium: 26400,
    eligibility: "만 15세 ~ 만 70세 · 협약단체 소속 회원 및 배우자",
    featured: true,
  },
  {
    id: "med-real",
    name: "나무 단체실손의료비",
    summary: "입원·통원 실제 부담 의료비를 보장하는 4세대 실손 단체형",
    coverages: [
      { label: "질병입원 의료비", amount: "5,000만 원" },
      { label: "질병통원 의료비", amount: "20만 원 / 회" },
      { label: "상해입원 의료비", amount: "5,000만 원" },
      { label: "비급여 3종 특약", amount: "약관 기준" },
    ],
    designerPremium: 45000,
    groupPremium: 37100,
    eligibility: "만 19세 ~ 만 65세 · 기존 실손 보유자는 중복 가입 불가",
  },
  {
    id: "life-term",
    name: "나무 단체정기보험",
    summary: "가장의 소득 상실 위험에 대비하는 사망 보장 중심 정기보험",
    coverages: [
      { label: "일반사망", amount: "2억 원" },
      { label: "재해사망", amount: "3억 원" },
      { label: "장해 시 보험료 납입면제", amount: "50% 이상 장해" },
    ],
    designerPremium: 58000,
    groupPremium: 47900,
    eligibility: "만 20세 ~ 만 60세 · 보험기간 20년 만기",
  },
  {
    id: "health-3",
    name: "나무 단체건강보험 (3대질병)",
    summary: "암·뇌혈관·심장질환 진단비를 집중 보장하는 종합 건강보험",
    coverages: [
      { label: "암 진단비", amount: "5,000만 원" },
      { label: "뇌혈관질환 진단비", amount: "3,000만 원" },
      { label: "허혈성심장질환 진단비", amount: "3,000만 원" },
      { label: "질병수술비", amount: "100만 원" },
    ],
    designerPremium: 72000,
    groupPremium: 59400,
    eligibility: "만 20세 ~ 만 65세 · 가입 전 고지의무 대상",
    featured: true,
  },
];

export function getProduct(id: string): Product | undefined {
  return PRODUCTS.find((p) => p.id === id);
}

export function getPartner(code: string): Partner | undefined {
  const normalized = code.trim().toUpperCase();
  return PARTNERS.find((p) => p.code === normalized && p.active);
}

/** 상품별 절감률(%) */
export function savingRate(product: Product): number {
  return ((product.designerPremium - product.groupPremium) / product.designerPremium) * 100;
}

/**
 * 전 상품 평균 절감률 — 랜딩의 "평균 17.5%" 표기 근거.
 * 기획서 3.3 각주 요구사항에 따라 산출 기준을 화면에 병기한다.
 */
export function averageSavingRate(): number {
  const sum = PRODUCTS.reduce((acc, p) => acc + savingRate(p), 0);
  return sum / PRODUCTS.length;
}

/** 협약단체 캐시백 비율 */
export const CASHBACK_RATE = 0.03;
