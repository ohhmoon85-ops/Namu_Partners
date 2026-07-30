-- ════════════════════════════════════════════════════════════════════
--  나무파트너스 — 002 상품 모델 변경
--
--  ▸ 왜 바꾸나
--    나무파트너스는 특정 상품을 판매하는 것이 아니라 국내 보험사의 상품
--    전반을 취급한다. 가입자는 시장에서 이미 상품을 정한 뒤 더 저렴하게
--    가입하러 온다. 따라서 플랫폼이 상품 목록을 제시하는 구조(001)를 버리고,
--    "보험 종류 + 고객이 알려준 보험사·상품명·안내받은 보험료"를 받는다.
--
--  ▸ 무엇이 바뀌나
--    - namu.products 테이블 제거 → namu.insurance_categories 로 대체
--    - applications: product_id / designer_premium / group_premium 제거
--                    category_code / insurer / product_name /
--                    quoted_premium / estimated_premium / final_premium / memo 추가
--    - 캐시백 정산 기준: 청약 완료 시 담당자가 입력한 확정 보험료(final_premium)
--
--  ▸ 사용법: SQL Editor 에 이 파일 전체를 붙여넣고 RUN
--    001_init_namu.sql 을 먼저 실행한 상태여야 합니다.
--    접수 데이터가 이미 있다면 하단 "0. 사전 점검"에서 중단됩니다.
-- ════════════════════════════════════════════════════════════════════


-- ────────────────────────────────────────────────────────────────────
-- 0. 사전 점검 — 기존 접수 데이터가 있으면 중단한다.
--    (보험료 컬럼 구조가 바뀌므로 데이터가 있으면 수동 이관이 필요하다)
-- ────────────────────────────────────────────────────────────────────

do $$
declare
  v_count integer;
begin
  select count(*) into v_count from namu.applications;
  if v_count > 0 then
    raise exception using
      errcode = 'NP900',
      message = format('기존 접수 데이터가 %s건 있습니다. 마이그레이션을 중단합니다.', v_count),
      detail  = '데이터를 백업·이관한 뒤 이 점검 블록을 지우고 다시 실행하세요.';
  end if;
end $$;


-- ────────────────────────────────────────────────────────────────────
-- 1. 의존 객체 제거 (뷰 → 함수 순서)
-- ────────────────────────────────────────────────────────────────────

drop view if exists namu.partner_summaries;

drop function if exists namu.create_application(
  text, text, text, text, text, text, text, boolean, boolean);
drop function if exists namu.poll_queue(text);
drop function if exists namu.public_stats();


-- ────────────────────────────────────────────────────────────────────
-- 2. 보험 종류 테이블
-- ────────────────────────────────────────────────────────────────────

create table if not exists namu.insurance_categories (
  code        text    primary key,
  name        text    not null,
  -- 어떤 보험이 여기 속하는지 가입자에게 보여줄 예시
  examples    text    not null default '',
  sort_order  integer not null default 0,
  active      boolean not null default true
);

comment on table namu.insurance_categories is
  '가입 신청 시 선택하는 보험 종류. 상품 자체는 고객이 직접 입력한다.';

insert into namu.insurance_categories (code, name, examples, sort_order) values
  ('medical',  '실손의료비 (실비)',   '입원·통원 실제 부담 의료비', 1),
  ('critical', '암·3대질병',          '암, 뇌혈관질환, 허혈성심장질환 진단비', 2),
  ('life',     '종신·정기 (사망보장)', '종신보험, 정기보험, 유족 생활자금', 3),
  ('accident', '상해·재해',           '상해사망·후유장해, 골절, 입원일당', 4),
  ('driver',   '운전자',              '교통사고처리지원금, 변호사 선임비용, 벌금', 5),
  ('child',    '어린이·태아',         '자녀 종합보장, 태아보험', 6),
  ('dental',   '치아',                '임플란트, 크라운, 충전치료', 7),
  ('care',     '간병·치매',           '장기요양등급, 치매 진단·간병자금', 8),
  ('property', '화재·재물',           '주택화재, 상가·사업장 재물, 배상책임', 9),
  ('etc',      '기타 / 잘 모르겠어요', '위에 없는 보험이거나 상담을 통해 정하고 싶은 경우', 10)
on conflict (code) do update set
  name       = excluded.name,
  examples   = excluded.examples,
  sort_order = excluded.sort_order,
  active     = true;


-- ────────────────────────────────────────────────────────────────────
-- 3. applications 구조 변경
-- ────────────────────────────────────────────────────────────────────

-- 중복 방지 기준을 상품에서 보험 종류로 바꾼다.
drop index if exists namu.applications_active_dup_idx;

alter table namu.applications
  drop column if exists product_id,
  drop column if exists product_name,
  drop column if exists designer_premium,
  drop column if exists group_premium;

