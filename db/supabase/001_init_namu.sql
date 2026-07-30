-- ════════════════════════════════════════════════════════════════════
--  나무파트너스 단체보험 플랫폼 — Supabase 초기화 스크립트
--  대상 프로젝트: katusa-membership (ap-northeast-2 / Seoul)
--
--  ▸ 이 Supabase 프로젝트는 여러 백엔드(앱)가 동시에 사용합니다.
--    따라서 public 스키마를 쓰지 않고 전용 스키마 `namu` 로 완전히 격리합니다.
--      · public  → 기존 앱(katusa-membership 등)이 그대로 사용
--      · namu    → 나무파트너스 단체보험 플랫폼 전용
--    이후 다른 앱이 추가되면 같은 방식으로 별도 스키마를 하나 더 만들면 됩니다.
--
--  ▸ 사용법: Supabase 대시보드 → SQL Editor → 이 파일 전체를 붙여넣고 RUN
--    여러 번 실행해도 안전합니다(멱등).
--
--  ▸ 실행 후 반드시 확인할 것 (하단 "8. 실행 후 설정" 참고)
--    Settings → API → Exposed schemas 에 `namu` 를 추가하지 마세요.
--    이 스키마는 서버(서비스 롤)에서만 접근하는 비공개 스키마입니다.
-- ════════════════════════════════════════════════════════════════════


-- ────────────────────────────────────────────────────────────────────
-- 1. 스키마 생성 및 격리
-- ────────────────────────────────────────────────────────────────────

create schema if not exists namu;

comment on schema namu is
  '나무파트너스 단체보험 프로모션 플랫폼 전용 스키마. 다른 앱과 공유하지 않는다.';

-- 이 스키마는 PostgREST(anon/authenticated)로 노출하지 않는다.
-- 접근은 서버 사이드(service_role / 직접 커넥션)로만 허용한다.
revoke all on schema namu from public;
revoke all on schema namu from anon, authenticated;

grant usage on schema namu to service_role;


-- 마이그레이션 이력 (여러 앱이 한 DB를 쓰므로 앱별로 버전을 따로 관리한다)
create table if not exists namu.schema_migrations (
  version     text        primary key,
  applied_at  timestamptz not null default now()
);

comment on table namu.schema_migrations is '나무파트너스 스키마 마이그레이션 이력';


-- ────────────────────────────────────────────────────────────────────
-- 2. 열거형 · 시퀀스
-- ────────────────────────────────────────────────────────────────────

-- 접수 진행 상태 (기획서 4.3)
--   queued      대기열 대기 중 (접수 확정 전)
--   received    접수 완료
--   reviewing   서류 검토
--   assigned    담당자 배정
--   contracting 청약 진행
--   completed   청약 완료 (성사 — 캐시백 정산 대상)
--   cancelled   취소/철회
do $$
begin
  if not exists (
    select 1 from pg_type t
      join pg_namespace n on n.oid = t.typnamespace
     where t.typname = 'application_status' and n.nspname = 'namu'
  ) then
    create type namu.application_status as enum (
      'queued', 'received', 'reviewing', 'assigned',
      'contracting', 'completed', 'cancelled'
    );
  end if;
end $$;

-- 전역 대기 순번 발급기.
-- 시퀀스를 쓰면 동시 접수(여러 서버리스 인스턴스)에서도 순번이 중복되지 않는다.
create sequence if not exists namu.queue_number_seq as bigint start 1;


-- ────────────────────────────────────────────────────────────────────
-- 3. 테이블
-- ────────────────────────────────────────────────────────────────────

-- 협약단체 ------------------------------------------------------------
create table if not exists namu.partners (
  code           text        primary key,
  name           text        not null,
  category       text        not null default '',
  member_count   integer     not null default 0 check (member_count >= 0),
  contracted_at  date,
  active         boolean     not null default true,
  created_at     timestamptz not null default now()
);

