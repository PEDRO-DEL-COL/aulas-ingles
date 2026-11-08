-- pgTAP: valida liberacao de acesso (login <-> ficha) e RLS por papel.
-- Papeis de login: aluno, professora, admin. Responsavel NAO tem login (dado da ficha).
-- Rodar: `supabase start` + `supabase test db`  (ver supabase/tests/README.md)
-- Tudo roda dentro de uma transacao com ROLLBACK: nao deixa dados no banco.

begin;
create extension if not exists pgtap with schema extensions;
select plan(98);

-- Troca para um usuario autenticado / anonimo (equivale ao que o PostgREST faz).
-- Sempre chamar `reset role;` antes de trocar de usuario.
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
-- Fichas cadastradas ANTES do primeiro login (e-mails em maiusculas: o trigger normaliza).
insert into public.students (id, full_name, email) values
  ('a0000000-0000-0000-0000-00000000000a', 'Aluno A', 'A@test.local'),
  ('b0000000-0000-0000-0000-00000000000b', 'Aluno B', 'b@test.local');

-- Responsaveis e pagador: DADOS da ficha (sem login).
insert into public.student_guardians (student_id, guardian_email, guardian_name, can_view_lessons, is_financial_responsible) values
  ('a0000000-0000-0000-0000-00000000000a', 'g@test.local',  'Responsavel de A', true,  true),
  ('b0000000-0000-0000-0000-00000000000b', 'g2@test.local', 'Responsavel de B', false, true);
insert into public.payers (id, name) values ('99999999-0000-0000-0000-000000000001', 'Pagador de A');

insert into public.plans (id, name, billing_model, price_cents) values
  ('88888888-0000-0000-0000-000000000001', 'Plano teste', 'avulsa', 30000);

-- Usuarios (o trigger on_auth_user_created cria os profiles).
-- email_confirmed_at preenchido: so contas confirmadas sao ligadas as fichas (como no login Google).
insert into auth.users (id, email, raw_user_meta_data, email_confirmed_at) values
  ('a1000000-0000-0000-0000-00000000000a', 'a@test.local',    '{"full_name":"Aluno A"}', now()),
  ('b1000000-0000-0000-0000-00000000000b', 'b@test.local',    '{"full_name":"Aluno B"}', now()),
  ('c1000000-0000-0000-0000-0000000000c1', 'g@test.local',    '{"full_name":"Resp A"}', now()),
  ('d1000000-0000-0000-0000-0000000000d1', 'prof@test.local', '{"full_name":"Professora"}', now()),
  ('d2000000-0000-0000-0000-0000000000d2', 'admin@test.local','{"full_name":"Admin"}', now()),
  ('e1000000-0000-0000-0000-0000000000e1', 'nolist@test.local','{"full_name":"Sem Liberacao"}', now()),
  ('f1000000-0000-0000-0000-0000000000f1', 'late@test.local', '{"full_name":"Aluno Tardio"}', now());

-- Bootstrap de staff (como no SQL editor: papel postgres passa pelo guard).
update public.profiles set role = 'professora', active = true where id = 'd1000000-0000-0000-0000-0000000000d1';
update public.profiles set role = 'admin',      active = true where id = 'd2000000-0000-0000-0000-0000000000d2';

insert into public.lessons (id, student_id, starts_at) values
  ('11111111-0000-0000-0000-00000000000a', 'a0000000-0000-0000-0000-00000000000a', '2027-03-01 13:00+00'),
  ('11111111-0000-0000-0000-00000000000b', 'b0000000-0000-0000-0000-00000000000b', '2027-03-01 14:00+00');

insert into public.lesson_notes (lesson_id, content, summary, homework)
  values ('11111111-0000-0000-0000-00000000000a', 'conteudo', 'resumo', 'tarefa');

insert into public.invoices (id, student_id, billing_model, amount_cents, due_date) values
  ('22222222-0000-0000-0000-00000000000a', 'a0000000-0000-0000-0000-00000000000a', 'avulsa', 20000, '2027-03-10'),
  ('22222222-0000-0000-0000-00000000000b', 'b0000000-0000-0000-0000-00000000000b', 'avulsa', 20000, '2027-03-10');

