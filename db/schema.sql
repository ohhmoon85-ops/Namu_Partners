-- ─────────────────────────────────────────────────────────────
-- 나무파트너스 단체보험 플랫폼 — Postgres 스키마
-- (Vercel Postgres / Supabase 공통, 기획서 6장)
--
-- 현재 애플리케이션은 로컬 JSON 스토어(src/lib/store.ts)로 동작한다.
-- 서버리스 다중 인스턴스로 배포할 때 이 스키마로 마이그레이션하고
-- store.ts 의 함수 구현만 SQL 로 교체하면 된다. (외부 인터페이스 동일)
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS partners (
  code            TEXT PRIMARY KEY,
  name            TEXT        NOT NULL,
  category        TEXT        NOT NULL DEFAULT '',
  member_count    INTEGER     NOT NULL DEFAULT 0,
  contracted_at   DATE,
  active          BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS products (
  id                TEXT PRIMARY KEY,
  name              TEXT        NOT NULL,
  summary           TEXT        NOT NULL DEFAULT '',
  coverages         JSONB       NOT NULL DEFAULT '[]'::jsonb,
  designer_premium  INTEGER     NOT NULL,
  group_premium     INTEGER     NOT NULL,
  eligibility       TEXT        NOT NULL DEFAULT '',
  featured          BOOLEAN     NOT NULL DEFAULT FALSE,
  active            BOOLEAN     NOT NULL DEFAULT TRUE,
  CONSTRAINT products_premium_check CHECK (group_premium <= designer_premium)
);

-- 접수 상태 (기획서 4.3)
DO $$ BEGIN
  CREATE TYPE application_status AS ENUM (
    'queued', 'received', 'reviewing', 'assigned', 'contracting', 'completed', 'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 전역 대기 순번 발급기 — 동시 접수 시에도 순번 중복이 없도록 시퀀스를 사용한다.
CREATE SEQUENCE IF NOT EXISTS queue_number_seq START 1;

CREATE TABLE IF NOT EXISTS applications (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket            TEXT        NOT NULL UNIQUE,
  queue_number      BIGINT      NOT NULL UNIQUE DEFAULT nextval('queue_number_seq'),
  -- 접수 시점의 내 앞 대기 인원 (진행률 바 기준값)
  ahead_at_entry    INTEGER     NOT NULL DEFAULT 0,

  partner_code      TEXT        NOT NULL REFERENCES partners(code),
  partner_name      TEXT        NOT NULL,
  product_id        TEXT        NOT NULL REFERENCES products(id),
  product_name      TEXT        NOT NULL,
  designer_premium  INTEGER     NOT NULL,
  group_premium     INTEGER     NOT NULL,

  -- 개인정보는 AES-256-GCM 암호문으로 저장한다 (기획서 6장/9장)
  name_enc          TEXT        NOT NULL,
  phone_enc         TEXT        NOT NULL,
  birth_enc         TEXT        NOT NULL,
  -- 복호화 없이 접수 조회·중복 확인에 사용하는 HMAC
  phone_hash        TEXT        NOT NULL,
  gender            CHAR(1)     NOT NULL DEFAULT '',

  notify_opt_in     BOOLEAN     NOT NULL DEFAULT FALSE,
  marketing_opt_in  BOOLEAN     NOT NULL DEFAULT FALSE,
  agreed_at         TIMESTAMPTZ NOT NULL,

  status            application_status NOT NULL DEFAULT 'queued',
  admin_note        TEXT        NOT NULL DEFAULT '',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 대기열 소진 시 queued 건을 순번 순으로 스캔하므로 부분 인덱스가 효과적이다.
CREATE INDEX IF NOT EXISTS applications_queued_idx
  ON applications (queue_number) WHERE status = 'queued';
CREATE INDEX IF NOT EXISTS applications_phone_hash_idx ON applications (phone_hash);
CREATE INDEX IF NOT EXISTS applications_partner_idx ON applications (partner_code, status);
CREATE INDEX IF NOT EXISTS applications_created_idx ON applications (created_at DESC);

-- 동일 휴대폰 + 동일 상품의 진행 중 접수 중복 방지
CREATE UNIQUE INDEX IF NOT EXISTS applications_active_dup_idx
  ON applications (phone_hash, product_id)
  WHERE status NOT IN ('completed', 'cancelled');

CREATE TABLE IF NOT EXISTS application_events (
  id              BIGSERIAL PRIMARY KEY,
  application_id  UUID        NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  status          application_status NOT NULL,
  note            TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS application_events_app_idx
  ON application_events (application_id, created_at);

CREATE TABLE IF NOT EXISTS partner_inquiries (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_name      TEXT        NOT NULL,
  contact_name  TEXT        NOT NULL,
  position      TEXT        NOT NULL DEFAULT '',
  phone_enc     TEXT        NOT NULL,
  email_enc     TEXT        NOT NULL,
  member_count  INTEGER     NOT NULL DEFAULT 0,
  message       TEXT        NOT NULL DEFAULT '',
  handled       BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notification_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id  UUID        REFERENCES applications(id) ON DELETE SET NULL,
  ticket          TEXT        NOT NULL,
  channel         TEXT        NOT NULL,
  template        TEXT        NOT NULL,
  ok              BOOLEAN     NOT NULL,
  detail          TEXT        NOT NULL DEFAULT '',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS notification_logs_created_idx
  ON notification_logs (created_at DESC);

-- 단일 행 운영 설정 (대기열 처리 속도 등)
CREATE TABLE IF NOT EXISTS settings (
  id                     BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id),
  throughput_per_minute  INTEGER     NOT NULL DEFAULT 12,
  last_advance_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  intake_paused          BOOLEAN     NOT NULL DEFAULT FALSE
);

INSERT INTO settings (id) VALUES (TRUE) ON CONFLICT (id) DO NOTHING;

-- 협약단체별 실적·캐시백 집계 뷰 (기획서 4.4)
-- 캐시백은 성사(청약 완료) 건의 연환산 보험료 × 3%
CREATE OR REPLACE VIEW partner_summaries AS
SELECT
  p.code,
  p.name,
  COUNT(a.id) FILTER (WHERE a.status <> 'cancelled')                    AS application_count,
  COUNT(a.id) FILTER (WHERE a.status = 'completed')                     AS completed_count,
  COALESCE(SUM(a.group_premium * 12) FILTER (WHERE a.status = 'completed'), 0) AS annualized_premium,
  ROUND(
    COALESCE(SUM(a.group_premium * 12) FILTER (WHERE a.status = 'completed'), 0) * 0.03
  )                                                                     AS cashback
FROM partners p
LEFT JOIN applications a ON a.partner_code = p.code
GROUP BY p.code, p.name
ORDER BY application_count DESC;
