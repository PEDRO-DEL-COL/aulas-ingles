-- pgTAP: calendario - horario padrao com vigencia, excecoes por data e regra efetiva
-- (availability_minutes / is_slot_available, migration 20261118000001).
-- Roda numa transacao com ROLLBACK (supabase test db).

begin;
create extension if not exists pgtap with schema extensions;
select plan(33);

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

-- Horario padrao: seg-sex 09-12 e 13-17 (almoco 12-13), vigente em 2027.
insert into public.availability_patterns (id, name, starts_on, ends_on, default_lesson_minutes) values
  ('cccccccc-0000-0000-0000-000000000001', 'Padrao 2027', '2027-01-01', '2027-12-31', 60);
insert into public.availability_slots (pattern_id, weekday, start_time, end_time)
  select 'cccccccc-0000-0000-0000-000000000001', d, t.s, t.e
  from generate_series(1, 5) d
  cross join (values ('09:00'::time, '12:00'::time), ('13:00'::time, '17:00'::time)) t(s, e);

-- 2027-05-03 = segunda. Sao Paulo = UTC-3 (sem horario de verao desde 2019).
select pg_temp.as_user('d1000000-0000-0000-0000-0000000000d1');
select is((select public.availability_minutes('2027-05-03')), '{[540,720),[780,1020)}'::int4multirange,
          'segunda: 09-12 e 13-17 em minutos');
select is((select public.availability_minutes('2027-05-01')), '{}'::int4multirange, 'sabado: vazio');
select is((select public.availability_minutes('2028-01-03')), '{}'::int4multirange,
          'fora da vigencia do padrao: vazio');
select is((select public.is_slot_available('2027-05-03 12:00+00', 60)), 'ok', '09:00 local por 60 min');
select is((select public.is_slot_available('2027-05-03 14:30+00', 60)), 'fora_disponibilidade',
          '11:30 por 60 min invade o almoco');
select is((select public.is_slot_available('2027-05-03 16:00+00', 60)), 'ok', '13:00 local');
select is((select public.is_slot_available('2027-05-03 19:30+00', 60)), 'fora_disponibilidade',
          '16:30 por 60 min passa do fim');
select is((select public.is_slot_available('2027-05-04 02:30+00', 60)), 'fora_disponibilidade',
          '23:30 local por 60 min atravessaria a meia-noite');

-- Excecoes por data.
select lives_ok($$insert into public.availability_exceptions (on_date, kind, start_time, end_time)
                  values ('2027-05-03', 'bloqueio', '10:00', '11:00')$$, 'bloqueia 10-11 na segunda');
select is((select public.is_slot_available('2027-05-03 13:00+00', 60)), 'fora_disponibilidade',
          '10:00 local agora bloqueado');
select is((select public.is_slot_available('2027-05-03 14:00+00', 60)), 'ok', '11:00 local continua livre');
select lives_ok($$insert into public.availability_exceptions (on_date, kind, start_time, end_time)
                  values ('2027-05-01', 'extra', '10:00', '12:00')$$, 'horario extra no sabado');
select is((select public.is_slot_available('2027-05-01 13:00+00', 60)), 'ok', 'sabado 10:00 com extra');
select lives_ok($$insert into public.availability_exceptions (on_date, kind, start_time, end_time)
                  values ('2027-05-04', 'substituir', '18:00', '21:00')$$, 'terca so a noite');
select is((select public.availability_minutes('2027-05-04')), '{[1080,1260)}'::int4multirange,
          'substituir troca o horario do dia');
select is((select public.is_slot_available('2027-05-04 12:00+00', 60)), 'fora_disponibilidade',
          'terca 09:00 deixou de valer');
select lives_ok($$insert into public.availability_exceptions (on_date, kind) values ('2027-05-05', 'fechado')$$,
                'quarta fechada');
select is((select public.is_slot_available('2027-05-05 12:00+00', 60)), 'bloqueado', 'dia fechado = bloqueado');
select throws_ok($$insert into public.availability_exceptions (on_date, kind) values ('2027-05-06', 'bloqueio')$$,
                 '23514', null, 'bloqueio sem faixa e rejeitado');
select throws_ok($$insert into public.availability_exceptions (on_date, kind, start_time, end_time)
                   values ('2027-05-06', 'fechado', '09:00', '10:00')$$,
                 '23514', null, 'fechado com faixa e rejeitado');
select lives_ok($$insert into public.availability_exceptions (on_date, kind, start_time, end_time)
                  values ('2027-05-07', 'extra', '20:00', '24:00')$$, 'extra ate 24:00');
select is((select public.is_slot_available('2027-05-08 02:00+00', 60)), 'ok', 'sexta 23:00 local cabe ate 24:00');

-- Ferias continuam valendo por cima de tudo.
select lives_ok($$insert into public.blocked_dates (starts_on, ends_on, reason) values ('2027-05-10', '2027-05-14', 'ferias')$$,
                'ferias cadastradas');
select is((select public.is_slot_available('2027-05-10 12:00+00', 60)), 'bloqueado', 'ferias bloqueiam');

-- Reposicao usa a regra nova.
insert into public.lessons (id, student_id, starts_at, status) values
  ('11111111-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-00000000000a', '2027-04-01 21:00+00', 'cancelada_professora'),
  ('11111111-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-00000000000a', '2027-04-02 21:00+00', 'cancelada_professora');
select lives_ok($$select public.schedule_makeup('11111111-0000-0000-0000-000000000001', '2027-05-01 13:00+00')$$,
                'reposicao no horario extra do sabado');
select throws_ok($$select public.schedule_makeup('11111111-0000-0000-0000-000000000002', '2027-05-03 13:00+00')$$,
                 '23514', 'reposicao fora da disponibilidade da professora', 'reposicao no bloqueio e rejeitada');
select is((select public.check_makeup_slot('2027-05-03 12:00+00', 60)), 'ok', 'check_makeup_slot delega para a regra nova');

-- Padrao inativo: sem nenhum padrao ativo volta ao "nao configurado" (dia inteiro).
select lives_ok($$update public.availability_patterns set active = false$$, 'desativa o padrao');
select is((select public.is_slot_available('2027-05-15 13:00+00', 60)), 'ok', 'sem padrao ativo: dia inteiro');
select is((select public.is_slot_available('2027-05-03 13:00+00', 60)), 'fora_disponibilidade',
          'bloqueio de horas continua valendo sem padrao');
reset role;

-- Aluno nao le nem grava padroes/excecoes.
select pg_temp.as_user('a1000000-0000-0000-0000-00000000000a');
select is((select count(*)::int from public.availability_patterns), 0, 'aluno nao ve padroes');
select is((select count(*)::int from public.availability_exceptions), 0, 'aluno nao ve excecoes');
select throws_ok($$insert into public.availability_exceptions (on_date, kind) values ('2027-06-01', 'fechado')$$,
                 '42501', null, 'aluno nao cria excecao');
reset role;

select * from finish();
rollback;