alter table namu.applications
  add column if not exists category_code text
    references namu.insurance_categories(code),
  add column if not exists category_name text not null default '',
  -- 고객이 알려준 희망 보험사·상품명 (선택 입력)
  add column if not exists insurer text not null default '',
  add column if not exists product_name text not null default '',
  -- 설계사·비교사이트에서 안내받은 월 보험료
  add column if not exists quoted_premium integer
    check (quoted_premium is null or quoted_premium > 0),
  -- 안내 시점의 예상 보험료 = quoted_premium × (1 − 절감률)
  add column if not exists estimated_premium integer
    check (estimated_premium is null or estimated_premium > 0),
  -- 청약 완료 시 담당자가 입력하는 확정 월 보험료 (캐시백 정산 기준)
  add column if not exists final_premium integer
    check (final_premium is null or final_premium > 0),
  add column if not exists memo text not null default '';

-- 신규 접수부터는 보험 종류가 반드시 있어야 한다.
alter table namu.applications
  alter column category_code set not null;

comment on column namu.applications.quoted_premium is
  '고객이 시장에서 안내받았다고 입력한 월 보험료. 검증된 값이 아니다.';
comment on column namu.applications.final_premium is
  '청약 완료 시 담당자가 입력하는 확정 월 보험료. 캐시백 정산의 유일한 근거.';

-- 같은 사람이 같은 "종류"의 보험을 중복 신청하는 것만 막는다.
create unique index if not exists applications_active_dup_idx
  on namu.applications (phone_hash, category_code)
  where status not in ('completed', 'cancelled');

create index if not exists applications_category_idx
  on namu.applications (category_code, status);

drop table if exists namu.products;


-- ────────────────────────────────────────────────────────────────────
-- 4. 절감률 — 예상 보험료 계산의 단일 기준
-- ────────────────────────────────────────────────────────────────────

create or replace function namu.saving_rate()
returns numeric language sql immutable as $$ select 0.175::numeric $$;

comment on function namu.saving_rate() is
  '평균 절감률(17.5%). 광고 표기 및 예상 보험료 계산의 단일 기준.';


-- ────────────────────────────────────────────────────────────────────
-- 5. 접수 생성 (신규 시그니처)
-- ────────────────────────────────────────────────────────────────────