comment on table  namu.partners      is '협약단체. code 는 초대 링크(/apply?code=)와 캐시백 귀속에 사용된다.';
comment on column namu.partners.code is '단체 코드 — 대문자 영문. 회원 안내 링크·QR에 노출된다.';


-- 보험 상품 -----------------------------------------------------------
create table if not exists namu.products (
  id                text        primary key,
  name              text        not null,
  summary           text        not null default '',
  coverages         jsonb       not null default '[]'::jsonb,
  designer_premium  integer     not null check (designer_premium > 0),
  group_premium     integer     not null check (group_premium > 0),
  eligibility       text        not null default '',
  featured          boolean     not null default false,
  active            boolean     not null default true,
  sort_order        integer     not null default 0,
  -- 단체가가 설계사가보다 비쌀 수 없다 (요율 입력 실수 방지)
  constraint products_premium_check check (group_premium <= designer_premium)
);

comment on table namu.products is
  '보험 상품. 보험료는 제휴 보험사가 확정한 요율로만 채울 것 (광고 규제 대상).';


-- 접수 ---------------------------------------------------------------
create table if not exists namu.applications (
  id                uuid        primary key default gen_random_uuid(),
  ticket            text        not null unique,
  queue_number      bigint      not null unique default nextval('namu.queue_number_seq'),
  -- 접수 시점의 "내 앞 대기 인원" — 대기실 진행률 바의 기준값
  ahead_at_entry    integer     not null default 0,

  partner_code      text        not null references namu.partners(code),
  partner_name      text        not null,
  product_id        text        not null references namu.products(id),
  product_name      text        not null,
  designer_premium  integer     not null,
  group_premium     integer     not null,

  -- 개인정보는 애플리케이션에서 AES-256-GCM 으로 암호화한 뒤 저장한다.
  -- DB 에는 절대 평문이 들어가지 않는다. (기획서 6장/9장)
  name_enc          text        not null,
  phone_enc         text        not null,
  birth_enc         text        not null,
  -- 복호화 없이 접수 조회·중복 확인에 쓰는 HMAC-SHA256
  phone_hash        text        not null,
  gender            text        not null default '' check (gender in ('', 'M', 'F')),

  notify_opt_in     boolean     not null default false,
  marketing_opt_in  boolean     not null default false,
  agreed_at         timestamptz not null default now(),

  status            namu.application_status not null default 'queued',
  admin_note        text        not null default '',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

comment on table  namu.applications           is '가입 상담 접수 건. 접수 즉시 저장되며 대기열 순번을 갖는다.';
comment on column namu.applications.ticket    is '접수번호 NP-YYYYMMDD-NNNN (KST 기준)';
comment on column namu.applications.phone_hash is '휴대폰 HMAC — 접수 조회 대조 및 중복 접수 차단용';

-- 대기열 소진은 queued 건만 순번 순으로 스캔하므로 부분 인덱스가 가장 효율적이다.
create index if not exists applications_queued_idx
  on namu.applications (queue_number) where status = 'queued';
create index if not exists applications_phone_hash_idx
  on namu.applications (phone_hash);
create index if not exists applications_partner_idx
  on namu.applications (partner_code, status);
create index if not exists applications_created_idx
  on namu.applications (created_at desc);

-- 동일 휴대폰 + 동일 상품의 "진행 중" 접수 중복 방지.
-- 완료/취소 건은 제외하므로 나중에 다시 신청할 수 있다.
create unique index if not exists applications_active_dup_idx
  on namu.applications (phone_hash, product_id)
  where status not in ('completed', 'cancelled');


-- 진행 이력 -----------------------------------------------------------
create table if not exists namu.application_events (
  id              bigserial   primary key,
  application_id  uuid        not null references namu.applications(id) on delete cascade,
  status          namu.application_status not null,
  note            text,
  created_at      timestamptz not null default now()
);

create index if not exists application_events_app_idx
  on namu.application_events (application_id, created_at);

comment on table namu.application_events is
  '상태 전이 이력. 트리거가 자동으로 기록하므로 직접 INSERT 하지 않는다.';


-- 협약 문의 (B2B) ------------------------------------------------------
create table if not exists namu.partner_inquiries (
  id            uuid        primary key default gen_random_uuid(),
  org_name      text        not null,
  contact_name  text        not null,
  position      text        not null default '',
  phone_enc     text        not null,
  email_enc     text        not null,
  member_count  integer     not null default 0,
  message       text        not null default '',
  handled       boolean     not null default false,
  created_at    timestamptz not null default now()
);

create index if not exists partner_inquiries_created_idx
  on namu.partner_inquiries (created_at desc);


-- 알림 발송 이력 --------------------------------------------------------
create table if not exists namu.notification_logs (
  id              uuid        primary key default gen_random_uuid(),
  application_id  uuid        references namu.applications(id) on delete set null,
  ticket          text        not null,
  channel         text        not null,
  template        text        not null,
  ok              boolean     not null,
  detail          text        not null default '',
  created_at      timestamptz not null default now()
);

create index if not exists notification_logs_created_idx
  on namu.notification_logs (created_at desc);


-- 운영 설정 (단일 행) ---------------------------------------------------
create table if not exists namu.settings (
  id                     boolean     primary key default true check (id),
  -- 대기열이 소진되는 속도 = 실제 상담 인력의 분당 접수 처리 능력
  throughput_per_minute  integer     not null default 12 check (throughput_per_minute between 1 and 600),
  last_advance_at        timestamptz not null default now(),
  intake_paused          boolean     not null default false
);

insert into namu.settings (id) values (true) on conflict (id) do nothing;

comment on table namu.settings is '대기열 운영 설정. 항상 단 한 행만 존재한다.';


-- ────────────────────────────────────────────────────────────────────
-- 4. 트리거 — updated_at 갱신 · 상태 이력 자동 기록
-- ────────────────────────────────────────────────────────────────────

create or replace function namu.tg_touch_updated_at()
returns trigger
language plpgsql
set search_path = namu, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_applications_touch on namu.applications;
create trigger trg_applications_touch
  before update on namu.applications
  for each row execute function namu.tg_touch_updated_at();


-- 상태가 바뀌면 이력을 자동으로 남긴다.
-- 메모를 함께 남기고 싶으면 namu.set_status() 를 사용하면 되고,
-- Table Editor 에서 직접 상태를 바꿔도 이력이 누락되지 않는다.
create or replace function namu.tg_log_status_event()
returns trigger
language plpgsql
set search_path = namu, pg_temp
as $$
declare
  v_note text;
begin
  -- OLD 는 UPDATE 일 때만 존재하므로 반드시 중첩 IF 로 접근한다.
  -- (SQL 의 AND 는 단축 평가를 보장하지 않아 INSERT 시 OLD 참조 오류가 난다)
  if tg_op = 'UPDATE' then
    if new.status is not distinct from old.status then
      return new;
    end if;
  end if;

  -- set_status() 가 트랜잭션 스코프로 설정해 둔 메모를 읽는다.
  v_note := nullif(current_setting('namu.event_note', true), '');

  insert into namu.application_events (application_id, status, note)
  values (new.id, new.status, v_note);

  return new;
end;
$$;

drop trigger if exists trg_applications_event_insert on namu.applications;
create trigger trg_applications_event_insert
  after insert on namu.applications
  for each row execute function namu.tg_log_status_event();

drop trigger if exists trg_applications_event_update on namu.applications;
create trigger trg_applications_event_update
  after update of status on namu.applications
  for each row execute function namu.tg_log_status_event();


-- ────────────────────────────────────────────────────────────────────
-- 5. 대기열 로직 (기획서 4.3 — 핵심 요구사항 ②)
--
--    애플리케이션이 아닌 DB 안에서 처리한다.
--    서버리스는 인스턴스가 여러 개 동시에 뜨므로, 순번 발급과 대기열 소진을
--    앱 메모리에서 계산하면 순번이 어긋난다. settings 행을 잠가 직렬화한다.
-- ────────────────────────────────────────────────────────────────────

-- 경과 시간과 분당 처리량만큼 대기열을 소진시키고, 이번에 접수 확정된 건을 반환한다.
create or replace function namu.drain_queue()
returns setof namu.applications
language plpgsql
volatile
set search_path = namu, pg_temp
as $$
declare
  v_settings          namu.settings;
  v_now               timestamptz := now();
  v_seconds_per_item  numeric;
  v_capacity          integer;
  v_waiting           integer;
  v_ids               uuid[];
  v_served            integer;
begin
  -- 동시 호출을 직렬화 (여러 인스턴스가 같은 건을 중복 처리하지 않도록)
  select * into v_settings from namu.settings s where s.id = true for update;

  select count(*) into v_waiting
    from namu.applications a where a.status = 'queued';

  -- 대기 인원이 없으면 다음 폭주에 대비해 기준 시각을 현재로 리셋한다.
  -- (이걸 안 하면 오래 쉰 뒤 첫 신청자가 즉시 통과해 버린다)
  if v_waiting = 0 then
    update namu.settings set last_advance_at = v_now where id = true;
    return;
  end if;

  v_seconds_per_item := 60.0 / v_settings.throughput_per_minute;
  -- 오래 유휴 상태였다면 capacity 가 매우 커질 수 있으므로 대기 인원으로 상한을 둔다.
  v_capacity := least(
    floor(
      extract(epoch from (v_now - v_settings.last_advance_at)) / v_seconds_per_item
    )::bigint,
    v_waiting::bigint
  )::integer;

  if v_capacity <= 0 then
    return;
  end if;

  with target as (
    select id
      from namu.applications
     where status = 'queued'
     order by queue_number
     limit v_capacity
       for update skip locked
  ), upd as (
    update namu.applications a
       set status = 'received'
      from target t
     where a.id = t.id
    returning a.id
  )
  select coalesce(array_agg(id), '{}'::uuid[]) into v_ids from upd;

  v_served := coalesce(array_length(v_ids, 1), 0);
  if v_served = 0 then
    return;
  end if;

  -- 실제 처리한 건수만큼만 기준 시각을 전진시켜 소수점 잔여 시간을 보존한다.
  -- numeric * interval 연산자는 없으므로 make_interval(double precision) 을 쓴다.
  update namu.settings
     set last_advance_at = v_settings.last_advance_at
                           + make_interval(secs => (v_served * v_seconds_per_item)::double precision)
   where id = true;

  return query
    select * from namu.applications
     where id = any(v_ids)
     order by queue_number;
end;
$$;

comment on function namu.drain_queue() is
  '경과 시간만큼 대기열을 소진하고 이번에 접수 확정된 건을 반환한다. 알림 발송 대상.';


-- 접수 생성 — 순번 발급, 앞 대기 인원 계산, 중복 차단을 한 트랜잭션에서 처리한다.
create or replace function namu.create_application(
  p_partner_code      text,
  p_product_id        text,
  p_name_enc          text,
  p_phone_enc         text,
  p_birth_enc         text,
  p_phone_hash        text,
  p_gender            text    default '',
  p_notify_opt_in     boolean default false,
  p_marketing_opt_in  boolean default false
)
returns namu.applications
language plpgsql
volatile
set search_path = namu, pg_temp
as $$
declare
  v_partner   namu.partners;
  v_product   namu.products;
  v_paused    boolean;
  v_queue_no  bigint;
  v_ticket    text;
  v_ahead     integer;
  v_row       namu.applications;
begin
  -- RAISE 는 포맷 문자열과 USING MESSAGE 를 함께 쓸 수 없다.
  -- 애플리케이션은 SQLSTATE(NP0xx)로 분기하고, DETAIL 에 식별자를 담는다.
  select s.intake_paused into v_paused from namu.settings s where s.id = true;
  if v_paused then
    raise exception using
      errcode = 'NP001',
      message = '현재 신규 접수가 일시 중지되었습니다.',
      detail  = 'INTAKE_PAUSED';
  end if;

  select * into v_partner
    from namu.partners p where p.code = upper(trim(p_partner_code)) and p.active;
  if not found then
    raise exception using
      errcode = 'NP002', message = '유효하지 않은 협약단체입니다.', detail = 'INVALID_PARTNER';
  end if;

  select * into v_product
    from namu.products pr where pr.id = p_product_id and pr.active;
  if not found then
    raise exception using
      errcode = 'NP003', message = '유효하지 않은 상품입니다.', detail = 'INVALID_PRODUCT';
  end if;

  -- 순번을 발급하기 전에 대기열을 먼저 소진시켜야
  -- "내 앞 대기 인원"이 실제와 어긋나지 않는다.
  perform namu.drain_queue();

  select count(*) into v_ahead from namu.applications where status = 'queued';

  v_queue_no := nextval('namu.queue_number_seq');
  -- 접수번호의 날짜는 한국 시간 기준
  v_ticket := 'NP-'
            || to_char(now() at time zone 'Asia/Seoul', 'YYYYMMDD')
            || '-' || lpad(v_queue_no::text, 4, '0');

  begin
    insert into namu.applications (
      ticket, queue_number, ahead_at_entry,
      partner_code, partner_name, product_id, product_name,
      designer_premium, group_premium,
      name_enc, phone_enc, birth_enc, phone_hash, gender,
      notify_opt_in, marketing_opt_in
    ) values (
      v_ticket, v_queue_no, v_ahead,
      v_partner.code, v_partner.name, v_product.id, v_product.name,
      v_product.designer_premium, v_product.group_premium,
      p_name_enc, p_phone_enc, p_birth_enc, p_phone_hash,
      coalesce(p_gender, ''),
      p_notify_opt_in, p_marketing_opt_in
    )
    returning * into v_row;
  exception when unique_violation then
    -- applications_active_dup_idx 위반 = 진행 중인 동일 신청이 이미 있음
    raise exception using
      errcode = 'NP004',
      message = '이미 진행 중인 신청이 있습니다.',
      detail  = 'DUPLICATE_APPLICATION';
  end;

  return v_row;
end;
$$;

comment on function namu.create_application is
  '접수 생성. 대기열 소진 → 순번 발급 → 중복 차단을 한 트랜잭션에서 원자적으로 처리한다.';


-- 대기실 폴링 — 대기열을 소진시킨 뒤 해당 건의 현재 대기 상태를 반환한다.
create or replace function namu.poll_queue(p_ticket text)
returns table (
  ticket                text,
  queue_number          bigint,
  status                namu.application_status,
  ahead                 integer,
  ahead_at_entry        integer,
  progress              integer,
  estimated_minutes     numeric,
  throughput_per_minute integer,
  total_waiting         integer,
  notify_opt_in         boolean,
  partner_name          text,
  product_name          text,
  -- 이번 호출로 접수 확정되어 알림을 보내야 하는 건들
  served_tickets        text[]
)
language plpgsql
volatile
set search_path = namu, pg_temp
as $$
declare
  v_served    text[];
  v_app       namu.applications;
  v_rate      integer;
  v_ahead     integer;
  v_waiting   integer;
  v_base      integer;
begin
  -- 주의: RETURNS TABLE 의 컬럼명(ticket/status/queue_number ...)이 PL/pgSQL 변수가 되어
  --       테이블 컬럼과 이름이 겹친다. 아래 쿼리는 반드시 별칭으로 한정할 것.
  select coalesce(array_agg(d.ticket), '{}'::text[])
    into v_served
    from namu.drain_queue() d;

  select * into v_app
    from namu.applications a where a.ticket = upper(trim(p_ticket));
  if not found then
    return; -- 행 없음 → 애플리케이션에서 404 처리
  end if;

  select s.throughput_per_minute into v_rate from namu.settings s where s.id = true;

  select count(*) into v_waiting
    from namu.applications a where a.status = 'queued';

  if v_app.status = 'queued' then
    select count(*) into v_ahead
      from namu.applications a
     where a.status = 'queued' and a.queue_number < v_app.queue_number;
  else
    v_ahead := 0;
  end if;

  v_base := greatest(v_app.ahead_at_entry, 1);

  return query select
    v_app.ticket,
    v_app.queue_number,
    v_app.status,
    v_ahead,
    v_app.ahead_at_entry,
    case when v_app.status = 'queued'
         then greatest(0, least(100, round(((v_base - v_ahead)::numeric / v_base) * 100)::integer))
         else 100 end,
    case when v_ahead = 0 then 0::numeric
         else round(v_ahead::numeric / greatest(v_rate, 1), 2) end,
    v_rate,
    v_waiting,
    v_app.notify_opt_in,
    v_app.partner_name,
    v_app.product_name,
    v_served;
end;
$$;

comment on function namu.poll_queue(text) is
  '대기실 폴링용. 대기열을 소진시키고 스냅샷 + 알림 대상 접수번호를 함께 반환한다.';


-- 관리자 수동 소진 — 대기열 앞에서 N건을 즉시 접수 확정한다.
create or replace function namu.serve_next(p_count integer)
returns setof namu.applications
language plpgsql
volatile
set search_path = namu, pg_temp
as $$
declare
  v_ids uuid[];
begin
  perform set_config('namu.event_note', '관리자 수동 처리', true);

  with target as (
    select id from namu.applications
     where status = 'queued'
     order by queue_number
     limit greatest(coalesce(p_count, 0), 0)
       for update skip locked
  ), upd as (
    update namu.applications a
       set status = 'received'
      from target t
     where a.id = t.id
    returning a.id
  )
  select coalesce(array_agg(id), '{}'::uuid[]) into v_ids from upd;

  perform set_config('namu.event_note', '', true);

  return query
    select * from namu.applications where id = any(v_ids) order by queue_number;
end;
$$;


-- 상태 변경 (메모 포함) — 트리거가 이력에 메모까지 기록하도록 세션 변수를 설정한다.
create or replace function namu.set_status(
  p_id     uuid,
  p_status namu.application_status,
  p_note   text default null
)
returns namu.applications
language plpgsql
volatile
set search_path = namu, pg_temp
as $$
declare
  v_row namu.applications;
begin
  perform set_config('namu.event_note', coalesce(p_note, ''), true);

  update namu.applications a
     set status = p_status
   where a.id = p_id
  returning a.* into v_row;

  if v_row.id is null then
    raise exception using
      errcode = 'NP005',
      message = '접수 건을 찾을 수 없습니다.',
      detail  = 'APPLICATION_NOT_FOUND';
  end if;

  perform set_config('namu.event_note', '', true);
  return v_row;
end;
$$;


-- 접수 조회 — 접수번호와 휴대폰 해시가 모두 일치할 때만 반환한다.
create or replace function namu.lookup_application(
  p_ticket     text,
  p_phone_hash text
)
returns namu.applications
language sql
stable
set search_path = namu, pg_temp
as $$
  select * from namu.applications
   where ticket = upper(trim(p_ticket))
     and phone_hash = p_phone_hash;
$$;


-- ────────────────────────────────────────────────────────────────────
-- 6. 집계 — 협약단체별 실적·캐시백 (기획서 4.4)
-- ────────────────────────────────────────────────────────────────────

-- 캐시백 비율은 한 곳에서만 정의한다.
create or replace function namu.cashback_rate()
returns numeric language sql immutable as $$ select 0.03::numeric $$;

comment on function namu.cashback_rate() is
  '협약단체 캐시백 비율(3%). 변경 시 이 함수만 수정하면 집계 전체에 반영된다.';


-- 캐시백은 "청약 완료(성사)" 건만 정산 대상이며, 연환산 보험료 기준이다.
create or replace view namu.partner_summaries as
select
  p.code,
  p.name,
  count(a.id) filter (where a.status <> 'cancelled')                          as application_count,
  count(a.id) filter (where a.status = 'completed')                           as completed_count,
  coalesce(sum(a.group_premium * 12) filter (where a.status = 'completed'), 0) as annualized_premium,
  round(
    coalesce(sum(a.group_premium * 12) filter (where a.status = 'completed'), 0)
    * namu.cashback_rate()
  )::bigint                                                                    as cashback
from namu.partners p
left join namu.applications a on a.partner_code = p.code
group by p.code, p.name
order by application_count desc;

comment on view namu.partner_summaries is
  '협약단체별 신청/성사 건수와 예상 캐시백. 관리자 대시보드와 정산서의 단일 기준.';


-- 랜딩 신뢰 지표
create or replace function namu.public_stats()
returns table (
  partner_count      bigint,
  application_count  bigint,
  completed_count    bigint,
  total_saving       bigint
)
language sql
stable
set search_path = namu, pg_temp
as $$
  select
    (select count(*) from namu.partners where active),
    (select count(*) from namu.applications where status <> 'cancelled'),
    (select count(*) from namu.applications where status = 'completed'),
    (select coalesce(sum((designer_premium - group_premium) * 12), 0)
       from namu.applications where status <> 'cancelled');
$$;


-- ────────────────────────────────────────────────────────────────────
-- 7. 권한 — 서버(service_role)만 접근, RLS 로 이중 방어
-- ────────────────────────────────────────────────────────────────────

alter table namu.schema_migrations   enable row level security;
alter table namu.partners            enable row level security;
alter table namu.products            enable row level security;
alter table namu.applications        enable row level security;
alter table namu.application_events  enable row level security;
alter table namu.partner_inquiries   enable row level security;
alter table namu.notification_logs   enable row level security;
alter table namu.settings            enable row level security;

-- 정책을 하나도 만들지 않는다 = anon/authenticated 는 전부 차단(기본 거부).
-- service_role 은 RLS 를 우회하므로 서버에서는 정상 동작한다.
-- 개인정보가 있는 스키마이므로 클라이언트 직접 접근은 열지 않는다.

-- 먼저 전부 회수한다.
-- 함수는 생성 시 PUBLIC 에 EXECUTE 가 자동 부여되므로 PUBLIC 회수가 반드시 필요하다.
revoke all on all tables    in schema namu from public, anon, authenticated;
revoke all on all sequences in schema namu from public, anon, authenticated;
revoke all on all functions in schema namu from public, anon, authenticated;

-- 그 다음 서버 롤에만 부여한다.
grant usage on schema namu to service_role;
grant all privileges on all tables    in schema namu to service_role;
grant all privileges on all sequences in schema namu to service_role;
grant execute on all functions        in schema namu to service_role;

-- 앞으로 추가되는 객체에도 같은 규칙이 자동 적용되도록 한다.
alter default privileges in schema namu revoke execute on functions from public;
alter default privileges in schema namu grant all     on tables    to service_role;
alter default privileges in schema namu grant all     on sequences to service_role;
alter default privileges in schema namu grant execute on functions to service_role;


-- ────────────────────────────────────────────────────────────────────
-- 8. 시드 데이터
--
--    ⚠️ 아래는 화면 검증용 예시입니다. 대외 오픈 전 반드시 교체하세요.
--       · partners : 실제 협약 체결 결과로 교체 (미체결 단체 노출 금지)
--       · products : 제휴 보험사가 확정한 요율로 교체 (광고 심의 대상)
-- ────────────────────────────────────────────────────────────────────

insert into namu.partners (code, name, category, member_count, contracted_at, active) values
  ('ARMY',   '대한민국육군협회',   '공익·안보 단체', 42000, '2026-06-15', true),
  ('NAMU',   '나무상공인연합회',   '소상공인 단체',  18500, '2026-06-28', true),
  ('HANBIT', '한빛교직원공제회',   '교직원 공제',    26400, '2026-07-03', true),
  ('MIRAE',  '미래운수노동조합',   '노동조합',        9800, '2026-07-11', true),
  ('SEJONG', '세종전자산업협회',   '산업 협회',      12300, '2026-07-20', true)
on conflict (code) do update set
  name          = excluded.name,
  category      = excluded.category,
  member_count  = excluded.member_count,
  contracted_at = excluded.contracted_at,
  active        = excluded.active;


insert into namu.products
  (id, name, summary, coverages, designer_premium, group_premium, eligibility, featured, sort_order)
values
  ('acc-plus', '나무 단체상해보험 플러스',
   '일상·업무 중 상해를 폭넓게 보장하는 기본형 단체상해보험',
   '[{"label":"상해사망","amount":"1억 원"},
     {"label":"상해후유장해","amount":"1억 원 한도"},
     {"label":"상해입원일당","amount":"3만 원 / 일"},
     {"label":"골절·화상 진단","amount":"50만 원"}]'::jsonb,
   32000, 26400, '만 15세 ~ 만 70세 · 협약단체 소속 회원 및 배우자', true, 1),

  ('med-real', '나무 단체실손의료비',
   '입원·통원 실제 부담 의료비를 보장하는 4세대 실손 단체형',
   '[{"label":"질병입원 의료비","amount":"5,000만 원"},
     {"label":"질병통원 의료비","amount":"20만 원 / 회"},
     {"label":"상해입원 의료비","amount":"5,000만 원"},
     {"label":"비급여 3종 특약","amount":"약관 기준"}]'::jsonb,
   45000, 37100, '만 19세 ~ 만 65세 · 기존 실손 보유자는 중복 가입 불가', false, 2),

  ('life-term', '나무 단체정기보험',
   '가장의 소득 상실 위험에 대비하는 사망 보장 중심 정기보험',
   '[{"label":"일반사망","amount":"2억 원"},
     {"label":"재해사망","amount":"3억 원"},
     {"label":"장해 시 보험료 납입면제","amount":"50% 이상 장해"}]'::jsonb,
   58000, 47900, '만 20세 ~ 만 60세 · 보험기간 20년 만기', false, 3),

  ('health-3', '나무 단체건강보험 (3대질병)',
   '암·뇌혈관·심장질환 진단비를 집중 보장하는 종합 건강보험',
   '[{"label":"암 진단비","amount":"5,000만 원"},
     {"label":"뇌혈관질환 진단비","amount":"3,000만 원"},
     {"label":"허혈성심장질환 진단비","amount":"3,000만 원"},
     {"label":"질병수술비","amount":"100만 원"}]'::jsonb,
   72000, 59400, '만 20세 ~ 만 65세 · 가입 전 고지의무 대상', true, 4)
