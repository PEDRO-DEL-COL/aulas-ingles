-- pgTAP: disponibilidade como regra primaria para todas as aulas (migration 20261119000001).
-- Roda numa transacao com ROLLBACK (supabase test db).

begin;
create extension if not exists pgtap with schema extensions;
select plan(19);

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

-- Aulas criadas ANTES de existir horario padrao (permissivo): nao sao invalidadas depois.
insert into public.lessons (id, student_id, starts_at, status) values
  ('11111111-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-00000000000a', '2027-05-04 23:00+00', 'agendada'),
  ('11111111-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-00000000000a', '2027-05-05 23:00+00', 'agendada');

-- Horario padrao: seg-sex 09-12 e 13-17 em 2027 (Sao Paulo = UTC-3).
insert into public.availability_patterns (id, starts_on, ends_on) values
  ('cccccccc-0000-0000-0000-000000000001', '2027-01-01', '2027-12-31');
insert into public.availability_slots (pattern_id, weekday, start_time, end_time)
  select 'cccccccc-0000-0000-0000-000000000001', d, t.s, t.e
  from generate_series(1, 5) d
  cross join (values ('09:00'::time, '12:00'::time), ('13:00'::time, '17:00'::time)) t(s, e);

select pg_temp.as_user('d1000000-0000-0000-0000-0000000000d1');

-- Avulsa.
select lives_ok($$insert into public.lessons (id, student_id, starts_at) values
                  ('11111111-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-00000000000a', '2027-05-03 12:00+00')$$,
                'avulsa no horario disponivel (seg 09:00)');
select throws_ok($$insert into public.lessons (student_id, starts_at) values ('a0000000-0000-0000-0000-00000000000a', '2027-05-03 15:00+00')$$,
                 '23514', 'aula fora da disponibilidade da professora: escolha um horario disponivel',
                 'avulsa no almoco e rejeitada');
select throws_ok($$insert into public.lessons (student_id, starts_at) values ('a0000000-0000-0000-0000-00000000000a', '2027-05-01 13:00+00')$$,
                 '23514', null, 'avulsa no sabado (sem faixa) e rejeitada');

-- Remarcacao.
select throws_ok($$update public.lessons set starts_at = '2027-05-03 22:00+00' where id = '11111111-0000-0000-0000-000000000003'$$,
                 '23514', null, 'remarcar para 19:00 local e rejeitado');
select lives_ok($$update public.lessons set starts_at = '2027-05-03 17:00+00' where id = '11111111-0000-0000-0000-000000000003'$$,
                'remarcar para 14:00 local e aceito');
select throws_ok($$update public.lessons set duration_minutes = 240 where id = '11111111-0000-0000-0000-000000000003'$$,
                 '23514', null, 'aumentar a duracao para passar do fim da faixa e rejeitado');

-- Aulas antigas fora do horario: continuam validas; mudar so outros campos nao revalida.
select lives_ok($$update public.lessons set meet_link = 'https://meet.google.com/abc-defg-hij' where id = '11111111-0000-0000-0000-000000000001'$$,
                'aula antiga fora do horario: editar outro campo continua permitido');
select lives_ok($$select public.cancel_lesson('11111111-0000-0000-0000-000000000002', 'teste', true)$$,
                'aula antiga fora do horario pode ser cancelada');
select lives_ok($$update public.lessons set status = 'realizada' where id = '11111111-0000-0000-0000-000000000001'$$,
                'aula antiga fora do horario pode ser marcada como realizada');

-- Ferias.
select lives_ok($$insert into public.blocked_dates (starts_on, ends_on, reason) values ('2027-05-10', '2027-05-10', 'feriado')$$,
                'feriado cadastrado');
select throws_ok($$insert into public.lessons (student_id, starts_at) values ('a0000000-0000-0000-0000-00000000000a', '2027-05-10 12:00+00')$$,
                 '23514', 'aula em ferias, feriado ou dia fechado: escolha outra data', 'avulsa em feriado e rejeitada');

-- Geracao recorrente: horario fixo seg 09:00 (cabe) e ter 18:00 (fora); 2027-05-10 e feriado.
insert into public.schedules (id, student_id, weekday, start_time, starts_on) values
  ('33333333-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-00000000000a', 1, '09:00', '2027-05-01'),
  ('33333333-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-00000000000a', 2, '18:00', '2027-05-01');
select is((select (public.generate_recurring_lessons('2027-05-10', '2027-05-23') ->> 'created')::int), 1,
          'gera so a segunda 17/05 (10/05 e feriado; terca 18:00 fica fora)');
select is((select (public.generate_recurring_lessons('2027-05-10', '2027-05-23') ->> 'skipped_total')::int), 2,
          'segunda execucao relata as 2 tercas fora do horario (nada novo criado)');
select is((select public.generate_recurring_lessons('2027-05-10', '2027-05-23') -> 'skipped' -> 0 ->> 'reason'),
          'fora_disponibilidade', 'motivo do pulo');
select lives_ok($$select public.generate_lessons('2027-05-24', '2027-05-30')$$,
                'generate_lessons antigo nao falha o lote: so pula o que nao cabe');
select is((select count(*)::int from public.lessons where schedule_id = '33333333-0000-0000-0000-000000000002'), 0,
          'nenhuma aula de terca 18:00 foi criada');
reset role;

-- Aluno nao gera aulas.
select pg_temp.as_user('a1000000-0000-0000-0000-00000000000a');
select throws_ok($$select public.generate_recurring_lessons('2027-05-10', '2027-05-23')$$, '42501', null,
                 'aluno nao gera aulas');
reset role;

-- Sem horario padrao ativo: permissivo (o app alerta).
update public.availability_patterns set active = false;
select pg_temp.as_user('d1000000-0000-0000-0000-0000000000d1');
select lives_ok($$insert into public.lessons (student_id, starts_at) values ('a0000000-0000-0000-0000-00000000000a', '2027-05-15 13:00+00')$$,
                'sem padrao ativo: sabado 10:00 e aceito');
select throws_ok($$insert into public.lessons (student_id, starts_at) values ('a0000000-0000-0000-0000-00000000000a', '2027-05-10 15:00+00')$$,
                 '23514', null, 'sem padrao ativo: feriado continua bloqueado');
reset role;

select * from finish();
rollback;
