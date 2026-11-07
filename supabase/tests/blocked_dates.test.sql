-- pgTAP: ferias/feriados cancelam as aulas do periodo como cancelada_professora, com
-- reposicao fora do limite mensal (migration 20261113000001).
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

-- ============================================================ preparacao (postgres)
update public.settings set
  whatsapp_number = '5511999998888',
  pix_key = 'segredo@test.local', pix_key_type = 'email',
  receiver_name = 'Professora', receiver_city = 'Sao Paulo',
  cancellation_policy_text = 'politica interna';

insert into public.plans (id, name, billing_model, lessons_per_month, lessons_in_package, price_cents, active) values
  ('88888888-0000-0000-0000-0000000000a1', 'Mensal 4',   'mensalidade', 4, null, 40000, true),
  ('88888888-0000-0000-0000-0000000000a2', 'Pacote 8',   'pacote', null, 8, 80000, true),
  ('88888888-0000-0000-0000-0000000000a3', 'Mensal velho','mensalidade', 4, null, 30000, false);

insert into public.students (id, full_name, email, plan_id, status) values
  ('a0000000-0000-0000-0000-00000000000a', 'Aluno A', 'a@test.local', '88888888-0000-0000-0000-0000000000a1', 'ativo'),
  ('b0000000-0000-0000-0000-00000000000b', 'Aluno B', 'b@test.local', '88888888-0000-0000-0000-0000000000a2', 'ativo'),
  ('c0000000-0000-0000-0000-00000000000c', 'Aluno C', 'c@test.local', null, 'ativo'),
  ('d0000000-0000-0000-0000-00000000000d', 'Aluno D', 'd@test.local', '88888888-0000-0000-0000-0000000000a3', 'ativo'),
  ('e0000000-0000-0000-0000-00000000000e', 'Aluno E', 'e@test.local', '88888888-0000-0000-0000-0000000000a1', 'pausado'),
  ('f0000000-0000-0000-0000-00000000000f', 'Aluno F', 'f@test.local', '88888888-0000-0000-0000-0000000000a1', 'ativo');

insert into auth.users (id, email, raw_user_meta_data, email_confirmed_at) values
  ('a1000000-0000-0000-0000-00000000000a', 'a@test.local',    '{"full_name":"Aluno A"}', now()),
  ('d1000000-0000-0000-0000-0000000000d1', 'prof@test.local', '{"full_name":"Professora"}', now());
update public.profiles set role = 'professora', active = true where id = 'd1000000-0000-0000-0000-0000000000d1';

-- F ja tem a mensalidade do mes 2027-05.
insert into public.invoices (student_id, billing_model, reference_month, amount_cents, due_date)
  values ('f0000000-0000-0000-0000-00000000000f', 'mensalidade', '2027-05-01', 40000, '2027-05-05');

-- =========================================================== ferias/feriados
-- Aulas de A: dentro do periodo (2 agendadas + 1 realizada no passado), fora dele, e uma
-- reposicao dentro do periodo.
insert into public.lessons (id, student_id, starts_at, status) values
  ('11111111-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-00000000000a', '2027-07-05 21:00+00', 'agendada'),
  ('11111111-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-00000000000a', '2027-07-12 21:00+00', 'agendada'),
  ('11111111-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-00000000000a', '2027-08-02 21:00+00', 'agendada'),
  ('11111111-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-00000000000a', '2027-07-01 21:00+00', 'realizada');
-- Origem com direito a reposicao (cancelada pela professora) e sua reposicao em julho.
insert into public.lessons (id, student_id, starts_at, status) values
  ('11111111-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-00000000000a', '2027-06-21 21:00+00', 'cancelada_professora');
insert into public.lessons (id, student_id, starts_at, status, rescheduled_from) values
  ('11111111-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-00000000000a', '2027-07-08 21:00+00', 'reposicao',
   '11111111-0000-0000-0000-000000000005');
-- 2027-07-13 01:00 UTC = 2027-07-12 22:00 em Sao Paulo: dentro do periodo pela data local.
insert into public.lessons (id, student_id, starts_at, status) values
  ('11111111-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-00000000000a', '2027-07-13 01:00+00', 'agendada');
-- 2027-07-01 02:00 UTC = 2027-06-30 23:00 em SP: fora do periodo.
insert into public.lessons (id, student_id, starts_at, status) values
  ('11111111-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-00000000000a', '2027-07-01 02:00+00', 'agendada');