on conflict (id) do update set
  name             = excluded.name,
  summary          = excluded.summary,
  coverages        = excluded.coverages,
  designer_premium = excluded.designer_premium,
  group_premium    = excluded.group_premium,
  eligibility      = excluded.eligibility,
  featured         = excluded.featured,
  sort_order       = excluded.sort_order;


insert into namu.schema_migrations (version) values ('001_init_namu')
on conflict (version) do nothing;


-- ────────────────────────────────────────────────────────────────────
-- 9. 실행 결과 확인
-- ────────────────────────────────────────────────────────────────────

select
  '스키마 격리 확인'                                        as check_item,
  (select count(*) from information_schema.tables
    where table_schema = 'namu')::text || '개 테이블 생성'  as result
union all
select '협약단체', (select count(*)::text from namu.partners) || '개'
union all
select '보험상품', (select count(*)::text from namu.products) || '개'
union all
select '평균 절감률',
       (select round(avg((designer_premium - group_premium)::numeric
                         / designer_premium * 100), 1)::text from namu.products) || '%'
union all
select '캐시백 비율', (namu.cashback_rate() * 100)::text || '%'
union all
select 'public 스키마 영향',
       '없음 (기존 앱 테이블 ' ||
       (select count(*)::text from information_schema.tables
         where table_schema = 'public') || '개 그대로)';