insert into public.private_notes (student_id, body)
  values ('a0000000-0000-0000-0000-00000000000a', 'anotacao privada sobre A');

insert into public.materials (title, type, url, is_public_to_students)
  values ('Material geral', 'link', 'https://exemplo.test/geral', true);
insert into public.materials (title, type, url, student_id)
  values ('Material so de B', 'link', 'https://exemplo.test/b', 'b0000000-0000-0000-0000-00000000000b');

insert into public.leads (name, contact, consent) values ('Lead existente', 'lead@test.local', true);

-- Agenda de A: segundas 18:00 (fuso padrao = Sao Paulo); segunda 2027-01-11 bloqueada.
insert into public.schedules (id, student_id, weekday, start_time, starts_on)
  values ('33333333-0000-0000-0000-00000000000a', 'a0000000-0000-0000-0000-00000000000a', 1, '18:00', '2027-01-04');
insert into public.blocked_dates (starts_on, ends_on, reason) values ('2027-01-11', '2027-01-11', 'feriado de teste');

-- ======================================================= triggers de liberacao (postgres)
select is((select profile_id from public.students where email = 'a@test.local'),
          'a1000000-0000-0000-0000-00000000000a'::uuid,
          'login liga students.profile_id pelo e-mail (normalizado para minusculas)');
select is((select role::text from public.profiles where id = 'a1000000-0000-0000-0000-00000000000a'),
          'aluno', 'profile do aluno liberado tem papel aluno');
select ok((select active from public.profiles where id = 'a1000000-0000-0000-0000-00000000000a'),
          'profile do aluno liberado fica ativo');
select is((select timezone from public.profiles where id = 'a1000000-0000-0000-0000-00000000000a'),
          'America/Sao_Paulo', 'profiles.timezone tem default America/Sao_Paulo');
select ok((select guardian_profile_id is null from public.student_guardians where guardian_email = 'g@test.local'),
          'login do responsavel NAO e ligado a student_guardians');
select is((select active::text from public.profiles where id = 'c1000000-0000-0000-0000-0000000000c1'),
          'false', 'responsavel (e-mail so em student_guardians) fica INATIVO');
select is((select active from public.profiles where id = 'e1000000-0000-0000-0000-0000000000e1'),
          false, 'e-mail nao liberado gera profile inativo');
select is((select active from public.profiles where id = 'f1000000-0000-0000-0000-0000000000f1'),
          false, 'login antes do cadastro da ficha: profile inativo');
select is((select count(*)::int from pg_trigger where tgname = 'student_guardians_link_profile'),
          0, 'trigger de ligacao do responsavel foi removido');
select is((select count(*)::int from public.settings where pix_key is null), 1,
          'settings: linha singleton existe com Pix nulo');
select has_column('public', 'students', 'guardian_consent_name', 'students.guardian_consent_name existe');
select throws_ok($$insert into public.students (full_name, email) values ('Sem Ponto', 'x@semponto')$$,
                 '23514', null, 'students.email com formato invalido e rejeitado');

insert into public.students (id, full_name, email)
  values ('f0000000-0000-0000-0000-00000000000f', 'Aluno Tardio', 'Late@test.local');

select is((select profile_id from public.students where id = 'f0000000-0000-0000-0000-00000000000f'),
          'f1000000-0000-0000-0000-0000000000f1'::uuid,
          'ficha cadastrada depois do login liga ao profile existente');
select ok((select active from public.profiles where id = 'f1000000-0000-0000-0000-0000000000f1'),
          'ficha cadastrada depois do login ativa o profile');

-- ======================================================================== aluno A
reset role;
select pg_temp.as_user('a1000000-0000-0000-0000-00000000000a');

