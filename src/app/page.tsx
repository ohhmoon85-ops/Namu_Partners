import Link from "next/link";
import Reveal from "@/components/Reveal";
import CountUp from "@/components/CountUp";
import StickyCta from "@/components/StickyCta";
import { PARTNERS, PRODUCTS, averageSavingRate, savingRate } from "@/lib/catalog";
import { getPublicStats } from "@/lib/store";
import { COMPANY } from "@/lib/company";
import { number, percent, won } from "@/lib/format";

// 신뢰 지표 카운터가 실적을 반영해야 하므로 매 요청 시 렌더링한다.
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const stats = await getPublicStats();
  const avgRate = averageSavingRate();
  const memberTotal = PARTNERS.reduce((sum, p) => sum + p.memberCount, 0);

  return (
    <>
      <Hero avgRate={avgRate} />
      <TrustBar stats={stats} memberTotal={memberTotal} />
      <SavingPrinciple />
      <ProductSection />
      <CashbackSection />
      <ProcessSection />
      <PartnerWall />
      <FaqTeaser />
      <FinalCta />
      <StickyCta />
    </>
  );
}

/* ─────────────────────────── 히어로 (기획서 3.1) ─────────────────────────── */

function Hero({ avgRate }: { avgRate: number }) {
  return (
    <section className="relative overflow-hidden bg-navy-900">
      {/* 미세한 그라데이션 배경 — 기획서 5.1 그래픽 방향 */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(900px 480px at 78% 8%, rgba(185,154,91,0.22), transparent 60%), radial-gradient(700px 420px at 8% 92%, rgba(46,78,134,0.55), transparent 62%)",
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-gold/50 to-transparent"
      />

      <div className="container-np relative py-20 sm:py-28">
        <div className="grid items-center gap-14 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <Reveal>
              <span className="chip border border-gold/40 bg-gold/10 text-gold-400">
                협약단체 전용 프로모션
              </span>
            </Reveal>

            <Reveal delay={80}>
              <h1 className="mt-6 text-balance text-[34px] font-extrabold leading-[1.18] tracking-[-0.03em] text-white sm:text-[52px]">
                같은 보험,
                <br />
                <span className="text-gold-400">더 가벼운 보험료.</span>
              </h1>
            </Reveal>

            <Reveal delay={160}>
              <p className="mt-6 text-[17px] leading-relaxed text-white/70 sm:text-lg">
                설계사 가입 대비 평균{" "}
                <strong className="font-bold text-white">17.5% 절감</strong>.
                <br className="hidden sm:block" /> 단체의 힘으로 누리는 합리적인 보험
                &mdash; 나무파트너스
              </p>
            </Reveal>

            <Reveal delay={240}>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <Link href="/apply" className="btn-gold w-full sm:w-auto">
                  내 보험료 확인하기
                  <ArrowIcon />
                </Link>
                <Link
                  href="/partners"
                  className="btn w-full border border-white/25 text-white hover:bg-white/10 sm:w-auto"
                >
                  협약단체로 참여하기
                </Link>
              </div>
            </Reveal>

            <Reveal delay={300}>
              <p className="mt-6 text-[12px] leading-relaxed text-white/45">
                * 평균 절감률은 {COMPANY.savingBasis.period} 기준{" "}
                {COMPANY.savingBasis.sample}을 비교한 값이며, 개인 조건에 따라
                달라질 수 있습니다.
              </p>
            </Reveal>
          </div>

          {/* 핵심 수치 카드 — 17.5% / 3% */}
          <Reveal delay={200} className="lg:justify-self-end">
            <div className="grid gap-4 sm:grid-cols-2 lg:max-w-md lg:grid-cols-1">
              <div className="glass">
                <p className="text-sm font-semibold text-white/60">
                  가입자가 아끼는 보험료
                </p>
                <p className="mt-2 flex items-baseline gap-1 text-white">
                  <span className="stat-figure text-[68px] sm:text-[84px]">
                    {avgRate.toFixed(1)}
                  </span>
                  <span className="text-[30px] font-extrabold text-gold-400">%</span>
                </p>
                <p className="mt-1 text-sm text-white/60">
                  설계사 경유 가입 대비 · 동일 보장
                </p>
              </div>

              <div className="glass">
                <p className="text-sm font-semibold text-white/60">
                  협약단체가 받는 캐시백
                </p>
                <p className="mt-2 flex items-baseline gap-1 text-white">
                  <span className="stat-figure text-[68px] sm:text-[84px]">3</span>
                  <span className="text-[30px] font-extrabold text-gold-400">%</span>
                </p>
                <p className="mt-1 text-sm text-white/60">
                  소속 회원이 납입한 보험료 기준
                </p>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* ─────────────── 신뢰 지표 (기획서 3.3 · 5.1 실적 카운터) ─────────────── */

function TrustBar({
  stats,
  memberTotal,
}: {
  stats: Awaited<ReturnType<typeof getPublicStats>>;
  memberTotal: number;
}) {
  const items = [
    { label: "협약 단체", value: stats.partnerCount, suffix: "개" },
    { label: "협약단체 회원", value: memberTotal, suffix: "명" },
    { label: "누적 가입 신청", value: stats.applicationCount, suffix: "건" },
    {
      label: "누적 절감액(연환산)",
      value: stats.totalSaving,
      suffix: "원",
    },
  ];

  return (
    <section className="border-b border-line bg-mist">
      <div className="container-np py-12">
        <Reveal>
          <p className="text-center text-[15px] font-semibold text-navy-900">
            이미 <span className="text-gold">{number(stats.partnerCount)}개 단체</span>,{" "}
            <span className="text-gold">{number(memberTotal)}명</span>의 회원이
            함께하고 있습니다
          </p>
        </Reveal>
        <dl className="mt-8 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-4">
          {items.map((item, i) => (
            <Reveal key={item.label} delay={i * 70}>
              <div className="text-center">
                <dd className="stat-figure text-[26px] text-navy-900 sm:text-[32px]">
                  <CountUp value={item.value} suffix={item.suffix} />
                </dd>
                <dt className="mt-1.5 text-[13px] font-medium text-muted">
                  {item.label}
                </dt>
              </div>
            </Reveal>
          ))}
        </dl>
      </div>
    </section>
  );
}

/* ──────────────── 절감 원리 인포그래픽 (기획서 4.1) ──────────────── */

function SavingPrinciple() {
  return (
    <section id="saving" className="container-np scroll-mt-20 py-20 sm:py-28">
      <Reveal>
        <p className="eyebrow">HOW IT WORKS</p>
        <h2 className="section-title mt-3">보장은 그대로, 보험료만 다이어트</h2>
        <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-muted sm:text-base">
          보험료가 낮아지는 이유는 보장을 줄여서가 아닙니다. 개별 가입 시
          발생하던 모집·관리 비용을 단체 단위로 묶어 구조적으로 덜어내기
          때문입니다.
        </p>
      </Reveal>

      <div className="mt-12 grid gap-5 lg:grid-cols-2">
        <Reveal delay={80}>
          <div className="card h-full border-line/80">
            <span className="chip bg-mist text-muted">기존 · 설계사 경유 개별 가입</span>
            <p className="mt-5 text-[15px] font-bold text-navy-900">
              보험료에 포함되는 비용
            </p>
            <ul className="mt-4 space-y-3">
              {[
                { label: "순보험료 (실제 보장 재원)", width: 72, tone: "base" },
                { label: "설계사 모집수수료", width: 18, tone: "cost" },
                { label: "개별 심사·관리 비용", width: 10, tone: "cost" },
              ].map((row) => (
                <li key={row.label}>
                  <div className="flex items-center justify-between text-[13px]">
                    <span className="text-muted">{row.label}</span>
                    <span className="font-semibold text-navy-900">{row.width}%</span>
                  </div>
                  <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-mist">
                    <div
                      className={`h-full rounded-full ${
                        row.tone === "cost" ? "bg-red-300" : "bg-navy-300"
                      }`}
                      style={{ width: `${row.width}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
            <p className="mt-6 rounded-xl bg-mist p-4 text-[13px] leading-relaxed text-muted">
              한 사람씩 따로 모집하고 따로 심사하므로, 보장과 무관한 비용이
              보험료에 그대로 반영됩니다.
            </p>
          </div>
        </Reveal>

        <Reveal delay={160}>
          <div className="card h-full border-gold/40 bg-gold-50/40">
            <span className="chip bg-gold text-white">나무파트너스 · 단체 가입</span>
            <p className="mt-5 text-[15px] font-bold text-navy-900">
              단체 단위로 덜어낸 구조
            </p>
            <ul className="mt-4 space-y-3">
              {[
                { label: "순보험료 (실제 보장 재원)", width: 72, tone: "base" },
                { label: "단체 일괄 접수·관리 비용", width: 7, tone: "ok" },
                { label: "협약단체 캐시백 재원", width: 3, tone: "gold" },
              ].map((row) => (
                <li key={row.label}>
                  <div className="flex items-center justify-between text-[13px]">
                    <span className="text-muted">{row.label}</span>
                    <span className="font-semibold text-navy-900">{row.width}%</span>
                  </div>
                  <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-white">
                    <div
                      className={`h-full rounded-full ${
                        row.tone === "gold"
                          ? "bg-gold"
                          : row.tone === "ok"
                            ? "bg-emerald-400"
                            : "bg-navy"
                      }`}
                      style={{ width: `${row.width}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
            <p className="mt-6 rounded-xl border border-gold/30 bg-white p-4 text-[13px] leading-relaxed text-navy-900">
              <strong className="font-bold">
                덜어낸 약 17.5%는 보험료 인하로, 3%는 협약단체 캐시백으로
              </strong>{" "}
              돌아갑니다. 보장 내용과 약관은 설계사 가입과 동일합니다.
            </p>
          </div>
        </Reveal>
      </div>

      <Reveal delay={220}>
        <p className="mt-6 text-[12px] leading-relaxed text-muted">
          * 위 비율은 절감 구조를 설명하기 위한 개념도이며, 실제 사업비 구성은
          보험사·상품별로 다릅니다.
        </p>
      </Reveal>
    </section>
  );
}

/* ────────────── 상품별 절감액 비교 (기획서 4.2 2단계) ────────────── */

function ProductSection() {
  return (
    <section id="products" className="scroll-mt-20 bg-mist py-20 sm:py-28">
      <div className="container-np">
        <Reveal>
          <p className="eyebrow">PRODUCTS</p>
          <h2 className="section-title mt-3">혼자 가입하면 정가, 함께 가입하면 특가</h2>
          <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-muted sm:text-base">
            협약단체 회원에게 제공되는 단체 전용 보험료입니다. 설계사 경유
            보험료와 나란히 비교해 보세요.
          </p>
        </Reveal>

        <div className="mt-12 grid gap-5 sm:grid-cols-2">
          {PRODUCTS.map((product, i) => {
            const monthlySaving = product.designerPremium - product.groupPremium;
            return (
              <Reveal key={product.id} delay={i * 80}>
                <article className="card flex h-full flex-col">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-[17px] font-bold text-navy-900">
                        {product.name}
                      </h3>
                      <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
                        {product.summary}
                      </p>
                    </div>
                    <span className="chip shrink-0 bg-navy text-white">
                      {percent(savingRate(product))} ↓
                    </span>
                  </div>

                  <ul className="mt-5 grid gap-2 border-y border-line py-4">
                    {product.coverages.map((c) => (
                      <li
                        key={c.label}
                        className="flex items-center justify-between text-[13px]"
                      >
                        <span className="text-muted">{c.label}</span>
                        <span className="font-semibold text-navy-900">{c.amount}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-5 flex items-end justify-between gap-4">
                    <div>
                      <p className="text-[12px] text-muted">설계사 경유</p>
                      <p className="text-[15px] font-medium text-muted line-through">
                        {won(product.designerPremium)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[12px] font-semibold text-gold">단체 전용가</p>
                      <p className="text-[26px] font-extrabold leading-tight text-navy-900">
                        {won(product.groupPremium)}
                        <span className="text-[13px] font-semibold text-muted"> /월</span>
                      </p>
                    </div>
                  </div>

                  <p className="mt-3 rounded-lg bg-gold-50 px-3 py-2 text-center text-[13px] font-semibold text-navy-900">
                    매월 {won(monthlySaving)} · 연 {won(monthlySaving * 12)} 절감
                  </p>

                  <p className="mt-4 text-[12px] leading-relaxed text-muted">
                    가입 조건 · {product.eligibility}
                  </p>

                  <Link
                    href={`/apply?product=${product.id}`}
                    className="btn-ghost mt-5 w-full"
                  >
                    이 상품으로 신청하기
                  </Link>
                </article>
              </Reveal>
            );
          })}
        </div>

        <Reveal>
          <p className="mt-8 text-[12px] leading-relaxed text-muted">
            * 표기 보험료는 40세 남성·표준체 기준 예시이며, 실제 보험료는 연령·성별·직업·가입
            담보에 따라 달라집니다. 최종 보험료는 상담 단계에서 안내됩니다.
          </p>
        </Reveal>
      </div>
    </section>
  );
}

/* ───────────── 협약단체 캐시백 구조 도해 (기획서 3.2 · 4.1) ───────────── */

function CashbackSection() {
  const steps = [
    {
      title: "협약 체결",
      body: "단체와 나무파트너스가 단체보험 프로모션 협약을 체결합니다.",
    },
    {
      title: "회원 안내",
      body: "단체 전용 링크·QR로 소속 회원에게 가입을 안내합니다.",
    },
    {
      title: "회원 가입",
      body: "회원은 동일 보장을 평균 17.5% 저렴한 보험료로 가입합니다.",
    },
    {
      title: "3% 캐시백",
      body: "회원이 납입한 보험료의 3%를 단체에 정산·지급합니다.",
    },
  ];

  return (
    <section id="cashback" className="scroll-mt-20 bg-navy py-20 text-white sm:py-28">
      <div className="container-np">
        <div className="grid gap-14 lg:grid-cols-[0.9fr_1.1fr]">
          <Reveal>
            <p className="eyebrow">FOR PARTNERS</p>
            <h2 className="mt-3 text-balance text-[26px] font-extrabold leading-tight tracking-tight sm:text-[34px]">
              회원에게는 절감을,
              <br />
              단체에는 재정을.
            </h2>
            <p className="mt-5 text-[15px] leading-relaxed text-white/70">
              회원이 가입한 보험료의{" "}
              <strong className="font-bold text-gold-400">3%를 단체에 캐시백</strong>
              합니다. 회원 복지와 단체 재정확보를 한 번에 해결하는 협약
              프로그램입니다.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/partners" className="btn-gold">
                협약 문의하기
              </Link>
              <Link
                href="/partners#simulator"
                className="btn border border-white/25 text-white hover:bg-white/10"
              >
                캐시백 계산해 보기
              </Link>
            </div>
          </Reveal>

          <Reveal delay={120}>
            <ol className="relative space-y-4">
              {steps.map((step, i) => (
                <li key={step.title} className="glass flex gap-4">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gold text-sm font-extrabold text-white">
                    {i + 1}
                  </span>
                  <div>
                    <p className="text-[15px] font-bold">{step.title}</p>
                    <p className="mt-1 text-[13px] leading-relaxed text-white/65">
                      {step.body}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* ───────────────── 가입 절차 안내 (기획서 4.1 · 4.2) ───────────────── */

function ProcessSection() {
  const steps = [
    { no: "01", title: "소속 단체 선택", body: "단체 목록에서 선택하거나 단체 코드를 입력합니다." },
    { no: "02", title: "상품 선택", body: "설계사 가격 대비 절감액을 확인하고 상품을 고릅니다." },
    { no: "03", title: "정보 입력·동의", body: "이름·연락처·생년월일만 입력합니다. 주민번호는 받지 않습니다." },
    { no: "04", title: "접수 완료", body: "접수번호가 발급되며, 신청이 몰릴 경우 대기실로 안내됩니다." },
    { no: "05", title: "상담·청약", body: "담당자가 연락드려 청약 절차를 진행합니다." },
  ];

  return (
    <section className="container-np py-20 sm:py-28">
      <Reveal>
        <p className="eyebrow">PROCESS</p>
        <h2 className="section-title mt-3">신청은 3분, 절차는 5단계</h2>
      </Reveal>

      <ol className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {steps.map((step, i) => (
          <Reveal key={step.no} delay={i * 70} as="li">
            <div className="card h-full">
              <span className="stat-figure text-[28px] text-gold-200">{step.no}</span>
              <p className="mt-3 text-[15px] font-bold text-navy-900">{step.title}</p>
              <p className="mt-2 text-[13px] leading-relaxed text-muted">{step.body}</p>
            </div>
          </Reveal>
        ))}
      </ol>
    </section>
  );
}

/* ───────────────── 협약단체 로고 월 (기획서 5.1) ───────────────── */

function PartnerWall() {
  return (
    <section className="border-y border-line bg-mist py-16">
      <div className="container-np">
        <Reveal>
          <p className="text-center text-[13px] font-semibold uppercase tracking-[0.18em] text-muted">
            함께하는 협약단체
          </p>
        </Reveal>
        <ul className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {PARTNERS.filter((p) => p.active).map((partner, i) => (
            <Reveal key={partner.code} delay={i * 60} as="li">
              <div className="flex h-full flex-col items-center justify-center rounded-xl border border-line bg-white px-4 py-6 text-center">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-navy-50 text-[13px] font-extrabold text-navy">
                  {partner.name.slice(0, 2)}
                </span>
                <p className="mt-3 text-[13px] font-bold leading-snug text-navy-900">
                  {partner.name}
                </p>
                <p className="mt-1 text-[11px] text-muted">{partner.category}</p>
              </div>
            </Reveal>
          ))}
        </ul>
        <Reveal>
          <p className="mt-6 text-center text-[12px] text-muted">
            * 협약단체 목록은 협약 체결 현황에 따라 갱신됩니다.
          </p>
        </Reveal>
      </div>
    </section>
  );
}

/* ───────────────────────── FAQ 미리보기 ───────────────────────── */

const HOME_FAQ = [
  {
    q: "보험료가 저렴하면 보장도 줄어드나요?",
    a: "아닙니다. 동일한 보험사의 동일한 약관·동일한 보장으로 가입합니다. 개별 모집 과정에서 발생하던 비용을 단체 단위로 줄인 것이므로 보장 내용에는 차이가 없습니다.",
  },
  {
    q: "협약단체 회원이 아니어도 가입할 수 있나요?",
    a: "본 프로모션은 협약단체 소속 회원을 대상으로 운영됩니다. 소속 단체가 아직 협약을 맺지 않았다면 협약 문의 페이지를 통해 단체 담당자께 안내해 주세요.",
  },
  {
    q: "신청하면 바로 보험에 가입되나요?",
    a: "신청은 가입 상담 접수입니다. 접수 후 담당자가 연락드려 보장 내용과 보험료를 안내하고, 최종 청약은 관련 법령에 따른 유자격 모집조직을 통해 진행됩니다.",
  },
];

function FaqTeaser() {
  return (
    <section className="container-np py-20 sm:py-28">
      <Reveal>
        <p className="eyebrow">FAQ</p>
        <h2 className="section-title mt-3">자주 묻는 질문</h2>
      </Reveal>

      <div className="mt-10 space-y-3">
        {HOME_FAQ.map((item, i) => (
          <Reveal key={item.q} delay={i * 70}>
            <details className="group card cursor-pointer">
              <summary className="flex list-none items-center justify-between gap-4 text-[15px] font-bold text-navy-900 [&::-webkit-details-marker]:hidden">
                {item.q}
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-mist text-navy transition-transform group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="mt-4 text-[14px] leading-relaxed text-muted">{item.a}</p>
            </details>
          </Reveal>
        ))}
      </div>

      <Reveal>
        <Link href="/faq" className="btn-ghost mt-8">
          전체 FAQ 보기
        </Link>
      </Reveal>
    </section>
  );
}

/* ───────────────────────── 최종 CTA ───────────────────────── */

function FinalCta() {
  return (
    <section className="container-np pb-24 sm:pb-32">
      <Reveal>
        <div className="relative overflow-hidden rounded-3xl bg-navy-900 px-6 py-16 text-center sm:px-12">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(600px 300px at 50% 0%, rgba(185,154,91,0.25), transparent 65%)",
            }}
          />
          <div className="relative">
            <h2 className="text-balance text-[26px] font-extrabold leading-tight text-white sm:text-[34px]">
              우리 단체도 함께할 수 있나요?
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-white/65">
              회원 수 100명 이상이면 협약 검토가 가능합니다. 회원에게는 보험료
              절감을, 단체에는 3% 캐시백을 제공하세요.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Link href="/apply" className="btn-gold">
                내 보험료 확인하기
              </Link>
              <Link
                href="/partners"
                className="btn border border-white/25 text-white hover:bg-white/10"
              >
                협약 문의하기
              </Link>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

function ArrowIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M4 10h11m0 0-4.2-4.2M15 10l-4.2 4.2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
