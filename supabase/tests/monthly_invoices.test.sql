-- pgTAP: mensalidades em lote (generate_monthly_invoices, migration 20261114000001).
-- Roda numa transacao com ROLLBACK (supabase test db).

begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

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

-- ========================================================== mensalidades em lote
select pg_temp.as_anon();
select throws_ok($$select public.generate_monthly_invoices('2027-05-01', 10, true)$$, '42501', null,
                 'anon nao executa mensalidades em lote');
reset role;

select pg_temp.as_user('a1000000-0000-0000-0000-00000000000a');
select throws_ok($$select * from public.generate_monthly_invoices('2027-05-01', 10, true)$$, '42501', null,
                 'aluno nao gera mensalidades');
reset role;

select pg_temp.as_user('d1000000-0000-0000-0000-0000000000d1');
select is((select string_agg(student_name || '=' || action, ',' order by student_name)
           from public.generate_monthly_invoices('2027-05-15', 10, true)),
          'Aluno A=criar,Aluno B=nao_mensal,Aluno C=sem_plano,Aluno D=plano_inativo,Aluno F=ja_existe',
          'previa: so ativos, com o motivo de cada um');
reset role;
select is((select count(*)::int from public.invoices where reference_month = '2027-05-01'), 1,
          'previa nao grava nada');

select pg_temp.as_user('d1000000-0000-0000-0000-0000000000d1');
select is((select count(*)::int from public.generate_monthly_invoices('2027-05-01', 10, false) where action = 'criada'), 1,
          'executa: cria so a de A');
select is((select count(*)::int from public.generate_monthly_invoices('2027-05-01', 10, false) where action = 'criada'), 0,
          'idempotente: segunda execucao nao cria nada');
reset role;
select is((select amount_cents::text || '/' || due_date::text || '/' || status::text from public.invoices
           where student_id = 'a0000000-0000-0000-0000-00000000000a' and reference_month = '2027-05-01'),
          '40000/2027-05-10/em_aberto', 'valor do plano, vencimento no dia 10, em aberto');

select pg_temp.as_user('d1000000-0000-0000-0000-0000000000d1');
select is((select max(due_date)::text from public.generate_monthly_invoices('2027-02-01', 31, true)), '2027-02-28',
          'dia 31 vira o ultimo dia de fevereiro');
select throws_ok($$select * from public.generate_monthly_invoices('2027-05-01', 0, true)$$, '22023', null,
                 'dia de vencimento invalido e rejeitado');
reset role;

select * from finish();
rollback;
