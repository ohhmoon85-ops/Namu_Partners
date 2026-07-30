-- ════════════════════════════════════════════════════════════════════
--  테스트 데이터 정리
--
--  ⚠️ 접수·문의·알림 이력을 전부 삭제하고 순번을 1번부터 다시 시작합니다.
--     실제 고객 접수가 들어온 뒤에는 절대 실행하지 마세요.
--
--  실행: npm run db:migrate -- db/supabase/clean_test_data.sql
-- ════════════════════════════════════════════════════════════════════

-- application_events 는 ON DELETE CASCADE 로 함께 삭제된다.
delete from namu.notification_logs;
delete from namu.applications;
delete from namu.partner_inquiries;

-- 접수번호가 NP-YYYYMMDD-0001 부터 다시 발급되도록 순번을 되돌린다.
alter sequence namu.queue_number_seq restart with 1;

-- 대기열 기준 시각도 현재로 리셋한다.
update namu.settings
   set last_advance_at = now(),
       intake_paused   = false
 where id = true;

select '남은 접수'   as check_item, (select count(*)::text from namu.applications)       as result
union all
select '남은 이력',   (select count(*)::text from namu.application_events)
union all
select '남은 문의',   (select count(*)::text from namu.partner_inquiries)
union all
select '남은 알림',   (select count(*)::text from namu.notification_logs)
union all
select '다음 순번',   coalesce(pg_sequence_last_value('namu.queue_number_seq'::regclass)::text, '1');