select is((select count(*)::int from public.lessons), 1, 'aluno A ve so 1 aula (a propria)');
select is((select count(*)::int from public.lessons where student_id = 'b0000000-0000-0000-0000-00000000000b'), 0,
          'aluno A nao ve aulas de B');
select is((select count(*)::int from public.invoices), 1, 'aluno A ve so 1 cobranca');
select is((select count(*)::int from public.invoices where student_id = 'b0000000-0000-0000-0000-00000000000b'), 0,
          'aluno A nao ve cobrancas de B');
select is((select count(*)::int from public.invoices_with_status), 1,
          'aluno A ve so a propria cobranca na view invoices_with_status');
select is((select count(*)::int from public.private_notes), 0, 'aluno A nao ve private_notes');
select is((select count(*)::int from public.students), 1, 'aluno A ve so a propria ficha');
select is((select count(*)::int from public.lesson_notes), 1, 'aluno A ve o registro da propria aula');
select is((select count(*)::int from public.materials), 1,
          'aluno A ve o material geral e nao o material exclusivo de B');
select is((select count(*)::int from public.profiles), 1, 'aluno A ve so o proprio profile');
select is((select count(*)::int from public.payers), 0, 'aluno A nao ve payers');
select is((select count(*)::int from public.student_guardians), 0, 'aluno A nao ve student_guardians');
select throws_ok($$update public.profiles set role = 'admin' where id = 'a1000000-0000-0000-0000-00000000000a'$$,
                 '42501', null, 'aluno A nao consegue promover o proprio papel');
select lives_ok($$update public.profiles set full_name = 'Nome Novo' where id = 'a1000000-0000-0000-0000-00000000000a'$$,
                'aluno A altera o proprio nome');
select is((select full_name from public.profiles where id = 'a1000000-0000-0000-0000-00000000000a'), 'Nome Novo',
          'nome foi alterado');
select lives_ok($$update public.invoices set status = 'pago' where id = '22222222-0000-0000-0000-00000000000a'$$,
                'update direto em invoices nao da erro (mas nao afeta linhas)');
select throws_ok($$insert into public.private_notes (student_id, body) values ('a0000000-0000-0000-0000-00000000000a', 'x')$$,
                 '42501', null, 'aluno A nao insere private_notes');
select lives_ok($$select public.mark_invoice_as_paid_notice('22222222-0000-0000-0000-00000000000a')$$,
                'aluno A avisa "ja paguei" na propria cobranca');
select throws_ok($$select public.mark_invoice_as_paid_notice('22222222-0000-0000-0000-00000000000b')$$,
                 '42501', null, 'aluno A nao avisa pagamento da cobranca de B');
select is((select count(*)::int from public.settings), 1, 'aluno ativo le settings (chave Pix)');
select is((select count(*)::int from public.leads), 0, 'aluno A nao ve leads');
select lives_ok($$select public.accept_terms('v1')$$, 'aluno A aceita termos via RPC');
select throws_ok($$select public.generate_lessons('2027-01-04', '2027-01-18')$$,
                 '42501', null, 'aluno A nao consegue gerar aulas');
select lives_ok($$update public.settings set pix_key = 'hack@test.local'$$,
                'aluno A: update em settings nao da erro (mas nao afeta linhas)');
select throws_ok($$insert into public.plans (name, billing_model, price_cents) values ('Plano do aluno', 'avulsa', 1)$$,
                 '42501', null, 'aluno A nao cria plano');

reset role;
select isnt((select student_notified_paid_at from public.invoices where id = '22222222-0000-0000-0000-00000000000a'), null,
            'aviso "ja paguei" gravado');
select is((select status::text from public.invoices where id = '22222222-0000-0000-0000-00000000000a'), 'em_aberto',
          'aviso nao muda o status (confirmacao e manual)');
select is((select student_notified_paid_at from public.invoices where id = '22222222-0000-0000-0000-00000000000b'), null,
          'cobranca de B intacta');
select is((select terms_version from public.profiles where id = 'a1000000-0000-0000-0000-00000000000a'), 'v1',
          'aceite de termos gravado');
