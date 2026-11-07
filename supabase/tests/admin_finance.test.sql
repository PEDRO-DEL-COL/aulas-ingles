-- pgTAP: area do admin (protecao de admins, settings, plans) e financeiro (invoices).
-- Migrations 20261109000001_admin_area, 20261110000001_invoices_finance e
-- 20261111000001_pix_txid_limit. Roda numa transacao com ROLLBACK.

begin;
create extension if not exists pgtap with schema extensions;
select plan(35);

create function pg_temp.as_user(p_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

-- ============================================================ preparacao (postgres)
-- Garante que nenhum admin preexistente do banco local interfira na contagem.
update public.profiles set active = false where role = 'admin';

insert into public.students (id, full_name, email) values
  ('a0000000-0000-0000-0000-00000000000a', 'Aluno A', 'a@test.local');

insert into auth.users (id, email, raw_user_meta_data, email_confirmed_at) values
  ('a1000000-0000-0000-0000-00000000000a', 'a@test.local',     '{"full_name":"Aluno A"}', now()),
  ('d1000000-0000-0000-0000-0000000000d1', 'prof@test.local',  '{"full_name":"Professora"}', now()),
  ('d2000000-0000-0000-0000-0000000000d2', 'admin@test.local', '{"full_name":"Admin"}', now()),
  ('d3000000-0000-0000-0000-0000000000d3', 'admin2@test.local','{"full_name":"Admin 2"}', now());

update public.profiles set role = 'professora', active = true where id = 'd1000000-0000-0000-0000-0000000000d1';
update public.profiles set role = 'admin',      active = true
  where id in ('d2000000-0000-0000-0000-0000000000d2', 'd3000000-0000-0000-0000-0000000000d3');

-- ============================================================ admins (pelo app)
select pg_temp.as_user('d2000000-0000-0000-0000-0000000000d2');
select throws_ok($$update public.profiles set role = 'professora' where id = 'd2000000-0000-0000-0000-0000000000d2'$$,
                 '42501', null, 'admin nao rebaixa a si mesmo');
select throws_ok($$update public.profiles set active = false where id = 'd2000000-0000-0000-0000-0000000000d2'$$,
                 '42501', null, 'admin nao desativa a si mesmo');
select lives_ok($$update public.profiles set full_name = 'Admin Renomeado' where id = 'd2000000-0000-0000-0000-0000000000d2'$$,
                'admin altera o proprio nome');
select throws_ok($$update public.profiles set role = 'responsavel' where id = 'a1000000-0000-0000-0000-00000000000a'$$,
                 '22023', null, 'app nao atribui o papel responsavel');
select lives_ok($$update public.profiles set role = 'professora' where id = 'd3000000-0000-0000-0000-0000000000d3'$$,
                'admin rebaixa outro admin (ainda sobra um)');
select lives_ok($$update public.profiles set role = 'admin' where id = 'd3000000-0000-0000-0000-0000000000d3'$$,
                'admin promove de volta');
select lives_ok($$update public.profiles set active = false where id = 'd3000000-0000-0000-0000-0000000000d3'$$,
                'admin desativa outro admin (ainda sobra um)');

reset role;
select is((select active from public.profiles where id = 'd3000000-0000-0000-0000-0000000000d3'), false,
          'segundo admin desativado');
select is((select role::text from public.profiles where id = 'd2000000-0000-0000-0000-0000000000d2'), 'admin',
          'admin continua admin');
select is((select active from public.profiles where id = 'd2000000-0000-0000-0000-0000000000d2'), true,
          'admin continua ativo');

-- Professora nao muda papeis (RLS + guard_profile_update).
select pg_temp.as_user('d1000000-0000-0000-0000-0000000000d1');
select lives_ok($$update public.profiles set role = 'aluno' where id = 'd2000000-0000-0000-0000-0000000000d2'$$,
                'professora: update do admin nao da erro (0 linhas)');
reset role;
select is((select role::text from public.profiles where id = 'd2000000-0000-0000-0000-0000000000d2'), 'admin',
          'professora nao rebaixou o admin');

-- ============================================== ultimo admin (qualquer origem)
select throws_ok($$update public.profiles set role = 'professora' where id = 'd2000000-0000-0000-0000-0000000000d2'$$,
                 '23514', null, 'nem o SQL editor deixa o sistema sem admin ativo (update)');
select throws_ok($$delete from public.profiles where id = 'd2000000-0000-0000-0000-0000000000d2'$$,
                 '23514', null, 'nem o SQL editor exclui o ultimo admin ativo');
select throws_ok($$delete from auth.users where id = 'd2000000-0000-0000-0000-0000000000d2'$$,
                 '23514', null, 'excluir o login do ultimo admin tambem e bloqueado (cascade)');
update public.profiles set active = true where id = 'd3000000-0000-0000-0000-0000000000d3';
select lives_ok($$update public.profiles set role = 'professora' where id = 'd2000000-0000-0000-0000-0000000000d2'$$,
                'com outro admin ativo, o SQL editor rebaixa');
update public.profiles set role = 'admin' where id = 'd2000000-0000-0000-0000-0000000000d2';

-- ================================================================== settings
select pg_temp.as_user('d2000000-0000-0000-0000-0000000000d2');
select lives_ok($$update public.settings set pix_key = '  ', pix_key_type = null, receiver_name = '', receiver_city = ''$$,
                'Pix todo vazio e aceito');
select throws_ok($$update public.settings set pix_key = 'pix@test.local', pix_key_type = 'email', receiver_name = null, receiver_city = null$$,
                 '23514', null, 'chave Pix sem nome/cidade e rejeitada');
select lives_ok($$update public.settings set pix_key = 'pix@test.local', pix_key_type = 'email',
                  receiver_name = 'Professora', receiver_city = 'Sao Paulo'$$, 'Pix completo e aceito');
select lives_ok($$update public.settings set whatsapp_number = '+55 (11) 99999-8888'$$,
                'WhatsApp com mascara e normalizado');
select throws_ok($$update public.settings set whatsapp_number = '123'$$,
                 '23514', null, 'WhatsApp curto e rejeitado');
select throws_ok($$update public.settings set max_makeups_per_month = 99$$,
                 '23514', null, 'limite de reposicoes fora da faixa e rejeitado');
reset role;
select is((select pix_key from public.settings), 'pix@test.local', 'chave Pix gravada');
select is((select whatsapp_number from public.settings), '5511999998888', 'WhatsApp gravado so com digitos');

-- Professora nao escreve settings.
select pg_temp.as_user('d1000000-0000-0000-0000-0000000000d1');
select lives_ok($$update public.settings set pix_key = null, pix_key_type = null, receiver_name = null, receiver_city = null$$,
                'professora: update de settings nao da erro (0 linhas)');
reset role;
select is((select pix_key from public.settings), 'pix@test.local', 'settings intacta apos tentativa da professora');

-- ===================================================================== plans
select pg_temp.as_user('d2000000-0000-0000-0000-0000000000d2');
select throws_ok($$insert into public.plans (name, billing_model, price_cents) values ('Mensal sem aulas', 'mensalidade', 30000)$$,
                 '23514', null, 'mensalidade sem aulas por mes e rejeitada');
select lives_ok($$insert into public.plans (name, billing_model, lessons_in_package, price_cents) values ('Pacote 8', 'pacote', 8, 80000)$$,
                'admin cria pacote');
reset role;

-- ================================================================== invoices
select pg_temp.as_user('d1000000-0000-0000-0000-0000000000d1');
select throws_ok($$insert into public.invoices (student_id, billing_model, amount_cents, due_date) values ('a0000000-0000-0000-0000-00000000000a', 'mensalidade', 20000, '2027-03-10')$$,
                 '23514', null, 'mensalidade sem mes de referencia e rejeitada');
select lives_ok($$insert into public.invoices (id, student_id, billing_model, reference_month, amount_cents, due_date)
                  values ('22222222-0000-0000-0000-0000000000a1', 'a0000000-0000-0000-0000-00000000000a', 'mensalidade', '2027-03-01', 20000, '2027-03-10')$$,
                'professora lanca mensalidade');
select throws_ok($$insert into public.invoices (student_id, billing_model, reference_month, amount_cents, due_date)
                  values ('a0000000-0000-0000-0000-00000000000a', 'mensalidade', '2027-03-01', 20000, '2027-03-10')$$,
                 '23505', null, 'segunda mensalidade do mesmo mes e rejeitada');
select lives_ok($$update public.invoices set status = 'pago' where id = '22222222-0000-0000-0000-0000000000a1'$$,
                'professora marca como pago');
select lives_ok($$update public.invoices set status = 'em_aberto' where id = '22222222-0000-0000-0000-0000000000a1'$$,
                'professora desfaz o pagamento');
select throws_ok($$update public.invoices set pix_txid = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ' where id = '22222222-0000-0000-0000-0000000000a1'$$,
                 '23514', null, 'pix_txid com 26 caracteres e rejeitado');
reset role;
select is((select paid_at is null and confirmed_by is null from public.invoices
           where id = '22222222-0000-0000-0000-0000000000a1'), true,
          'desfazer pagamento limpa paid_at e confirmed_by');

select * from finish();
rollback;
