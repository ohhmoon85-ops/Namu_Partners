"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { COMPANY } from "@/lib/company";

export default function SiteFooter() {
  const pathname = usePathname();
  if (pathname?.startsWith("/admin")) return null;

  return (
    <footer className="mt-24 border-t border-line bg-mist">
      <div className="container-np py-14">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <p className="text-[17px] font-extrabold tracking-tight text-navy-900">
              나무파트너스
            </p>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted">
              단체의 힘으로 누리는 합리적인 보험. 협약단체와 회원 모두에게
              이로운 상생형 단체보험 프로모션을 운영합니다.
            </p>
          </div>

          <nav aria-label="바로가기">
            <p className="text-sm font-bold text-navy-900">바로가기</p>
            <ul className="mt-3 space-y-2.5 text-sm text-muted">
              <li><Link href="/apply" className="hover:text-navy">보험 가입 신청</Link></li>
              <li><Link href="/status" className="hover:text-navy">접수 조회</Link></li>
              <li><Link href="/partners" className="hover:text-navy">협약단체 안내</Link></li>
              <li><Link href="/faq" className="hover:text-navy">자주 묻는 질문</Link></li>
            </ul>
          </nav>

          <nav aria-label="약관 및 정책">
            <p className="text-sm font-bold text-navy-900">약관·정책</p>
            <ul className="mt-3 space-y-2.5 text-sm text-muted">
              <li><Link href="/privacy" className="hover:text-navy">개인정보처리방침</Link></li>
              <li><Link href="/terms" className="hover:text-navy">이용약관</Link></li>
              <li><Link href="/admin" className="hover:text-navy">관리자</Link></li>
            </ul>
          </nav>
        </div>

        {/* 기획서 5.1 신뢰 장치 · 9장 법적 고지 */}
        <div className="mt-12 border-t border-line pt-8">
          <dl className="grid gap-x-8 gap-y-2 text-[13px] text-muted sm:grid-cols-2">
            <div className="flex gap-2">
              <dt className="shrink-0 font-semibold text-navy-900/80">상호</dt>
              <dd>{COMPANY.name}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="shrink-0 font-semibold text-navy-900/80">대표자</dt>
              <dd>{COMPANY.ceo}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="shrink-0 font-semibold text-navy-900/80">사업자등록번호</dt>
              <dd>{COMPANY.businessNumber}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="shrink-0 font-semibold text-navy-900/80">등록번호</dt>
              <dd>{COMPANY.licenseNumber}</dd>
            </div>
            <div className="flex gap-2 sm:col-span-2">
              <dt className="shrink-0 font-semibold text-navy-900/80">주소</dt>
              <dd>{COMPANY.address}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="shrink-0 font-semibold text-navy-900/80">고객센터</dt>
              <dd>{COMPANY.tel} (평일 09:00~18:00)</dd>
            </div>
            <div className="flex gap-2">
              <dt className="shrink-0 font-semibold text-navy-900/80">개인정보 보호책임자</dt>
              <dd>{COMPANY.privacyOfficer}</dd>
            </div>
          </dl>

          <div className="mt-8 space-y-2 rounded-xl border border-line bg-white p-5 text-[12px] leading-relaxed text-muted">
            <p>
              ※ 본 페이지의 &ldquo;평균 17.5% 절감&rdquo; 표기는 {COMPANY.savingBasis.period} 기준,
              {" "}{COMPANY.savingBasis.sample} 표본에 대해 동일 보장·동일 조건의
              설계사 경유 개별 가입 보험료와 협약단체 단체 가입 보험료를 비교한
              평균값입니다. 개인의 연령·성별·직업·가입 담보에 따라 실제 절감률은
              달라질 수 있습니다.
            </p>
            <p>
              ※ 본 플랫폼은 단체보험 가입 안내 및 접수를 지원하는 채널이며, 보험 계약의
              체결(청약)은 관련 법령에 따른 유자격 모집조직을 통해 진행됩니다.
            </p>
            <p>
              ※ 보험계약자는 보험계약 체결 전 상품설명서 및 약관을 반드시 확인하시기
              바랍니다. 기존 계약을 해지하고 새로운 계약을 체결할 경우 인수가 거절되거나
              보험료가 인상될 수 있습니다.
            </p>
            <p className="font-semibold text-navy-900/70">
              준법감시인 확인필 {COMPANY.complianceNumber}
            </p>
          </div>

          <p className="mt-8 text-[12px] text-muted">
            © {new Date().getFullYear()} {COMPANY.name}. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
