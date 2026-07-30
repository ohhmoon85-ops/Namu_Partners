# 나무파트너스 단체보험 프로모션 플랫폼

기획서(`나무파트너스_단체보험_플랫폼_기획서.pdf`)를 구현한 웹 프로그램입니다.
설계사 대비 평균 **17.5% 절감** 홍보, 가입 폭주 대응 **가상 대기실**, 협약단체 **3% 캐시백**
집계를 하나의 Next.js 애플리케이션으로 제공합니다.

---

## 1. 실행 방법

```bash
npm install
cp .env.example .env.local   # 값 입력 (아래 2장 참고)
npm run dev                  # http://localhost:3000
```

프로덕션 빌드:

```bash
npm run build
npm run start
```

| 명령 | 설명 |
| --- | --- |
| `npm run dev` | 개발 서버 |
| `npm run build` | 프로덕션 빌드 |
| `npm run start` | 빌드 결과 실행 |
| `npm run typecheck` | 타입 검사 |

관리자 화면은 `/admin` 이며, 기본 비밀번호는 `namu-admin` 입니다
(`ADMIN_PASSWORD` 환경변수로 변경).

---

## 2. 환경변수

`.env.example` 을 `.env.local` 로 복사해 사용합니다.

| 변수 | 필수 | 설명 |
| --- | --- | --- |
| `NP_SECRET` | 운영 필수 | 개인정보 암호화·세션 서명 마스터 시크릿(32자 이상 권장). **값이 바뀌면 기존 암호문을 복호화할 수 없습니다.** |
| `ADMIN_PASSWORD` | 운영 필수 | 관리자 로그인 비밀번호 |
| `NP_DATA_DIR` | 선택 | 로컬 데이터 스토어 경로 (기본 `.data`) |
| `NOTIFY_PROVIDER` | 선택 | `console`(기본) / `kakao` / `sms` |
| `KAKAO_ALIMTALK_*` | 선택 | 알림톡 발송 API 설정 |
| `SMS_*` | 선택 | SMS 발송 API 설정 |
| `NEXT_PUBLIC_SITE_URL` | 선택 | sitemap.xml 에 사용할 배포 도메인 |

`NODE_ENV=production` 에서 `NP_SECRET` / `ADMIN_PASSWORD` 가 없으면 의도적으로
기동을 실패시킵니다(기본값으로 운영되는 사고 방지).

---

## 3. 기획서 요구사항 대응표

