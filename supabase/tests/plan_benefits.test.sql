-- pgTAP: vantagens dos planos e dia de vencimento padrao (migration 20261115000001).
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

insert into public.plans (id, name, billing_model, lessons_per_month, price_cents, active) values
  ('88888888-0000-0000-0000-0000000000a1', 'Mensal ativo',   'mensalidade', 4, 40000, true),
  ('88888888-0000-0000-0000-0000000000a2', 'Mensal inativo', 'mensalidade', 4, 30000, false);

-- ================================================================ admin escreve
select pg_temp.as_user('d2000000-0000-0000-0000-0000000000d2');
select lives_ok($$insert into public.benefits (id, label) values
                  ('bbbbbbbb-0000-0000-0000-000000000001', 'Material em PDF'),
                  ('bbbbbbbb-0000-0000-0000-000000000002', 'Correcao de tarefas'),
                  ('bbbbbbbb-0000-0000-0000-000000000003', 'Vantagem secreta')$$,
                'admin cria vantagens');
select throws_ok($$insert into public.benefits (label) values ('  material em pdf ')$$,
                 '23505', null, 'vantagem repetida (maiusculas/espacos) e rejeitada');
select lives_ok($$insert into public.plan_benefits (plan_id, benefit_id, position) values
                  ('88888888-0000-0000-0000-0000000000a1', 'bbbbbbbb-0000-0000-0000-000000000002', 0),
                  ('88888888-0000-0000-0000-0000000000a1', 'bbbbbbbb-0000-0000-0000-000000000001', 1),
                  ('88888888-0000-0000-0000-0000000000a2', 'bbbbbbbb-0000-0000-0000-000000000003', 0)$$,
                'admin liga vantagens aos planos');
select lives_ok($$update public.settings set default_due_day = 5$$, 'admin muda o vencimento padrao');
select throws_ok($$update public.settings set default_due_day = 32$$, '23514', null,
                 'vencimento padrao fora de 1..31 e rejeitado');
reset role;
select is((select default_due_day from public.settings), 5, 'vencimento padrao gravado');

-- ======================================================= professora e aluno so leem
select pg_temp.as_user('d1000000-0000-0000-0000-0000000000d1');
select is((select count(*)::int from public.benefits), 3, 'professora le o catalogo');
select throws_ok($$insert into public.benefits (label) values ('Da professora')$$, '42501', null,
                 'professora nao cria vantagem');
select lives_ok($$delete from public.plan_benefits$$, 'professora: delete nao da erro (0 linhas)');
select lives_ok($$update public.settings set default_due_day = 20$$, 'professora: update de settings nao da erro (0 linhas)');
reset role;
select is((select count(*)::int from public.plan_benefits), 3, 'vinculos intactos apos tentativa da professora');
select is((select default_due_day from public.settings), 5, 'vencimento intacto apos tentativa da professora');

select pg_temp.as_user('a1000000-0000-0000-0000-00000000000a');
select is((select count(*)::int from public.plan_benefits), 3, 'aluno ativo le os vinculos');
select throws_ok($$insert into public.plan_benefits (plan_id, benefit_id) values ('88888888-0000-0000-0000-0000000000a2', 'bbbbbbbb-0000-0000-0000-000000000001')$$,
                 '42501', null, 'aluno nao liga vantagem');
reset role;

-- ================================================================ anon / landing
select pg_temp.as_anon();
select throws_ok($$select * from public.benefits$$, '42501', null, 'anon nao le a tabela de vantagens');
select is((select public.public_site_info() -> 'plans' -> 0 -> 'benefits'),
          '["Correcao de tarefas", "Material em PDF"]'::jsonb, 'landing ve as vantagens do plano ativo, na ordem');
select ok((select public.public_site_info()::text not like '%Vantagem secreta%'),
          'vantagem so de plano inativo nao aparece');
reset role;

-- Excluir a vantagem tira de todos os planos.
select pg_temp.as_user('d2000000-0000-0000-0000-0000000000d2');
select lives_ok($$delete from public.benefits where id = 'bbbbbbbb-0000-0000-0000-000000000001'$$, 'admin exclui vantagem');
reset role;
select is((select count(*)::int from public.plan_benefits where benefit_id = 'bbbbbbbb-0000-0000-0000-000000000001'), 0,
          'vinculos da vantagem excluida somem');

select * from finish();
rollback;