select ok((select pix_key is null from public.settings), 'settings nao foi alterada pelo aluno');

-- ====================== responsavel (profile inativo: nao tem login nesta fase)
select pg_temp.as_user('c1000000-0000-0000-0000-0000000000c1');
select is((select count(*)::int from public.invoices), 0, 'responsavel nao le invoices');
select is((select count(*)::int from public.lessons), 0, 'responsavel nao le lessons');
select is((select count(*)::int from public.students), 0, 'responsavel nao le students');
select is((select count(*)::int from public.student_guardians), 0, 'responsavel nao le student_guardians');
select is((select count(*)::int from public.payers), 0, 'responsavel nao le payers');
select is((select count(*)::int from public.settings), 0, 'responsavel nao le settings');

-- ============================================================ usuario nao liberado
reset role;
select pg_temp.as_user('e1000000-0000-0000-0000-0000000000e1');
select is((select count(*)::int from public.profiles), 1, 'nao liberado le so o proprio profile');
select is((select count(*)::int from public.students), 0, 'nao liberado nao le students');
select is((select count(*)::int from public.invoices), 0, 'nao liberado nao le invoices');
select is((select count(*)::int from public.settings), 0, 'nao liberado nao le settings');

-- ================================================================== professora
reset role;
select pg_temp.as_user('d1000000-0000-0000-0000-0000000000d1');
select is((select count(*)::int from public.invoices), 2, 'professora ve todas as cobrancas');
select is((select count(*)::int from public.lessons), 2, 'professora ve todas as aulas');
select is((select count(*)::int from public.private_notes), 1, 'professora ve private_notes');
select is((select count(*)::int from public.leads), 1, 'professora ve leads');
select is((select count(*)::int from public.payers), 1, 'professora ve payers');
select is((select count(*)::int from public.student_guardians), 2, 'professora ve student_guardians');
select is((select count(*)::int from public.plans), 1, 'professora le plans');
select cmp_ok((select count(*)::int from public.profiles), '>=', 7, 'professora le profiles');
select lives_ok($$update public.profiles set role = 'admin' where id = 'a1000000-0000-0000-0000-00000000000a'$$,
                'professora: update do papel de outro perfil nao da erro (mas nao afeta linhas)');
select throws_ok($$update public.profiles set role = 'admin' where id = 'd1000000-0000-0000-0000-0000000000d1'$$,
                 '42501', null, 'professora nao promove o proprio papel');
select lives_ok($$insert into public.private_notes (student_id, body) values ('b0000000-0000-0000-0000-00000000000b', 'nota da professora')$$,
                'professora cria private_note');
select lives_ok($$insert into public.invoices (student_id, billing_model, amount_cents, due_date) values ('a0000000-0000-0000-0000-00000000000a', 'avulsa', 15000, '2027-04-10')$$,
                'professora lanca cobranca');
select lives_ok($$update public.invoices set status = 'pago' where id = '22222222-0000-0000-0000-00000000000b'$$,
                'professora marca cobranca como paga');
select lives_ok($$insert into public.students (full_name, email) values ('Aluno Novo', 'novo@test.local')$$,
                'professora cria ficha de aluno');
select lives_ok($$update public.settings set pix_key = 'prof@test.local'$$,
                'professora: update em settings nao da erro (mas nao afeta linhas)');
select throws_ok($$insert into public.plans (name, billing_model, price_cents) values ('Plano da professora', 'avulsa', 1)$$,
                 '42501', null, 'professora nao cria plano (so admin)');
select lives_ok($$update public.plans set price_cents = 1$$,
                'professora: update em plans nao da erro (mas nao afeta linhas)');
select lives_ok($$delete from public.students where id = 'b0000000-0000-0000-0000-00000000000b'$$,
                'professora: delete de ficha nao da erro (mas nao afeta linhas; ela usa status saiu)');
select lives_ok($$delete from public.profiles where id = 'a1000000-0000-0000-0000-00000000000a'$$,
                'professora: delete de profile nao da erro (mas nao afeta linhas)');
