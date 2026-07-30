import type { Metadata } from "next";
import Reveal from "@/components/Reveal";
import CashbackSimulator from "@/components/partners/CashbackSimulator";
import PartnerInquiryForm from "@/components/partners/PartnerInquiryForm";
import { PARTNERS, PRODUCTS } from "@/lib/catalog";

export const metadata: Metadata = {
  title: "협약단체 안내",
  description:
    "회원에게는 절감을, 단체에는 재정을. 회원이 가입한 보험료의 3%를 단체에 캐시백으로 지급하는 협약 프로그램입니다.",
};

const PROCESS = [
  {
    step: "01",
    title: "협약 문의",
    body: "단체 정보와 담당자 연락처를 남겨 주시면 담당자가 연락드립니다.",
    duration: "즉시",
  },
  {
    step: "02",
    title: "조건 협의",
    body: "회원 규모·업종에 맞는 보장 구성과 캐시백 정산 기준을 협의합니다.",
    duration: "1~2주",
  },
  {
    step: "03",
    title: "협약 체결",
    body: "정산 기준, 해지 시 환수 규정 등을 명문화한 협약서를 체결합니다.",
    duration: "1주",
  },
  {
    step: "04",
    title: "회원 안내 개시",
    body: "단체 전용 링크·QR 코드를 발급해 드립니다. 안내문에 삽입해 배포하세요.",
    duration: "즉시",
  },
  {
    step: "05",
    title: "실적·캐시백 정산",
    body: "월별 가입 실적과 캐시백 내역을 대시보드와 정산서로 제공합니다.",
    duration: "매월",
  },
];

