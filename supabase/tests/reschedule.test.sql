-- pgTAP: remarcacao desliga a ocorrencia do horario fixo e aulas so no futuro
-- (migration 20261120000001). Roda numa transacao com ROLLBACK (supabase test db).

begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

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

-- Horario padrao seg-sex 09-12 e 13-17 em 2027; horario fixo do aluno: segunda 09:00.
insert into public.availability_patterns (id, starts_on, ends_on) values
  ('cccccccc-0000-0000-0000-000000000001', '2027-01-01', '2027-12-31');
insert into public.availability_slots (pattern_id, weekday, start_time, end_time)
  select 'cccccccc-0000-0000-0000-000000000001', d, t.s, t.e
  from generate_series(1, 5) d
  cross join (values ('09:00'::time, '12:00'::time), ('13:00'::time, '17:00'::time)) t(s, e);
insert into public.schedules (id, student_id, weekday, start_time, starts_on) values
  ('33333333-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-00000000000a', 1, '09:00', '2027-05-01');

select pg_temp.as_user('d1000000-0000-0000-0000-0000000000d1');
select is((select (public.generate_recurring_lessons('2027-05-03', '2027-05-16') ->> 'created')::int), 2,
          'gera as segundas 03/05 e 10/05');

-- Remarca a de 03/05 09:00 (12:00 UTC) para terca 04/05 14:00 (17:00 UTC).
select lives_ok($$update public.lessons set starts_at = '2027-05-04 17:00+00'
                  where schedule_id = '33333333-0000-0000-0000-000000000001' and starts_at = '2027-05-03 12:00+00'$$,
                'remarca a ocorrencia de 03/05');
select is((select original_starts_at from public.lessons
           where schedule_id = '33333333-0000-0000-0000-000000000001' and starts_at = '2027-05-04 17:00+00'),
          '2027-05-03 12:00+00'::timestamptz, 'guarda o horario original da ocorrencia');
select is((select (public.generate_recurring_lessons('2027-05-03', '2027-05-16') ->> 'created')::int), 0,
          'gerar de novo nao recria a aula no horario original');
select is((select count(*)::int from public.lessons where schedule_id = '33333333-0000-0000-0000-000000000001'), 2,
          'continuam 2 aulas do horario fixo');

-- Remarcar de novo mantem o original da primeira vez.
select lives_ok($$update public.lessons set starts_at = '2027-05-05 17:00+00'
                  where schedule_id = '33333333-0000-0000-0000-000000000001' and starts_at = '2027-05-04 17:00+00'$$,
                'remarca outra vez');
select is((select original_starts_at from public.lessons
           where schedule_id = '33333333-0000-0000-0000-000000000001' and starts_at = '2027-05-05 17:00+00'),
          '2027-05-03 12:00+00'::timestamptz, 'original continua sendo o da ocorrencia');
select lives_ok($$update public.lessons set original_starts_at = null
                  where schedule_id = '33333333-0000-0000-0000-000000000001' and starts_at = '2027-05-05 17:00+00'$$,
                'tentar apagar o original nao da erro');
select isnt((select original_starts_at from public.lessons
             where schedule_id = '33333333-0000-0000-0000-000000000001' and starts_at = '2027-05-05 17:00+00'),
            null, 'mas o original nao e apagado');

-- Cancelada tambem nao e recriada.
select lives_ok($$select public.cancel_lesson(
                  (select id from public.lessons where schedule_id = '33333333-0000-0000-0000-000000000001'
                   and starts_at = '2027-05-10 12:00+00'), 'teste', true)$$, 'cancela a de 10/05');
select is((select (public.generate_recurring_lessons('2027-05-03', '2027-05-16') ->> 'created')::int), 0,
          'gerar de novo nao recria a cancelada');

-- So futuro.
select throws_ok($$insert into public.lessons (student_id, starts_at) values ('a0000000-0000-0000-0000-00000000000a', now() - interval '1 day')$$,
                 '23514', 'aula no passado: so e possivel criar ou remarcar aulas futuras', 'app nao cria aula no passado');
select throws_ok($$update public.lessons set starts_at = now() - interval '1 day'
                   where schedule_id = '33333333-0000-0000-0000-000000000001' and starts_at = '2027-05-05 17:00+00'$$,
                 '23514', null, 'app nao remarca para o passado');
select is((select (public.generate_recurring_lessons((now() - interval '30 days')::date, (now() - interval '1 day')::date) ->> 'created')::int), 0,
          'geracao de um periodo passado nao cria nada');
reset role;

select * from finish();
rollback;
