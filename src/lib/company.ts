/**
 * 법인·면허 정보 및 광고 표기 근거 (기획서 5.1 신뢰 장치 / 9장 법적 고지)
 *
 * ⚠️ 아래 값은 자리표시자(placeholder)입니다.
 *    오픈 전 실제 법인 등기·금융위 등록 정보로 반드시 교체하고,
 *    savingBasis 는 제휴 보험사와 합의한 산출 근거로 채워야 합니다.
 */
export const COMPANY = {
  name: "나무파트너스 주식회사",
  ceo: "○○○",
  businessNumber: "000-00-00000",
  /** 보험대리점 등록번호 등 — 금융소비자보호법상 표기 의무 항목 */
  licenseNumber: "제0000-0000호 (금융위원회 등록)",
  address: "서울특별시 ○○구 ○○로 00, 0층",
  tel: "1600-0000",
  email: "support@namupartners.example",
  privacyOfficer: "○○○ (privacy@namupartners.example)",
  /** 준법감시인 확인 번호 — 광고물 심의 후 발급받은 번호로 교체 */
  complianceNumber: "제2026-000000호 (2026.00.00 ~ 2027.00.00)",

  /** "평균 17.5%" 산출 근거 — 기획서 3.3 각주 요구사항 */
  savingBasis: {
    period: "2026년 1월~6월",
    sample: "제휴 보험사 4개 상품·설계사 경유 계약 1,284건",
  },
} as const;
