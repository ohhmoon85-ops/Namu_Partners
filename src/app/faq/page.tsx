import type { Metadata } from "next";
import Link from "next/link";
import Reveal from "@/components/Reveal";
import { COMPANY } from "@/lib/company";

export const metadata: Metadata = {
  title: "자주 묻는 질문",
  description:
    "단체보험 가입 절차, 보험료 절감 원리, 캐시백, 개인정보 처리에 대한 자주 묻는 질문을 모았습니다.",
};

const GROUPS = [
  {
    category: "보험료 · 절감 원리",
    items: [
      {
        q: "보험료가 저렴하면 보장도 줄어드나요?",
        a: "아닙니다. 동일한 보험사의 동일한 약관·동일한 보장으로 가입합니다. 개별 가입 과정에서 발생하던 모집·관리 비용을 단체 단위로 줄인 것이므로 보장 내용에는 차이가 없습니다.",
      },
      {
        q: "평균 17.5% 절감은 어떻게 산출된 수치인가요?",
        a: `${COMPANY.savingBasis.period} 기준 ${COMPANY.savingBasis.sample}에 대해, 동일 보장·동일 조건에서 설계사 경유 개별 가입 보험료와 협약단체 단체 가입 보험료를 비교한 평균값입니다. 연령·성별·직업·가입 담보에 따라 개인별 절감률은 달라질 수 있습니다.`,
      },
      {
        q: "제 보험료는 정확히 얼마인가요?",
        a: "플랫폼에 표기된 보험료는 대표 조건(40세 남성·표준체) 기준 예시입니다. 정확한 보험료는 접수 후 담당자 상담 단계에서 연령·성별·직업·가입 담보를 반영해 안내해 드립니다.",
      },
      {
        q: "기존에 가입한 보험을 해지하고 갈아타는 게 유리한가요?",
        a: "일률적으로 유리하다고 말씀드릴 수 없습니다. 기존 계약을 해지하고 새로운 계약을 체결할 경우 인수가 거절되거나 보험료가 인상될 수 있고, 면책기간이 다시 시작될 수 있습니다. 반드시 상담 단계에서 기존 계약 조건과 비교해 보시기 바랍니다.",
      },
    ],
  },
  {
    category: "가입 자격 · 절차",
    items: [
      {
        q: "협약단체 회원이 아니어도 가입할 수 있나요?",
        a: "본 프로모션은 협약단체 소속 회원을 대상으로 운영됩니다. 소속 단체가 아직 협약을 맺지 않았다면 협약 문의 페이지를 통해 단체 담당자께 안내해 주세요.",
      },
      {
        q: "신청하면 바로 보험에 가입되나요?",
        a: "아닙니다. 온라인 신청은 가입 상담 접수입니다. 접수 후 담당자가 연락드려 보장 내용과 최종 보험료를 안내하며, 실제 보험계약의 청약은 관련 법령에 따른 유자격 모집조직을 통해 진행됩니다.",
      },
      {
        q: "가족도 함께 가입할 수 있나요?",
        a: "상품에 따라 배우자·자녀 가입이 가능한 경우가 있습니다. 상품별 가입 조건을 확인하시고, 자세한 사항은 상담 단계에서 문의해 주세요.",
      },
      {
        q: "접수 후 취소할 수 있나요?",
        a: "네. 상담 단계에서 언제든 취소하실 수 있으며 어떠한 불이익도 없습니다. 청약 이후에는 청약철회 제도(청약일로부터 15일 이내, 보험증권 수령일로부터 15일 이내)를 이용하실 수 있습니다.",
      },
    ],
  },
  {
    category: "대기 · 접수 조회",
    items: [
      {
        q: "왜 대기 화면이 나오나요?",
        a: "단체 안내가 발송되면 짧은 시간에 신청이 집중됩니다. 접수 누락 없이 정확하게 처리하기 위해 순서대로 접수해 드리고 있습니다. 신청 내용은 대기 시작 시점에 이미 저장되어 있으므로 사라지지 않습니다.",
      },
      {
        q: "대기 중에 창을 닫아도 되나요?",
        a: "네. 접수는 이미 저장되었고 대기번호도 유지됩니다. 알림 수신을 신청하시면 순서가 도래했을 때 알림톡 또는 문자로 알려드립니다.",
      },
      {
        q: "접수번호를 잊어버렸어요.",
        a: `고객센터(${COMPANY.tel})로 문의해 주시면 본인 확인 절차를 거쳐 안내해 드립니다.`,
      },
      {
        q: "접수 후 언제 연락이 오나요?",
        a: "접수 확정 후 영업일 기준 1~2일 이내에 담당자가 연락드립니다. 신청이 몰리는 기간에는 다소 지연될 수 있으며, 진행 단계는 접수 조회 페이지에서 확인하실 수 있습니다.",
      },
    ],
  },
  {
    category: "캐시백 · 협약단체",
    items: [
      {
        q: "3% 캐시백은 누구에게 지급되나요?",
        a: "가입자가 아닌 협약단체에 지급됩니다. 소속 회원이 납입한 보험료의 3%를 단체에 정산해 드리며, 단체는 이를 회원 복지사업이나 운영 재원으로 활용합니다.",
      },
      {
        q: "캐시백은 언제, 어떻게 정산되나요?",
        a: "월별로 정산해 협약단체 계좌로 지급하며, 정산서를 함께 제공합니다. 성사 기준 시점과 중도 해지 시 환수 규정 등 구체적 정산 기준은 협약서에 명시됩니다.",
      },
      {
        q: "단체가 부담해야 하는 비용이 있나요?",
        a: "없습니다. 협약단체는 회원 안내만 담당하며 가입 접수·상담·정산은 모두 나무파트너스가 수행합니다.",
      },
    ],
  },
  {
    category: "개인정보 · 보안",
    items: [
      {
        q: "어떤 개인정보를 수집하나요?",
        a: "이름, 휴대폰 번호, 생년월일, 성별(선택), 소속 단체, 신청 상품만 수집합니다. 주민등록번호는 온라인 접수 단계에서 수집하지 않습니다.",
      },
      {
        q: "내 정보가 협약단체에 전달되나요?",
        a: "아닙니다. 협약단체에는 개인을 식별할 수 없는 집계 수치(신청 건수, 성사 건수, 캐시백 금액)만 제공됩니다.",
      },
      {
        q: "개인정보는 얼마나 보관되나요?",
        a: "접수일로부터 3년간 보관 후 파기합니다. 다만 관계 법령에 보존 의무가 규정된 경우 해당 기간 동안 보관합니다. 자세한 내용은 개인정보처리방침을 참고해 주세요.",
      },
    ],
  },
];