select pg_temp.as_user('d1000000-0000-0000-0000-0000000000d1');
select lives_ok($$insert into public.blocked_dates (id, starts_on, ends_on, reason)
                  values ('77777777-0000-0000-0000-000000000001', '2027-07-01', '2027-07-12', 'ferias de julho')$$,
                'professora cadastra ferias');
reset role;

select is((select count(*)::int from public.lessons where blocked_date_id = '77777777-0000-0000-0000-000000000001'), 4,
          'cancela as 2 agendadas, a reposicao e a aula das 22h locais do periodo');
select is((select status::text from public.lessons where id = '11111111-0000-0000-0000-000000000001'),
          'cancelada_professora', 'aula do periodo vira cancelada_professora');
select is((select makeup_eligible from public.lessons where id = '11111111-0000-0000-0000-000000000001'), true,
          'com direito a reposicao');
select is((select cancel_reason from public.lessons where id = '11111111-0000-0000-0000-000000000001'),
          'Férias/feriado: ferias de julho', 'motivo registrado');
select is((select canceled_by from public.lessons where id = '11111111-0000-0000-0000-000000000001'),
          'd1000000-0000-0000-0000-0000000000d1'::uuid, 'cancelada por quem cadastrou o periodo');
select is((select status::text from public.lessons where id = '11111111-0000-0000-0000-000000000003'), 'agendada',
          'aula fora do periodo intacta');
select is((select status::text from public.lessons where id = '11111111-0000-0000-0000-000000000004'), 'realizada',
          'aula realizada intacta');
select is((select status::text from public.lessons where id = '11111111-0000-0000-0000-000000000008'), 'agendada',
          'data local fora do periodo (30/06 23h em SP) intacta');
select is((select status::text from public.lessons where id = '11111111-0000-0000-0000-000000000006'),
          'cancelada_professora', 'reposicao no periodo tambem e cancelada');

-- Ampliar o periodo cancela as aulas novas.
select pg_temp.as_user('d1000000-0000-0000-0000-0000000000d1');
select lives_ok($$update public.blocked_dates set ends_on = '2027-08-02' where id = '77777777-0000-0000-0000-000000000001'$$,
                'professora amplia o periodo');
reset role;
select is((select status::text from public.lessons where id = '11111111-0000-0000-0000-000000000003'),
          'cancelada_professora', 'aula coberta pela ampliacao e cancelada');

-- Excluir o periodo nao reativa.
select pg_temp.as_user('d1000000-0000-0000-0000-0000000000d1');
select lives_ok($$delete from public.blocked_dates where id = '77777777-0000-0000-0000-000000000001'$$,
                'professora exclui o periodo');
reset role;
select is((select status::text from public.lessons where id = '11111111-0000-0000-0000-000000000001'),
          'cancelada_professora', 'excluir o periodo nao reativa a aula');

-- ============================================ limite de reposicoes (origem da professora)
-- Limite 1 por mes para o teste. Origens canceladas pela professora nao contam.
update public.settings set max_makeups_per_month = 1;
select pg_temp.as_user('d1000000-0000-0000-0000-0000000000d1');
select lives_ok($$select public.schedule_makeup('11111111-0000-0000-0000-000000000001', '2027-09-06 21:00+00')$$,
                'reposicao 1 de ferias em setembro');
select lives_ok($$select public.schedule_makeup('11111111-0000-0000-0000-000000000002', '2027-09-13 21:00+00')$$,
                'reposicao 2 de ferias no mesmo mes passa (nao conta no limite)');
select is((select public.makeups_used_in_month('a0000000-0000-0000-0000-00000000000a', '2027-09-01')), 0,
          'reposicoes de cancelamento da professora nao contam no saldo');
reset role;
-- Origem cancelada pelo aluno com direito: conta.
insert into public.lessons (id, student_id, starts_at, status, canceled_at) values
  ('11111111-0000-0000-0000-000000000009', 'a0000000-0000-0000-0000-00000000000a', '2027-08-30 21:00+00', 'cancelada_aluno', now());
select pg_temp.as_user('d1000000-0000-0000-0000-0000000000d1');
select lives_ok($$select public.schedule_makeup('11111111-0000-0000-0000-000000000009', '2027-09-20 21:00+00')$$,
                'reposicao de cancelamento do aluno usa o limite');
select is((select public.makeups_used_in_month('a0000000-0000-0000-0000-00000000000a', '2027-09-01')), 1,
          'saldo conta so a reposicao de cancelamento do aluno');
reset role;

select * from finish();
rollback;
