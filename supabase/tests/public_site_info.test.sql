-- pgTAP: dados publicos da landing (public_site_info, migration 20261112000001):
-- anon le so o WhatsApp e os planos ativos; nada de Pix, politica ou outras colunas.
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

-- =========================================================== public_site_info
select pg_temp.as_anon();
select lives_ok($$select public.public_site_info()$$, 'anon chama public_site_info');
select is((select public.public_site_info() ->> 'whatsapp_number'), '5511999998888', 'anon le o WhatsApp');
select is((select jsonb_array_length(public.public_site_info() -> 'plans')), 2, 'anon ve so os planos ativos');
select ok((select public.public_site_info()::text not like '%segredo%'), 'chave Pix nao aparece');
select ok((select public.public_site_info()::text not like '%politica interna%'), 'politica interna nao aparece');
select ok((select public.public_site_info()::text not like '%Mensal velho%'), 'plano inativo nao aparece');
select is((select array_agg(k order by k) from jsonb_object_keys(public.public_site_info()) k),
          array['plans', 'whatsapp_number'], 'so as chaves whatsapp_number e plans');
select throws_ok($$select * from public.settings$$, '42501', null, 'anon continua sem ler settings');
select throws_ok($$select * from public.plans$$, '42501', null, 'anon continua sem ler plans');
reset role;

select * from finish();
rollback;
