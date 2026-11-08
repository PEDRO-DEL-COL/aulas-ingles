-- pgTAP: disponibilidade da professora e reposicao so dentro dela e fora de ferias
-- (migrations 20261116000001, 20261118000001 e 20261119000001).
-- Roda numa transacao com ROLLBACK (supabase test db).

begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

create function pg_temp.as_user(p_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

create function pg_temp.as_anon() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  perform set_config('role', 'anon', true);
end $$;

-- Usuarios: aluno, professora e admin.
insert into public.students (id, full_name, email) values
  ('a0000000-0000-0000-0000-00000000000a', 'Aluno A', 'a@test.local');
insert into auth.users (id, email, raw_user_meta_data, email_confirmed_at) values
  ('a1000000-0000-0000-0000-00000000000a', 'a@test.local',     '{"full_name":"Aluno A"}', now()),
  ('d1000000-0000-0000-0000-0000000000d1', 'prof@test.local',  '{"full_name":"Professora"}', now()),
  ('d2000000-0000-0000-0000-0000000000d2', 'admin@test.local', '{"full_name":"Admin"}', now());
update public.profiles set role = 'professora', active = true where id = 'd1000000-0000-0000-0000-0000000000d1';
update public.profiles set role = 'admin', active = true where id = 'd2000000-0000-0000-0000-0000000000d2';

-- Origens com direito a reposicao (canceladas pela professora; nao contam no limite).
insert into public.lessons (id, student_id, starts_at, status) values
  ('11111111-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-00000000000a', '2027-03-01 21:00+00', 'cancelada_professora'),
  ('11111111-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-00000000000a', '2027-03-02 21:00+00', 'cancelada_professora'),
  ('11111111-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-00000000000a', '2027-03-03 21:00+00', 'cancelada_professora');

-- 2027-04-05 e uma segunda-feira (weekday 1). 13:00 UTC = 10:00 em Sao Paulo.
select pg_temp.as_user('d1000000-0000-0000-0000-0000000000d1');
select is((select public.check_makeup_slot('2027-04-05 13:00+00', 60)), 'ok',
          'sem disponibilidade cadastrada, qualquer horario fora de ferias vale');
select lives_ok($$select public.schedule_makeup('11111111-0000-0000-0000-000000000001', '2027-04-05 13:00+00')$$,
                'reposicao aceita sem disponibilidade configurada');
-- Desde a migration 18 as faixas pertencem a um horario padrao (com vigencia).
insert into public.availability_patterns (id, starts_on) values ('cccccccc-0000-0000-0000-000000000001', '2027-01-01');
select throws_ok($$insert into public.availability_slots (pattern_id, weekday, start_time, end_time) values ('cccccccc-0000-0000-0000-000000000001', 1, '12:00', '08:00')$$,
                 '23514', null, 'faixa com fim antes do inicio e rejeitada');
select lives_ok($$insert into public.availability_slots (pattern_id, weekday, start_time, end_time) values ('cccccccc-0000-0000-0000-000000000001', 1, '08:00', '12:00')$$,
                'professora cadastra disponibilidade (segunda 08-12)');
select is((select public.check_makeup_slot('2027-04-12 13:00+00', 60)), 'ok', 'segunda 10:00 por 60 min cabe');
select is((select public.check_makeup_slot('2027-04-12 14:30+00', 60)), 'fora_disponibilidade',
          'segunda 11:30 por 60 min passa do fim da faixa');
select is((select public.check_makeup_slot('2027-04-13 13:00+00', 60)), 'fora_disponibilidade', 'terca sem faixa');
select lives_ok($$select public.schedule_makeup('11111111-0000-0000-0000-000000000002', '2027-04-12 13:00+00')$$,
                'reposicao dentro da faixa e aceita');
select throws_ok($$select public.schedule_makeup('11111111-0000-0000-0000-000000000003', '2027-04-13 13:00+00')$$,
                 '23514', 'reposicao fora da disponibilidade da professora', 'reposicao fora da faixa e rejeitada');
select lives_ok($$insert into public.blocked_dates (starts_on, ends_on, reason) values ('2027-04-19', '2027-04-19', 'feriado')$$,
                'professora cadastra feriado numa segunda');
select is((select public.check_makeup_slot('2027-04-19 13:00+00', 60)), 'bloqueado', 'feriado vale por cima da faixa');
select throws_ok($$select public.schedule_makeup('11111111-0000-0000-0000-000000000003', '2027-04-19 13:00+00')$$,
                 '23514', 'reposicao em ferias ou feriado: escolha outra data', 'reposicao em feriado e rejeitada');
-- Mover uma reposicao existente para fora da faixa tambem e barrado.
select throws_ok($$update public.lessons set starts_at = '2027-04-13 13:00+00'
                   where rescheduled_from = '11111111-0000-0000-0000-000000000002'$$,
                 '23514', null, 'mover reposicao para fora da faixa e rejeitado');
-- Desde a migration 19 a regra vale para qualquer aula agendada, nao so reposicao.
select throws_ok($$insert into public.lessons (student_id, starts_at) values ('a0000000-0000-0000-0000-00000000000a', '2027-04-13 13:00+00')$$,
                 '23514', 'aula fora da disponibilidade da professora: escolha um horario disponivel',
                 'aula comum fora da faixa tambem e rejeitada (migration 19)');
reset role;

select pg_temp.as_user('a1000000-0000-0000-0000-00000000000a');
select is((select count(*)::int from public.availability_slots), 0, 'aluno nao ve a disponibilidade');
select throws_ok($$insert into public.availability_slots (pattern_id, weekday, start_time, end_time) values ('cccccccc-0000-0000-0000-000000000001', 2, '08:00', '09:00')$$,
                 '42501', null, 'aluno nao cadastra disponibilidade');
reset role;

select * from finish();
rollback;