| 기획서 항목 | 구현 위치 |
| --- | --- |
| 3장 홍보 메시지 (메인/협약단체/보조 카피) | `src/app/page.tsx`, `src/app/partners/page.tsx` |
| 3.3 "평균 17.5%" 산출 근거 각주 | `src/lib/company.ts` → 히어로·푸터·FAQ·약관에 병기 |
| 4.1 랜딩·절감 원리 인포그래픽·FAQ | `src/app/page.tsx` |
| 4.2 가입 신청 5단계 플로우 | `src/app/apply/`, `src/components/apply/ApplyWizard.tsx` |
| **4.3 가상 대기실 (핵심 요구사항 ②)** | `src/components/waiting/WaitingRoom.tsx`, `src/lib/store.ts` |
| 4.3 자리 비움 허용(알림 신청) | `POST /api/queue/[ticket]`, `src/lib/notify.ts` |
| 4.3 단계별 진행상태 조회 | `src/app/status/`, `src/components/status/StatusLookup.tsx` |
| 4.4 단체별 실적·캐시백 대시보드 | `/admin` → "단체별 실적·캐시백" 탭 |
| 4.4 단체 전용 초대 링크 | 관리자 화면에서 `/apply?code=<단체코드>` 복사 |
| **5.1 디자인 원칙 (핵심 요구사항 ③)** | `src/app/globals.css` (네이비 #1F3864 / 골드 #B99A5B / Pretendard / 글래스모피즘 / 스크롤 등장) |
| 5.2 모바일 최적화 | 모바일 퍼스트 레이아웃, 하단 고정 CTA, 44px+ 터치 타깃, 자동 하이픈, 단체 코드 자동 인식 |
| 6장 기술 아키텍처 | Next.js 15 App Router + Tailwind v4 + API Routes |
| 6장 보안 | AES-256-GCM 암호화 저장, HSTS·보안 헤더, HttpOnly 세션, 마스킹, 레이트리밋 |
| 7장 화면 구성 7종 | 아래 4장 라우트 표 |
| 9장 법적 고지 | `src/app/privacy/`, `src/app/terms/`, 푸터 고지문 |

---

## 4. 라우트

### 화면

| 경로 | 기획서 화면 | 설명 |
| --- | --- | --- |
| `/` | 1. 메인(랜딩) | 히어로 카피, 17.5%/3% 강조, 절감 원리, 상품 비교, 협약단체 로고 월 |
| `/apply` | 2. 가입 신청 | 단체 → 상품 → 정보 → 동의 4단계 폼. `?code=ARMY&product=acc-plus` 로 사전 선택 |
| `/waiting/[ticket]` | 3. 대기실 | 대기번호·앞 대기 인원·예상 시간·진행률·알림 신청·대기 중 콘텐츠 |
| `/status` | 4. 접수 조회 | 접수번호 + 휴대폰으로 단계별 타임라인 조회 |
| `/partners` | 5. 협약단체 안내 | 캐시백 구조 도해, 캐시백 시뮬레이터, 협약 절차, 문의 폼 |
| `/faq`, `/privacy`, `/terms` | 6. FAQ/약관 | FAQ, 개인정보처리방침, 이용약관 |
| `/admin` | 7. 관리자 | 접수 관리, 단체별 캐시백, 협약 문의, 대기열 운영 |

### API

| 메서드 · 경로 | 인증 | 설명 |
| --- | --- | --- |
| `POST /api/applications` | - | 가입 접수(순번 발급). 5회/분 제한 |
| `GET /api/queue/[ticket]` | - | 대기 상태 폴링 (호출 시 대기열 소진 반영) |
| `POST /api/queue/[ticket]` | - | 알림 수신 동의 변경 |
| `POST /api/lookup` | - | 접수 조회 (접수번호 + 휴대폰). 10회/분 제한 |
| `POST /api/inquiries` | - | 협약 문의 접수. 3회/분 제한 |
| `POST/DELETE /api/admin/session` | - / 관리자 | 로그인 / 로그아웃 |
| `GET/PATCH /api/admin/applications` | 관리자 | 접수 목록(마스킹) / 상태·메모 변경 |
| `GET /api/admin/applications/[id]/reveal` | 관리자 | 개인정보 원문 조회(감사 로그 기록) |
| `GET /api/admin/overview` | 관리자 | 집계·설정·문의·알림 이력 |
| `PATCH/POST /api/admin/queue` | 관리자 | 처리 속도·접수 중지 설정 / 수동 소진 |
| `PATCH /api/admin/inquiries` | 관리자 | 문의 처리 여부 변경 |

---

## 5. 대기열 동작 방식 (기획서 4.3)

기획서의 "소프트 대기열"을 그대로 구현했습니다.

1. 접수 시점에 신청 내용을 **즉시 저장**하고 전역 순번(`queueNumber`)과
   접수번호(`NP-YYYYMMDD-NNNN`)를 발급합니다. → 대기 중 이탈해도 신청이 사라지지 않습니다.
2. 대기열은 **분당 처리 건수**(`throughputPerMinute`, 기본 12)에 따라 시간 경과만큼
   자동 소진됩니다. 소진 계산은 `/api/queue/[ticket]` 호출 시 수행되며,
   처리한 건수만큼만 기준 시각을 전진시켜 소수점 잔여 시간을 보존합니다.
3. 대기실은 3초 간격으로 폴링하며, 백그라운드 탭에서는 폴링을 건너뜁니다.
4. 순서가 도래하면 알림 수신에 동의한 신청자에게 알림톡/문자를 발송합니다.
5. 접수 확정 이후에는 `접수 완료 → 서류 검토 → 담당자 배정 → 청약 진행 → 청약 완료`
   단계를 `/status` 에서 조회할 수 있어, 실시간 대기와 행정처리 대기를 모두 커버합니다.

관리자 화면에서 처리 속도 조정, 수동 소진(앞에서 N건 즉시 접수), 신규 접수 일시 중지를
운영할 수 있습니다.

---

## 6. 데이터 저장과 보안

- **암호화 저장**: 이름·휴대폰·생년월일·이메일은 AES-256-GCM 으로 암호화해 저장합니다
  (`src/lib/crypto.ts`). 접수 조회는 복호화 없이 휴대폰 HMAC 을 대조합니다.
- **마스킹**: 관리자 목록 API 는 항상 마스킹된 값(`홍*동`, `010-****-5678`)만 반환하며,
  원문은 별도 엔드포인트(`/reveal`)로만 접근하고 서버 로그에 감사 기록을 남깁니다.
- **레이트리밋**: 접수·조회·문의·로그인에 IP 기준 고정 윈도 제한을 적용합니다.
- **보안 헤더**: HSTS, X-Frame-Options, nosniff, Referrer-Policy (`next.config.ts`).
- **색인 제외**: `/admin`, `/status`, `/waiting`, `/api` 는 robots.txt 및 메타로 제외합니다.

### 저장소 구성

현재 데이터는 `.data/store.json`(로컬 JSON 파일)에 저장됩니다. 모든 접근이
`src/lib/store.ts` 의 함수로 한정되어 있고, 읽기-수정-쓰기를 직렬화해 순번 중복이
발생하지 않습니다.

> ⚠️ **서버리스(Vercel) 다중 인스턴스 배포 전 반드시 교체해야 합니다.**
> 파일 스토어는 단일 프로세스를 전제로 하며, 인스턴스마다 별도 파일을 갖게 됩니다.
> `db/schema.sql` 에 동일 구조의 Postgres 스키마(Vercel Postgres / Supabase 공통)를
> 정의해 두었으므로, `store.ts` 의 각 함수 본문만 SQL 로 교체하면 됩니다
> (외부 인터페이스 변경 없음). 순번은 `queue_number_seq` 시퀀스가, 중복 접수 방지는
> 부분 유니크 인덱스가 담당합니다.

---

## 7. 오픈 전 반드시 교체해야 할 항목

구축 단계의 자리표시자입니다. **대외 오픈 전 실제 값으로 교체하고 법무 검토를 받으세요.**

| 파일 | 내용 |
| --- | --- |
| `src/lib/company.ts` | 법인명·대표자·사업자등록번호·**보험대리점 등록번호**·주소·고객센터·개인정보 보호책임자·**준법감시인 확인 번호** |
| `src/lib/company.ts` → `savingBasis` | "평균 17.5%" 산출 근거(비교 기준·기간·표본). 기획서 3.3 각주 요구사항 |
| `src/lib/catalog.ts` → `PARTNERS` | 협약단체 목록. 현재는 예시 데이터이며 `대한민국육군협회`는 기획서에 예시로 기재된 명칭을 그대로 사용했습니다. **실제 협약 체결 전 노출 금지** |
| `src/lib/catalog.ts` → `PRODUCTS` | 상품·보장·보험료. 제휴 보험사가 확정한 요율로 교체 |
| `src/app/privacy/page.tsx` | 개인정보처리방침 초안 → 법률 검토 후 확정 |
| `src/app/terms/page.tsx` | 이용약관 초안 → 법무 검토 후 확정 |

또한 기획서 9장에 따라 **광고 문구 심의**(보험업법·금융소비자보호법)와
**모집 자격 범위 확인**을 오픈 전 절차에 포함해야 합니다. 플랫폼 문구는
"접수는 상담 신청이며 청약은 유자격 모집조직이 수행한다"는 취지로 작성되어 있습니다.

---

## 8. 디렉터리 구조

```
src/
├─ app/
│  ├─ page.tsx                     메인(랜딩)
│  ├─ apply/                       가입 신청
│  ├─ waiting/[ticket]/            대기실
│  ├─ status/                      접수 조회
│  ├─ partners/                    협약단체 안내(B2B)
│  ├─ faq/ privacy/ terms/         FAQ·약관
│  ├─ admin/                       관리자
│  └─ api/                         접수·대기열·조회·문의·관리자 API
├─ components/
│  ├─ SiteHeader / SiteFooter / Reveal / CountUp / StickyCta
│  ├─ apply/ApplyWizard.tsx        4단계 신청 폼
│  ├─ waiting/WaitingRoom.tsx      가상 대기실
│  ├─ status/StatusLookup.tsx      진행상태 타임라인
│  ├─ partners/                    캐시백 시뮬레이터, 협약 문의 폼
│  └─ admin/                       관리자 콘솔
└─ lib/
   ├─ store.ts        데이터 스토어 + 대기열 소진 로직
   ├─ crypto.ts       AES-256-GCM 암호화 / HMAC / 세션 서명
   ├─ catalog.ts      협약단체·상품 시드
   ├─ company.ts      법인·면허 정보, 절감률 산출 근거
   ├─ notify.ts       알림톡/SMS 발송
   ├─ auth.ts         관리자 인증
   ├─ ratelimit.ts    레이트리밋
   ├─ validation.ts   입력 검증
   ├─ format.ts       표시 포맷·마스킹
   └─ types.ts        도메인 타입
db/schema.sql         Postgres 마이그레이션 스키마
```

---

## 9. 배포 (기획서 6장)

GitHub 저장소 → Vercel 자동 배포(main = 운영, PR 프리뷰) 구성을 전제로 합니다.
Vercel 배포 시 위 6장의 저장소 교체(Postgres)를 먼저 완료하고, 프로젝트 설정에
`NP_SECRET`, `ADMIN_PASSWORD`, 알림 API 키를 환경변수로 등록하세요.