export default function FaqPage() {
  return (
    <div className="container-np max-w-3xl py-14 sm:py-20">
      <Reveal>
        <p className="eyebrow">FAQ</p>
        <h1 className="section-title mt-3">자주 묻는 질문</h1>
        <p className="mt-4 text-[15px] leading-relaxed text-muted">
          찾으시는 답변이 없다면 고객센터({COMPANY.tel})로 문의해 주세요.
        </p>
      </Reveal>

      <div className="mt-12 space-y-12">
        {GROUPS.map((group, gi) => (
          <section key={group.category}>
            <Reveal delay={gi * 60}>
              <h2 className="text-[17px] font-extrabold text-navy-900">
                {group.category}
              </h2>
            </Reveal>
            <div className="mt-4 space-y-3">
              {group.items.map((item, i) => (
                <Reveal key={item.q} delay={i * 50}>
                  <details className="group card cursor-pointer">
                    <summary className="flex list-none items-start justify-between gap-4 text-[15px] font-bold text-navy-900 [&::-webkit-details-marker]:hidden">
                      <span className="flex-1">{item.q}</span>
                      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-mist text-navy transition-transform group-open:rotate-45">
                        +
                      </span>
                    </summary>
                    <p className="mt-4 text-[14px] leading-relaxed text-muted">
                      {item.a}
                    </p>
                  </details>
                </Reveal>
              ))}
            </div>
          </section>
        ))}
      </div>

      <Reveal>
        <div className="card mt-14">
          <p className="text-[15px] font-bold text-navy-900">약관 및 정책</p>
          <ul className="mt-4 space-y-2.5 text-[14px]">
            <li>
              <Link href="/privacy" className="text-navy underline">
                개인정보처리방침
              </Link>
            </li>
            <li>
              <Link href="/terms" className="text-navy underline">
                이용약관
              </Link>
            </li>
          </ul>
        </div>
      </Reveal>

      <Reveal>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link href="/apply" className="btn-primary flex-1">
            내 보험료 확인하기
          </Link>
          <Link href="/status" className="btn-ghost flex-1">
            접수 조회하기
          </Link>
        </div>
      </Reveal>
    </div>
  );
}