export default function PartnersPage() {
  const averagePremium = Math.round(
    PRODUCTS.reduce((sum, p) => sum + p.groupPremium, 0) / PRODUCTS.length
  );

  return (
    <>
      {/* 히어로 — 기획서 3.2 협약단체 대상 카피 */}
      <section className="relative overflow-hidden bg-navy-900 py-20 text-white sm:py-24">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(800px 400px at 70% 10%, rgba(185,154,91,0.22), transparent 62%)",
          }}
        />
        <div className="container-np relative">
          <Reveal>
            <p className="eyebrow">PARTNERSHIP</p>
            <h1 className="mt-4 text-balance text-[32px] font-extrabold leading-[1.2] tracking-[-0.03em] sm:text-[46px]">
              회원에게는 절감을,
              <br />
              <span className="text-gold-400">단체에는 재정을.</span>
            </h1>
            <p className="mt-6 max-w-2xl text-[16px] leading-relaxed text-white/70">
              회원이 가입한 보험료의 3%를 단체에 캐시백으로 지급합니다. 회원
              복지와 단체 재정확보를 한 번에 해결하는 협약 프로그램입니다.
            </p>
          </Reveal>

          <Reveal delay={120}>
            <dl className="mt-12 grid gap-4 sm:grid-cols-3">
              {[
                { k: "3%", label: "회원 납입 보험료 대비 캐시백" },
                { k: "0원", label: "단체가 부담하는 비용" },
                { k: "17.5%", label: "회원이 절감하는 평균 보험료" },
              ].map((item) => (
                <div key={item.label} className="glass">
                  <dd className="stat-figure text-[40px] text-gold-400">{item.k}</dd>
                  <dt className="mt-2 text-[13px] text-white/60">{item.label}</dt>
                </div>
              ))}
            </dl>
          </Reveal>
        </div>
      </section>

      {/* 캐시백 구조 도해 */}
      <section className="container-np py-20 sm:py-24">
        <Reveal>
          <p className="eyebrow">HOW CASHBACK WORKS</p>
          <h2 className="section-title mt-3">캐시백은 이렇게 돌아갑니다</h2>
        </Reveal>

        <div className="mt-12 grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
          <Reveal delay={80}>
            <div className="card h-full">
              <ol className="space-y-6">
                {[
                  {
                    from: "회원",
                    to: "보험사",
                    label: "보험료 납입",
                    desc: "단체 전용 요율로 설계사 경유 대비 평균 17.5% 저렴하게 납입",
                    tone: "navy",
                  },
                  {
                    from: "보험사",
                    to: "나무파트너스",
                    label: "단체 모집·관리 대가 지급",
                    desc: "개별 모집이 아닌 단체 일괄 접수 구조로 비용이 낮아짐",
                    tone: "navy",
                  },
                  {
                    from: "나무파트너스",
                    to: "협약단체",
                    label: "보험료의 3% 캐시백",
                    desc: "매월 정산해 협약단체 계좌로 지급, 정산서 함께 제공",
                    tone: "gold",
                  },
                ].map((flow, i) => (
                  <li key={flow.label} className="flex gap-4">
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[13px] font-extrabold text-white ${
                        flow.tone === "gold" ? "bg-gold" : "bg-navy"
                      }`}
                    >
                      {i + 1}
                    </span>
                    <div>
                      <p className="flex flex-wrap items-center gap-1.5 text-[13px] font-semibold text-muted">
                        <span className="rounded-md bg-mist px-2 py-0.5 text-navy-900">
                          {flow.from}
                        </span>
                        <span aria-hidden="true">→</span>
                        <span className="rounded-md bg-mist px-2 py-0.5 text-navy-900">
                          {flow.to}
                        </span>
                      </p>
                      <p className="mt-2 text-[15px] font-bold text-navy-900">
                        {flow.label}
                      </p>
                      <p className="mt-1 text-[13px] leading-relaxed text-muted">
                        {flow.desc}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>

              <div className="mt-8 rounded-xl border border-gold/30 bg-gold-50 p-4 text-[13px] leading-relaxed text-navy-900">
                <strong className="font-bold">단체가 부담하는 비용은 없습니다.</strong>{" "}
                협약단체는 회원 안내만 담당하며, 가입 접수·상담·정산은 모두
                나무파트너스가 수행합니다.
              </div>
            </div>
          </Reveal>

          <Reveal delay={160}>
            <CashbackSimulator averagePremium={averagePremium} />
          </Reveal>
        </div>
      </section>

      {/* 협약 절차 */}
      <section className="bg-mist py-20 sm:py-24">
        <div className="container-np">
          <Reveal>
            <p className="eyebrow">PROCESS</p>
            <h2 className="section-title mt-3">협약 절차</h2>
            <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-muted">
              문의부터 회원 안내 개시까지 통상 3~4주가 소요됩니다.
            </p>
          </Reveal>

          <ol className="mt-12 space-y-3">
            {PROCESS.map((item, i) => (
              <Reveal key={item.step} delay={i * 70} as="li">
                <div className="card flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
                  <span className="stat-figure shrink-0 text-[26px] text-gold-200">
                    {item.step}
                  </span>
                  <div className="flex-1">
                    <p className="text-[15px] font-bold text-navy-900">{item.title}</p>
                    <p className="mt-1 text-[13px] leading-relaxed text-muted">
                      {item.body}
                    </p>
                  </div>
                  <span className="chip shrink-0 self-start bg-navy-50 text-navy sm:self-center">
                    {item.duration}
                  </span>
                </div>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      {/* 단체에 제공되는 것 */}
      <section className="container-np py-20 sm:py-24">
        <Reveal>
          <p className="eyebrow">WHAT YOU GET</p>
          <h2 className="section-title mt-3">협약단체에 제공되는 것</h2>
        </Reveal>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              title: "단체 전용 초대 링크·QR",
              body: "회원 안내문·단체 카톡방에 삽입하면 유입 경로와 캐시백 귀속이 자동으로 추적됩니다.",
            },
            {
              title: "실적 대시보드",
              body: "신청 건수, 성사 건수, 누적 보험료, 예상 캐시백(3%)을 실시간으로 확인합니다.",
            },
            {
              title: "월별 정산서",
              body: "매월 캐시백 정산 내역을 조회하고 정산서를 내려받을 수 있습니다.",
            },
            {
              title: "회원 안내 자료",
              body: "단체 로고가 반영된 안내문·포스터·문자 문안을 제작해 제공합니다.",
            },
            {
              title: "전담 상담 창구",
              body: "회원 문의를 응대하는 전담 상담 인력이 배정되어 단체의 업무 부담이 없습니다.",
            },
            {
              title: "투명한 정산 기준",
              body: "성사 기준 시점과 해지 시 환수 규정을 협약서에 명문화하고 대시보드 수치와 일치시킵니다.",
            },
          ].map((item, i) => (
            <Reveal key={item.title} delay={i * 60}>
              <div className="card h-full">
                <p className="text-[15px] font-bold text-navy-900">{item.title}</p>
                <p className="mt-2 text-[13px] leading-relaxed text-muted">
                  {item.body}
                </p>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal>
          <p className="mt-8 text-[12px] leading-relaxed text-muted">
            * 실적 대시보드와 월별 정산서는 오픈 후 순차 제공됩니다. 제공 시점은
            협약 시 안내해 드립니다.
          </p>
        </Reveal>
      </section>

      {/* 현재 협약단체 */}
      <section className="border-y border-line bg-mist py-16">
        <div className="container-np">
          <Reveal>
            <h2 className="text-center text-[15px] font-bold text-navy-900">
              현재 {PARTNERS.filter((p) => p.active).length}개 단체가 함께하고 있습니다
            </h2>
          </Reveal>
          <ul className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {PARTNERS.filter((p) => p.active).map((partner, i) => (
              <Reveal key={partner.code} delay={i * 60} as="li">
                <div className="flex h-full flex-col items-center justify-center rounded-xl border border-line bg-white px-4 py-6 text-center">
                  <p className="text-[13px] font-bold leading-snug text-navy-900">
                    {partner.name}
                  </p>
                  <p className="mt-1 text-[11px] text-muted">
                    회원 {partner.memberCount.toLocaleString("ko-KR")}명
                  </p>
                </div>
              </Reveal>
            ))}
          </ul>
        </div>
      </section>

      {/* 협약 문의 폼 */}
      <section id="inquiry" className="container-np scroll-mt-20 py-20 sm:py-24">
        <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr]">
          <Reveal>
            <p className="eyebrow">CONTACT</p>
            <h2 className="section-title mt-3">우리 단체도 함께할 수 있나요?</h2>
            <p className="mt-4 text-[15px] leading-relaxed text-muted">
              회원 수 100명 이상의 협회·조합·기업이면 협약 검토가 가능합니다.
              담당자가 영업일 기준 2일 이내에 연락드립니다.
            </p>
            <ul className="mt-8 space-y-3 text-[14px] text-muted">
              <li className="flex gap-2.5">
                <span className="text-gold">✓</span> 단체 부담 비용 없음
              </li>
              <li className="flex gap-2.5">
                <span className="text-gold">✓</span> 회원 개인정보는 나무파트너스가 직접 수집·관리
              </li>
              <li className="flex gap-2.5">
                <span className="text-gold">✓</span> 협약 해지 시 별도 위약금 없음
              </li>
            </ul>
          </Reveal>

          <Reveal delay={120}>
            <PartnerInquiryForm />
          </Reveal>
        </div>
      </section>
    </>
  );
}