select is((select public.generate_lessons('2027-01-04', '2027-01-18')), 2,
          'generate_lessons cria 2 aulas e pula a data bloqueada');
select is((select public.generate_lessons('2027-01-04', '2027-01-18')), 0, 'generate_lessons e idempotente');
select is((select min(starts_at) from public.lessons where schedule_id = '33333333-0000-0000-0000-00000000000a'),
          '2027-01-04 21:00:00+00'::timestamptz, 'aula gerada: 18:00 de Sao Paulo = 21:00 UTC');

reset role;
select is((select role::text from public.profiles where id = 'a1000000-0000-0000-0000-00000000000a'), 'aluno',
          'papel do aluno A intacto');
select ok((select pix_key is null from public.settings), 'settings intacta apos tentativa da professora');
select is((select price_cents from public.plans where id = '88888888-0000-0000-0000-000000000001'), 30000,
          'plano intacto apos tentativa da professora');
select is((select count(*)::int from public.students where id = 'b0000000-0000-0000-0000-00000000000b'), 1,
          'ficha de B nao foi excluida pela professora');
select is((select count(*)::int from public.profiles where id = 'a1000000-0000-0000-0000-00000000000a'), 1,
          'profile de A nao foi excluido pela professora');
select is((select status::text || '/' || (confirmed_by = 'd1000000-0000-0000-0000-0000000000d1')::text
           from public.invoices where id = '22222222-0000-0000-0000-00000000000b'),
          'pago/true', 'cobranca marcada como paga pela professora (confirmed_by preenchido)');

-- ====================================================================== admin
select pg_temp.as_user('d2000000-0000-0000-0000-0000000000d2');
select lives_ok($$update public.profiles set role = 'professora' where id = 'f1000000-0000-0000-0000-0000000000f1'$$,
                'admin altera papel');
select lives_ok($$update public.settings set pix_key = 'pix@test.local', pix_key_type = 'email',
                  receiver_name = 'Professora Teste', receiver_city = 'Sao Paulo'$$, 'admin altera settings');
select lives_ok($$insert into public.plans (name, billing_model, price_cents) values ('Plano do admin', 'avulsa', 25000)$$,
                'admin cria plano');
select lives_ok($$delete from public.students where email = 'novo@test.local'$$, 'admin exclui ficha');
select lives_ok($$delete from public.profiles where id = 'e1000000-0000-0000-0000-0000000000e1'$$,
                'admin exclui profile');

reset role;
select is((select role::text from public.profiles where id = 'f1000000-0000-0000-0000-0000000000f1'), 'professora',
          'papel alterado pelo admin');
select is((select pix_key from public.settings), 'pix@test.local', 'settings alterada pelo admin');
select is((select count(*)::int from public.plans where name = 'Plano do admin'), 1, 'plano criado pelo admin');
select is((select count(*)::int from public.students where email = 'novo@test.local'), 0, 'ficha excluida pelo admin');
select is((select count(*)::int from public.profiles where id = 'e1000000-0000-0000-0000-0000000000e1'), 0,
          'profile excluido pelo admin');

-- ======================================================================== anon
select pg_temp.as_anon();
select throws_ok($$select * from public.leads$$, '42501', null, 'anon nao le leads');
select lives_ok($$insert into public.leads (name, contact, consent) values ('Visitante', 'v@test.local', true)$$,
                'anon insere lead com consentimento');
select throws_ok($$insert into public.leads (name, contact, consent) values ('Visitante', 'v2@test.local', false)$$,
                 '42501', null, 'anon nao insere lead sem consentimento');
select throws_ok($$insert into public.leads (name, contact, consent, status) values ('X', 'x@test.local', true, 'convertido')$$,
                 '42501', null, 'anon nao define status do lead');
select throws_ok($$select * from public.lessons$$, '42501', null, 'anon nao le lessons');

reset role;
select is((select count(*)::int from public.leads), 2, 'apenas o lead valido do anon foi gravado');

select * from finish();
rollback;