create or replace function namu.create_application(
  p_partner_code      text,
  p_category_code     text,
  p_insurer           text,
  p_product_name      text,
  p_quoted_premium    integer,
  p_memo              text,
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
  v_category  namu.insurance_categories;
  v_paused    boolean;
  v_queue_no  bigint;
  v_ticket    text;
  v_ahead     integer;
  v_quoted    integer;
  v_estimated integer;
  v_row       namu.applications;
begin
  select s.intake_paused into v_paused from namu.settings s where s.id = true;
  if v_paused then
    raise exception using
      errcode = 'NP001',
      message = '현재 신규 접수가 일시 중지되었습니다.',
      detail  = 'INTAKE_PAUSED';
  end if;

  select * into v_partner
    from namu.partners p where p.code = upper(btrim(p_partner_code)) and p.active;
  if not found then
    raise exception using
      errcode = 'NP002', message = '유효하지 않은 협약단체입니다.', detail = 'INVALID_PARTNER';
  end if;

  select * into v_category
    from namu.insurance_categories c where c.code = p_category_code and c.active;
  if not found then
    raise exception using
      errcode = 'NP003', message = '보험 종류를 선택해 주세요.', detail = 'INVALID_CATEGORY';
  end if;

  -- 순번을 발급하기 전에 대기열을 먼저 소진시켜야
  -- "내 앞 대기 인원"이 실제와 어긋나지 않는다.
  perform namu.drain_queue();

  select count(*) into v_ahead from namu.applications a where a.status = 'queued';

  v_quoted := case when p_quoted_premium is not null and p_quoted_premium > 0
                   then p_quoted_premium else null end;
  v_estimated := case when v_quoted is null then null
                      else round(v_quoted * (1 - namu.saving_rate()))::integer end;

  v_queue_no := nextval('namu.queue_number_seq');
  v_ticket := 'NP-'
            || to_char(now() at time zone 'Asia/Seoul', 'YYYYMMDD')
            || '-' || lpad(v_queue_no::text, 4, '0');

  begin
    insert into namu.applications (
      ticket, queue_number, ahead_at_entry,
      partner_code, partner_name,
      category_code, category_name, insurer, product_name,
      quoted_premium, estimated_premium, memo,
      name_enc, phone_enc, birth_enc, phone_hash, gender,
      notify_opt_in, marketing_opt_in
    ) values (
      v_ticket, v_queue_no, v_ahead,
      v_partner.code, v_partner.name,
      v_category.code, v_category.name,
      coalesce(btrim(p_insurer), ''), coalesce(btrim(p_product_name), ''),
      v_quoted, v_estimated, coalesce(btrim(p_memo), ''),
      p_name_enc, p_phone_enc, p_birth_enc, p_phone_hash,
      coalesce(p_gender, ''),
      p_notify_opt_in, p_marketing_opt_in
    )
    returning * into v_row;
  exception when unique_violation then
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


-- ────────────────────────────────────────────────────────────────────
-- 6. 대기실 폴링 (신청 요약 문구 반환)
-- ────────────────────────────────────────────────────────────────────

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
  request_label         text,
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
  -- 주의: RETURNS TABLE 의 컬럼명이 PL/pgSQL 변수가 되어 테이블 컬럼과 겹친다.
  --       아래 쿼리는 반드시 별칭으로 한정할 것.
  select coalesce(array_agg(d.ticket), '{}'::text[])
    into v_served
    from namu.drain_queue() d;

  select * into v_app
    from namu.applications a where a.ticket = upper(btrim(p_ticket));
  if not found then
    return;
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
    -- 상품명을 입력했으면 그것을, 아니면 보험 종류를 보여준다.
    case when v_app.product_name <> ''
         then btrim(v_app.insurer || ' ' || v_app.product_name)
         else v_app.category_name end,
    v_served;
end;
$$;


-- ────────────────────────────────────────────────────────────────────
-- 7. 집계 재정의
-- ────────────────────────────────────────────────────────────────────

-- 캐시백 정산 기준 보험료: 확정값이 있으면 그것, 없으면 예상값
create or replace function namu.settlement_premium(namu.applications)
returns integer
language sql
immutable
as $$ select coalesce($1.final_premium, $1.estimated_premium, 0) $$;

comment on function namu.settlement_premium(namu.applications) is
  '캐시백 정산 기준 월 보험료. 청약 완료 시 입력한 확정 보험료를 우선한다.';

create or replace view namu.partner_summaries as
select
  p.code,
  p.name,
  count(a.id) filter (where a.status <> 'cancelled')  as application_count,
  count(a.id) filter (where a.status = 'completed')   as completed_count,
  coalesce(sum(namu.settlement_premium(a) * 12)
             filter (where a.status = 'completed'), 0) as annualized_premium,
  round(
    coalesce(sum(namu.settlement_premium(a) * 12)
               filter (where a.status = 'completed'), 0) * namu.cashback_rate()
  )::bigint                                            as cashback
from namu.partners p
left join namu.applications a on a.partner_code = p.code
group by p.code, p.name
order by application_count desc;

comment on view namu.partner_summaries is
  '협약단체별 신청/성사 건수와 예상 캐시백. 관리자 전용 — 가입자 화면에 노출 금지.';


-- 랜딩 신뢰 지표 (캐시백 관련 수치는 절대 포함하지 않는다)
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
    -- 안내받은 보험료를 입력한 건만 절감액으로 집계한다.
    (select coalesce(sum((quoted_premium - estimated_premium) * 12), 0)
       from namu.applications
      where status <> 'cancelled'
        and quoted_premium is not null
        and estimated_premium is not null);
$$;


-- ────────────────────────────────────────────────────────────────────
-- 8. 권한 재적용 (신규 객체 포함)
-- ────────────────────────────────────────────────────────────────────

alter table namu.insurance_categories enable row level security;

revoke all on all tables    in schema namu from public, anon, authenticated;
revoke all on all sequences in schema namu from public, anon, authenticated;
revoke all on all functions in schema namu from public, anon, authenticated;

grant usage on schema namu to service_role;
grant all privileges on all tables    in schema namu to service_role;
grant all privileges on all sequences in schema namu to service_role;
grant execute on all functions        in schema namu to service_role;

insert into namu.schema_migrations (version) values ('002_market_products')
on conflict (version) do nothing;


-- ────────────────────────────────────────────────────────────────────
-- 9. 실행 결과 확인
-- ────────────────────────────────────────────────────────────────────

select '보험 종류' as check_item,
       (select count(*)::text from namu.insurance_categories where active) || '개' as result
union all
select 'products 테이블 제거',
       case when to_regclass('namu.products') is null then '완료' else '아직 남아 있음' end
union all
select 'applications 신규 컬럼',
       (select count(*)::text from information_schema.columns
         where table_schema = 'namu' and table_name = 'applications'
           and column_name in ('category_code','insurer','product_name',
                               'quoted_premium','estimated_premium','final_premium','memo'))
       || '/7개'
union all
select '평균 절감률', (namu.saving_rate() * 100)::text || '%'
union all
select '캐시백 비율(관리자 전용)', (namu.cashback_rate() * 100)::text || '%'
union all
select '적용된 마이그레이션',
       (select string_agg(version, ', ' order by version) from namu.schema_migrations);
