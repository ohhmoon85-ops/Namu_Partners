import type { Metadata } from "next";
import { COMPANY } from "@/lib/company";

export const metadata: Metadata = {
  title: "개인정보처리방침",
  description: "나무파트너스 단체보험 플랫폼의 개인정보 수집·이용·보관·파기 정책입니다.",
};

/**
 * ⚠️ 본 문서는 기획서 9장 요구사항에 따라 작성한 초안입니다.
 *    게시 전 반드시 개인정보보호 담당 법률 검토를 거쳐 확정하세요.
 */

const SECTIONS = [
  {
    title: "제1조 (총칙)",
    body: [
      `${COMPANY.name}(이하 "회사")는 이용자의 개인정보를 중요하게 생각하며, 「개인정보 보호법」, 「정보통신망 이용촉진 및 정보보호 등에 관한 법률」, 「보험업법」 등 관련 법령을 준수합니다.`,
      "회사는 본 개인정보처리방침을 통해 이용자가 제공한 개인정보가 어떤 용도와 방식으로 이용되고 있으며, 개인정보 보호를 위해 어떤 조치가 취해지고 있는지 알려드립니다.",
    ],
  },
  {
    title: "제2조 (수집하는 개인정보 항목 및 수집 방법)",
    body: [
      "회사는 단체보험 가입 상담 접수를 위해 아래의 최소한의 개인정보를 수집합니다.",
    ],
    table: [
      {
        purpose: "가입 상담 접수",
        items: "이름, 휴대폰 번호, 생년월일, 성별(선택), 소속 협약단체, 신청 상품",
        period: "접수일로부터 3년",
      },
      {
        purpose: "접수 순서·진행상태 알림 (선택 동의)",
        items: "휴대폰 번호",
        period: "동의 철회 시 또는 접수일로부터 3년",
      },
      {
        purpose: "마케팅 정보 수신 (선택 동의)",
        items: "이름, 휴대폰 번호",
        period: "동의 철회 시까지",
      },
      {
        purpose: "협약 문의 (B2B)",
        items: "단체명, 담당자명, 직책, 연락처, 이메일, 회원 수",
        period: "문의일로부터 1년",
      },
    ],
    after: [
      "회사는 온라인 접수 단계에서 주민등록번호를 수집하지 않습니다. 보험계약 청약 단계에서 법령상 필요한 정보는 유자격 모집조직이 별도의 동의 절차를 거쳐 수집합니다.",
      "수집 방법: 플랫폼 내 신청 폼 및 문의 폼을 통한 이용자의 직접 입력",
    ],
  },
  {
    title: "제3조 (개인정보의 이용 목적)",
    body: [
      "1. 단체보험 가입 상담 접수 및 처리, 접수 순번·진행상태 안내",
      "2. 상담 담당자 배정 및 청약 절차 안내",
      "3. 협약단체별 가입 실적 집계 및 캐시백 정산 (개인 식별이 불가능한 집계 형태로만 활용)",
      "4. 이용자 문의 응대 및 민원 처리",
      "5. 별도 동의를 받은 경우에 한하여 신규 상품·프로모션 안내",
    ],
  },
  {
    title: "제4조 (개인정보의 제3자 제공)",
    body: [
      "회사는 이용자의 개인정보를 본 방침에서 고지한 범위를 넘어 이용하거나 제3자에게 제공하지 않습니다. 다만 아래의 경우는 예외로 합니다.",
      "1. 이용자가 사전에 별도로 동의한 경우 — 보험계약 청약 진행을 위해 제휴 보험사 및 유자격 모집조직에 제공",
      "2. 법령의 규정에 의하거나 수사 목적으로 법령에 정해진 절차와 방법에 따라 수사기관의 요구가 있는 경우",
      "협약단체에는 개인을 식별할 수 없는 집계 수치(신청 건수, 성사 건수, 캐시백 금액)만 제공되며, 회원 개인의 정보는 제공되지 않습니다.",
    ],
  },
  {
    title: "제5조 (개인정보의 보유 및 파기)",
    body: [
      "회사는 개인정보 수집·이용 목적이 달성된 후에는 해당 정보를 지체 없이 파기합니다. 다만 관계 법령에 따라 보존할 필요가 있는 경우 해당 기간 동안 보관합니다.",
      "· 계약 또는 청약철회 등에 관한 기록: 5년 (전자상거래법)",
      "· 소비자 불만 또는 분쟁처리에 관한 기록: 3년 (전자상거래법)",
      "파기 방법: 전자적 파일 형태는 복구·재생할 수 없는 기술적 방법으로 삭제하며, 출력물은 분쇄 또는 소각합니다.",
    ],
  },
  {
    title: "제6조 (이용자의 권리와 행사 방법)",
    body: [
      "이용자는 언제든지 자신의 개인정보에 대한 열람·정정·삭제·처리정지를 요구할 수 있습니다.",
      `요청은 고객센터(${COMPANY.tel}) 또는 개인정보 보호책임자 이메일로 접수하실 수 있으며, 회사는 지체 없이 필요한 조치를 취합니다.`,
      "선택 동의 항목(알림 수신, 마케팅 수신)은 동의를 거부하시더라도 가입 상담 접수에 제한을 받지 않습니다.",
      "만 14세 미만 아동의 개인정보는 수집하지 않습니다.",
    ],
  },
  {
    title: "제7조 (개인정보의 안전성 확보 조치)",
    body: [
      "1. 관리적 조치 — 개인정보 취급자 최소화 및 접근권한 분리, 내부관리계획 수립·시행, 정기적 교육 실시",
      "2. 기술적 조치 — 개인정보의 암호화 저장(AES-256), 전송 구간 전체 HTTPS 적용, 접근 로그 기록 및 보관",
      "3. 물리적 조치 — 개인정보가 보관된 시스템에 대한 접근 통제",
      "회사는 이름·휴대폰 번호·생년월일 등 식별정보를 암호화하여 저장하며, 운영 화면에서는 마스킹된 형태로만 표시합니다.",
    ],
  },
  {
    title: "제8조 (쿠키의 운용)",
    body: [
      "회사는 서비스 이용 편의를 위해 최소한의 쿠키를 사용합니다. 관리자 인증 세션 유지 목적의 쿠키는 HttpOnly 속성으로 설정되어 스크립트를 통한 접근이 차단됩니다.",
      "이용자는 웹 브라우저 설정을 통해 쿠키 저장을 거부할 수 있으나, 이 경우 일부 기능 이용에 제한이 있을 수 있습니다.",
    ],
  },
  {
    title: "제9조 (개인정보 보호책임자)",
    body: [
      `개인정보 보호책임자: ${COMPANY.privacyOfficer}`,
      `고객센터: ${COMPANY.tel}`,
      "개인정보 침해에 대한 신고·상담이 필요하신 경우 아래 기관에 문의하실 수 있습니다.",
      "· 개인정보침해신고센터 (privacy.kisa.or.kr / 국번 없이 118)",
      "· 개인정보 분쟁조정위원회 (kopico.go.kr / 1833-6972)",
      "· 대검찰청 사이버수사과 (spo.go.kr / 국번 없이 1301)",
      "· 경찰청 사이버수사국 (ecrm.police.go.kr / 국번 없이 182)",
    ],
  },
  {
    title: "제10조 (방침의 변경)",
    body: [
      "본 개인정보처리방침의 내용 추가·삭제 및 수정이 있을 경우 시행 7일 전부터 플랫폼 공지사항을 통해 고지합니다.",
      "· 공고일자: 2026년 0월 0일",
      "· 시행일자: 2026년 0월 0일",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <div className="container-np max-w-3xl py-14 sm:py-20">
      <h1 className="section-title">개인정보처리방침</h1>
      <p className="mt-4 text-[14px] leading-relaxed text-muted">
        {COMPANY.name}는 이용자의 개인정보를 소중히 다루며, 관련 법령에 따라
        아래와 같이 개인정보를 처리합니다.
      </p>

      <div className="mt-10 space-y-10">
        {SECTIONS.map((section) => (
          <section key={section.title}>
            <h2 className="text-[16px] font-extrabold text-navy-900">
              {section.title}
            </h2>
            <div className="mt-3 space-y-2.5 text-[14px] leading-relaxed text-muted">
              {section.body.map((line, i) => (
                <p key={i}>{line}</p>
              ))}
            </div>

            {section.table && (
              <div className="mt-5 overflow-x-auto">
                <table className="w-full min-w-[560px] border-collapse text-[13px]">
                  <thead>
                    <tr className="bg-mist text-navy-900">
                      <th className="border border-line px-3 py-2.5 text-left font-bold">
                        이용 목적
                      </th>
                      <th className="border border-line px-3 py-2.5 text-left font-bold">
                        수집 항목
                      </th>
                      <th className="border border-line px-3 py-2.5 text-left font-bold">
                        보유 기간
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {section.table.map((row) => (
                      <tr key={row.purpose}>
                        <td className="border border-line px-3 py-2.5 align-top text-navy-900">
                          {row.purpose}
                        </td>
                        <td className="border border-line px-3 py-2.5 align-top text-muted">
                          {row.items}
                        </td>
                        <td className="border border-line px-3 py-2.5 align-top text-muted">
                          {row.period}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {section.after && (
              <div className="mt-4 space-y-2.5 text-[14px] leading-relaxed text-muted">
                {section.after.map((line, i) => (
                  <p key={i}>{line}</p>
                ))}
              </div>
            )}
          </section>
        ))}
      </div>

      <p className="mt-12 rounded-xl bg-mist p-5 text-[12px] leading-relaxed text-muted">
        ※ 본 문서는 플랫폼 구축 단계의 초안입니다. 실제 게시 전 개인정보보호
        담당 법률 검토를 거쳐 회사 실정에 맞게 확정해야 합니다.
      </p>
    </div>
  );
}
