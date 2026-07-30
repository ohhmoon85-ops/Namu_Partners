"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { Partner, Product } from "@/lib/types";
import { formatBirth, formatPhone, percent, won } from "@/lib/format";
import {
  collectErrors,
  validateBirth,
  validateName,
  validatePhone,
  type FieldErrors,
} from "@/lib/validation";
import { CASHBACK_RATE, savingRate } from "@/lib/catalog";

const STEPS = ["소속 단체", "상품 선택", "정보 입력", "동의·접수"] as const;

interface Props {
  partners: Partner[];
  products: Product[];
  /** 링크 파라미터로 미리 지정된 값 (기획서 5.2 단체 코드 자동 인식) */
  initialPartnerCode: string;
  initialProductId: string;
}

export default function ApplyWizard({
  partners,
  products,
  initialPartnerCode,
  initialProductId,
}: Props) {
  const router = useRouter();

  // 링크로 단체가 지정돼 들어온 경우 1단계를 건너뛴다.
  const [step, setStep] = useState(initialPartnerCode ? (initialProductId ? 2 : 1) : 0);
  const [partnerCode, setPartnerCode] = useState(initialPartnerCode);
  const [codeInput, setCodeInput] = useState("");
  const [codeError, setCodeError] = useState("");
  const [productId, setProductId] = useState(initialProductId);

  const [form, setForm] = useState({
    name: "",
    phone: "",
    birth: "",
    gender: "" as "M" | "F" | "",
  });
  const [agree, setAgree] = useState({
    privacy: false,
    notify: true,
    marketing: false,
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const partner = useMemo(
    () => partners.find((p) => p.code === partnerCode),
    [partners, partnerCode]
  );
  const product = useMemo(
    () => products.find((p) => p.id === productId),
    [products, productId]
  );

  function applyCode() {
    const code = codeInput.trim().toUpperCase();
    const found = partners.find((p) => p.code === code);
    if (!found) {
      setCodeError("일치하는 단체 코드가 없습니다. 단체 담당자에게 확인해 주세요.");
      return;
    }
    setCodeError("");
    setPartnerCode(found.code);
    setStep(1);
  }

  function validateInfoStep(): boolean {
    const found = collectErrors({
      name: validateName(form.name),
      phone: validatePhone(form.phone),
      birth: validateBirth(form.birth),
    });
    setErrors(found ?? {});
    return found === null;
  }

  function goNext() {
    setSubmitError("");
    if (step === 0) {
      if (!partnerCode) {
        setCodeError("소속 단체를 선택하거나 단체 코드를 입력해 주세요.");
        return;
      }
      setStep(1);
      return;
    }
    if (step === 1) {
      if (!productId) return;
      setStep(2);
      return;
    }
    if (step === 2) {
      if (!validateInfoStep()) return;
      setStep(3);
    }
  }

  async function submit() {
    if (!agree.privacy) {
      setSubmitError("개인정보 수집·이용에 동의해 주셔야 접수가 가능합니다.");
      return;
    }
    if (!partnerCode || !productId || !validateInfoStep()) {
      setSubmitError("입력 내용을 다시 확인해 주세요.");
      setStep(2);
      return;
    }

    setSubmitting(true);
    setSubmitError("");
    try {
      const res = await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          partnerCode,
          productId,
          name: form.name.trim(),
          phone: form.phone,
          birth: form.birth,
          gender: form.gender,
          privacyAgreed: agree.privacy,
          notifyOptIn: agree.notify,
          marketingOptIn: agree.marketing,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        if (data.fields) setErrors(data.fields);
        setSubmitError(data.error || "접수 중 오류가 발생했습니다.");
        setSubmitting(false);
        return;
      }
      // 접수 완료 → 대기실로 이동 (기획서 4.2 4단계)
      router.push(`/waiting/${data.ticket}`);
    } catch {
      setSubmitError("네트워크 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");
      setSubmitting(false);
    }
  }

  const canProceed =
    (step === 0 && !!partnerCode) ||
    (step === 1 && !!productId) ||
    step === 2 ||
    (step === 3 && agree.privacy);

  return (
    <div className="pb-36">
      <StepIndicator current={step} />

      <div className="container-np mt-8 max-w-2xl">
        {step === 0 && (
          <StepPartner
            partners={partners}
            partnerCode={partnerCode}
            onSelect={(code) => {
              setPartnerCode(code);
              setCodeError("");
            }}
            codeInput={codeInput}
            setCodeInput={setCodeInput}
            codeError={codeError}
            onApplyCode={applyCode}
          />
        )}

        {step === 1 && (
          <StepProduct
            products={products}
            productId={productId}
            onSelect={setProductId}
            partnerName={partner?.name ?? ""}
          />
        )}

        {step === 2 && (
          <StepInfo form={form} setForm={setForm} errors={errors} />
        )}

        {step === 3 && (
          <StepConfirm
            partner={partner}
            product={product}
            form={form}
            agree={agree}
            setAgree={setAgree}
            submitError={submitError}
          />
        )}
      </div>

      {/* 하단 고정 액션 바 — 기획서 5.2 */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-3 backdrop-blur-md">
        <div className="container-np flex max-w-2xl items-center gap-3">
          {step > 0 && (
            <button
              type="button"
              onClick={() => {
                setStep((s) => s - 1);
                setSubmitError("");
              }}
              className="btn-ghost !px-5"
              disabled={submitting}
            >
              이전
            </button>
          )}
          {step < 3 ? (
            <button
              type="button"
              onClick={goNext}
              disabled={!canProceed}
              className="btn-primary flex-1"
            >
              다음
            </button>
          ) : (
            <button
              type="button"
              onClick={submit}
              disabled={submitting || !agree.privacy}
              className="btn-gold flex-1"
            >
              {submitting ? "접수 중…" : "동의하고 접수하기"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────── 단계 표시 ─────────────────────────── */

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="border-b border-line bg-white">
      <div className="container-np max-w-2xl py-5">
        <div className="flex items-center justify-between text-[12px] font-semibold">
          {STEPS.map((label, i) => {
            const state = i < current ? "done" : i === current ? "active" : "todo";
            return (
              <div key={label} className="flex flex-1 items-center gap-2">
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px] ${
                    state === "done"
                      ? "bg-navy text-white"
                      : state === "active"
                        ? "bg-gold text-white"
                        : "bg-mist text-muted"
                  }`}
                >
                  {state === "done" ? "✓" : i + 1}
                </span>
                <span
                  className={`hidden sm:block ${
                    state === "todo" ? "text-muted" : "text-navy-900"
                  }`}
                >
                  {label}
                </span>
                {i < STEPS.length - 1 && (
                  <span
                    className={`mx-1 h-px flex-1 ${
                      i < current ? "bg-navy" : "bg-line"
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-[13px] font-bold text-navy-900 sm:hidden">
          {current + 1}단계 · {STEPS[current]}
        </p>
      </div>
    </div>
  );
}

/* ─────────────────────── 1단계 · 소속 단체 선택 ─────────────────────── */

function StepPartner({
  partners,
  partnerCode,
  onSelect,
  codeInput,
  setCodeInput,
  codeError,
  onApplyCode,
}: {
  partners: Partner[];
  partnerCode: string;
  onSelect: (code: string) => void;
  codeInput: string;
  setCodeInput: (v: string) => void;
  codeError: string;
  onApplyCode: () => void;
}) {
  return (
    <section>
      <h1 className="text-[22px] font-extrabold tracking-tight text-navy-900">
        어느 단체를 통해 가입하시나요?
      </h1>
      <p className="mt-2 text-[14px] leading-relaxed text-muted">
        선택하신 단체로 캐시백이 귀속됩니다. 소속 단체를 정확히 선택해 주세요.
      </p>

      <ul className="mt-6 space-y-2.5">
        {partners.map((partner) => {
          const selected = partner.code === partnerCode;
          return (
            <li key={partner.code}>
              <button
                type="button"
                onClick={() => onSelect(partner.code)}
                aria-pressed={selected}
                className={`flex w-full items-center gap-4 rounded-2xl border p-4 text-left transition-all ${
                  selected
                    ? "border-navy bg-navy-50"
                    : "border-line bg-white hover:border-navy-300"
                }`}
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-navy-50 text-[13px] font-extrabold text-navy">
                  {partner.name.slice(0, 2)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-bold text-navy-900">
                    {partner.name}
                  </span>
                  <span className="block text-[12px] text-muted">
                    {partner.category} · 회원 {partner.memberCount.toLocaleString("ko-KR")}명
                  </span>
                </span>
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                    selected ? "border-navy bg-navy" : "border-line"
                  }`}
                >
                  {selected && (
                    <span className="h-1.5 w-1.5 rounded-full bg-white" />
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="card mt-6">
        <p className="text-[14px] font-bold text-navy-900">
          목록에 없나요? 단체 코드로 입력하기
        </p>
        <p className="mt-1.5 text-[12px] text-muted">
          단체 담당자가 안내한 코드를 입력해 주세요.
        </p>
        <div className="mt-4 flex gap-2">
          <input
            value={codeInput}
            onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && onApplyCode()}
            placeholder="예: ARMY"
            aria-label="단체 코드"
            className={`field flex-1 ${codeError ? "field-error" : ""}`}
          />
          <button type="button" onClick={onApplyCode} className="btn-ghost !px-5">
            확인
          </button>
        </div>
        {codeError && (
          <p role="alert" className="mt-2 text-[13px] font-medium text-red-600">
            {codeError}
          </p>
        )}
        <p className="mt-4 text-[12px] leading-relaxed text-muted">
          아직 협약을 맺지 않은 단체라면{" "}
          <Link href="/partners" className="font-semibold text-navy underline">
            협약 문의
          </Link>
          를 통해 담당자께 안내해 주세요.
        </p>
      </div>
    </section>
  );
}

/* ─────────────────────── 2단계 · 상품 선택 ─────────────────────── */

function StepProduct({
  products,
  productId,
  onSelect,
  partnerName,
}: {
  products: Product[];
  productId: string;
  onSelect: (id: string) => void;
  partnerName: string;
}) {
  return (
    <section>
      <h1 className="text-[22px] font-extrabold tracking-tight text-navy-900">
        어떤 보험을 알아보고 계신가요?
      </h1>
      <p className="mt-2 text-[14px] leading-relaxed text-muted">
        {partnerName && (
          <>
            <strong className="font-semibold text-navy">{partnerName}</strong> 회원 전용
            보험료입니다.{" "}
          </>
        )}
        설계사 경유 보험료와 비교해 보세요.
      </p>

      <ul className="mt-6 space-y-3">
        {products.map((product) => {
          const selected = product.id === productId;
          const saving = product.designerPremium - product.groupPremium;
          return (
            <li key={product.id}>
              <button
                type="button"
                onClick={() => onSelect(product.id)}
                aria-pressed={selected}
                className={`w-full rounded-2xl border p-5 text-left transition-all ${
                  selected
                    ? "border-navy bg-navy-50"
                    : "border-line bg-white hover:border-navy-300"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[16px] font-bold text-navy-900">
                      {product.name}
                    </p>
                    <p className="mt-1 text-[13px] leading-relaxed text-muted">
                      {product.summary}
                    </p>
                  </div>
                  <span className="chip shrink-0 bg-navy text-white">
                    {percent(savingRate(product))} ↓
                  </span>
                </div>

                <div className="mt-4 flex items-end justify-between gap-3 border-t border-line/80 pt-4">
                  <div>
                    <p className="text-[11px] text-muted">설계사 경유</p>
                    <p className="text-[14px] text-muted line-through">
                      {won(product.designerPremium)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] font-semibold text-gold">단체 전용가</p>
                    <p className="text-[22px] font-extrabold leading-tight text-navy-900">
                      {won(product.groupPremium)}
                      <span className="text-[12px] font-semibold text-muted"> /월</span>
                    </p>
                  </div>
                </div>

                <p className="mt-3 rounded-lg bg-gold-50 px-3 py-2 text-center text-[12px] font-semibold text-navy-900">
                  연 {won(saving * 12)} 절감 · 보장 동일
                </p>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/* ─────────────────────── 3단계 · 정보 입력 ─────────────────────── */

interface InfoForm {
  name: string;
  phone: string;
  birth: string;
  gender: "M" | "F" | "";
}

function StepInfo({
  form,
  setForm,
  errors,
}: {
  form: InfoForm;
  setForm: React.Dispatch<React.SetStateAction<InfoForm>>;
  errors: FieldErrors;
}) {
  return (
    <section>
      <h1 className="text-[22px] font-extrabold tracking-tight text-navy-900">
        상담을 위한 정보를 입력해 주세요
      </h1>
      <p className="mt-2 text-[14px] leading-relaxed text-muted">
        주민등록번호는 수집하지 않습니다. 상담에 꼭 필요한 최소 정보만 받습니다.
      </p>

      <div className="mt-6 space-y-5">
        <div>
          <label className="label" htmlFor="name">이름</label>
          <input
            id="name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="홍길동"
            autoComplete="name"
            aria-invalid={!!errors.name}
            aria-describedby={errors.name ? "name-error" : undefined}
            className={`field ${errors.name ? "field-error" : ""}`}
          />
          {errors.name && (
            <p id="name-error" role="alert" className="mt-1.5 text-[13px] font-medium text-red-600">
              {errors.name}
            </p>
          )}
        </div>

        <div>
          <label className="label" htmlFor="phone">휴대폰 번호</label>
          <input
            id="phone"
            value={form.phone}
            // 기획서 5.2 — 입력 즉시 하이픈 자동 삽입
            onChange={(e) =>
              setForm((f) => ({ ...f, phone: formatPhone(e.target.value) }))
            }
            placeholder="010-0000-0000"
            inputMode="numeric"
            autoComplete="tel"
            aria-invalid={!!errors.phone}
            aria-describedby={errors.phone ? "phone-error" : "phone-help"}
            className={`field ${errors.phone ? "field-error" : ""}`}
          />
          {errors.phone ? (
            <p id="phone-error" role="alert" className="mt-1.5 text-[13px] font-medium text-red-600">
              {errors.phone}
            </p>
          ) : (
            <p id="phone-help" className="mt-1.5 text-[12px] text-muted">
              접수 조회와 순서 도래 알림에 사용됩니다.
            </p>
          )}
        </div>

        <div>
          <label className="label" htmlFor="birth">생년월일</label>
          <input
            id="birth"
            value={form.birth}
            onChange={(e) =>
              setForm((f) => ({ ...f, birth: formatBirth(e.target.value) }))
            }
            placeholder="1988-05-13"
            inputMode="numeric"
            autoComplete="bday"
            aria-invalid={!!errors.birth}
            aria-describedby={errors.birth ? "birth-error" : undefined}
            className={`field ${errors.birth ? "field-error" : ""}`}
          />
          {errors.birth && (
            <p id="birth-error" role="alert" className="mt-1.5 text-[13px] font-medium text-red-600">
              {errors.birth}
            </p>
          )}
        </div>

        <fieldset>
          <legend className="label">성별 (선택)</legend>
          <div className="flex gap-2">
            {[
              { value: "M" as const, label: "남성" },
              { value: "F" as const, label: "여성" },
            ].map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() =>
                  setForm((f) => ({
                    ...f,
                    gender: f.gender === option.value ? "" : option.value,
                  }))
                }
                aria-pressed={form.gender === option.value}
                className={`btn flex-1 border ${
                  form.gender === option.value
                    ? "border-navy bg-navy-50 text-navy"
                    : "border-line bg-white text-muted"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </fieldset>
      </div>
    </section>
  );
}

/* ─────────────────────── 4단계 · 동의 및 접수 ─────────────────────── */

function StepConfirm({
  partner,
  product,
  form,
  agree,
  setAgree,
  submitError,
}: {
  partner?: Partner;
  product?: Product;
  form: InfoForm;
  agree: { privacy: boolean; notify: boolean; marketing: boolean };
  setAgree: React.Dispatch<
    React.SetStateAction<{ privacy: boolean; notify: boolean; marketing: boolean }>
  >;
  submitError: string;
}) {
  const saving = product ? product.designerPremium - product.groupPremium : 0;

  return (
    <section>
      <h1 className="text-[22px] font-extrabold tracking-tight text-navy-900">
        신청 내용을 확인해 주세요
      </h1>

      <dl className="card mt-6 space-y-3 text-[14px]">
        <Row label="소속 단체" value={partner?.name ?? "-"} />
        <Row label="선택 상품" value={product?.name ?? "-"} />
        <Row label="이름" value={form.name} />
        <Row label="휴대폰" value={form.phone} />
        <Row label="생년월일" value={form.birth} />
        {product && (
          <>
            <div className="border-t border-line pt-3" />
            <Row
              label="설계사 경유 보험료"
              value={<span className="text-muted line-through">{won(product.designerPremium)}</span>}
            />
            <Row
              label="단체 전용 보험료"
              value={
                <span className="text-[17px] font-extrabold text-navy-900">
                  {won(product.groupPremium)} /월
                </span>
              }
            />
            <p className="rounded-lg bg-gold-50 px-3 py-2 text-center text-[13px] font-semibold text-navy-900">
              연 {won(saving * 12)} 절감 · {partner?.name}에{" "}
              {won(product.groupPremium * 12 * CASHBACK_RATE)} 캐시백
            </p>
          </>
        )}
      </dl>

      <div className="mt-6 space-y-2.5">
        <ConsentBox
          checked={agree.privacy}
          onChange={(v) => setAgree((a) => ({ ...a, privacy: v }))}
          required
          title="개인정보 수집·이용 동의 (필수)"
        >
          <ul className="space-y-1">
            <li>· 수집 항목: 이름, 휴대폰 번호, 생년월일, 성별(선택), 소속 단체, 신청 상품</li>
            <li>· 이용 목적: 단체보험 가입 상담 및 접수 처리, 진행상태 안내</li>
            <li>· 보유 기간: 접수일로부터 3년 (관계 법령에 따른 보존 의무가 있는 경우 해당 기간)</li>
            <li>· 동의를 거부하실 수 있으나, 거부 시 가입 상담 접수가 불가합니다.</li>
          </ul>
        </ConsentBox>

        <ConsentBox
          checked={agree.notify}
          onChange={(v) => setAgree((a) => ({ ...a, notify: v }))}
          title="접수 순서·진행상태 알림 수신 동의 (선택)"
        >
          <p>
            대기 순서가 도래하거나 진행 단계가 변경될 때 알림톡 또는 문자로
            안내해 드립니다. 동의하시면 페이지를 닫아도 순번이 유지됩니다.
          </p>
        </ConsentBox>

        <ConsentBox
          checked={agree.marketing}
          onChange={(v) => setAgree((a) => ({ ...a, marketing: v }))}
          title="마케팅 정보 수신 동의 (선택)"
        >
          <p>신규 상품·프로모션 안내를 받아보실 수 있습니다.</p>
        </ConsentBox>
      </div>

      {submitError && (
        <p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-[13px] font-medium text-red-700">
          {submitError}
        </p>
      )}

      <p className="mt-5 text-[12px] leading-relaxed text-muted">
        본 신청은 가입 상담 접수이며 보험계약의 청약이 아닙니다. 최종 청약은
        관련 법령에 따른 유자격 모집조직을 통해 진행되며, 상담 과정에서 보장
        내용과 최종 보험료를 안내해 드립니다.
      </p>
    </section>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="shrink-0 text-muted">{label}</dt>
      <dd className="text-right font-semibold text-navy-900">{value}</dd>
    </div>
  );
}

function ConsentBox({
  checked,
  onChange,
  title,
  required,
  children,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  title: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className={`rounded-xl border p-4 transition-colors ${
        checked ? "border-navy-300 bg-navy-50/50" : "border-line bg-white"
      }`}
    >
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          id={title}
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="mt-0.5 h-5 w-5 shrink-0 accent-[#1F3864]"
        />
        <label htmlFor={title} className="flex-1 cursor-pointer text-[14px] font-semibold text-navy-900">
          {title}
          {required && <span className="ml-1 text-red-500">*</span>}
        </label>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="shrink-0 text-[12px] font-semibold text-muted underline"
          aria-expanded={open}
        >
          {open ? "접기" : "내용 보기"}
        </button>
      </div>
      {open && (
        <div className="mt-3 rounded-lg bg-mist p-3 text-[12px] leading-relaxed text-muted">
          {children}
        </div>
      )}
    </div>
  );
}
