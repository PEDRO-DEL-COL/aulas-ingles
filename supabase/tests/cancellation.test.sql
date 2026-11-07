-- pgTAP: politica de cancelamento e reposicao (triggers e RPCs de lessons).
-- Rodar: `supabase start` + `supabase test db`  (ver supabase/tests/README.md)
-- Tudo roda dentro de uma transacao com ROLLBACK: nao deixa dados no banco.
-- Configuracao padrao usada: cancellation_min_hours = 24, faixa intermediaria desligada
-- (late_cancel_band_min_hours = 12), max_makeups_per_month = 2.

begin;
create extension if not exists pgtap with schema extensions;
select plan(48);

create function pg_temp.as_user(p_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

-- ============================================================ preparacao (postgres)
insert into public.students (id, full_name, email) values
  ('a0000000-0000-0000-0000-00000000000a', 'Aluno A', 'ca@test.local'),
  ('b0000000-0000-0000-0000-00000000000b', 'Aluno B', 'cb@test.local');

insert into auth.users (id, email, raw_user_meta_data, email_confirmed_at) values
  ('a1000000-0000-0000-0000-00000000000a', 'ca@test.local',   '{"full_name":"Aluno A"}', now()),
  ('b1000000-0000-0000-0000-00000000000b', 'cb@test.local',   '{"full_name":"Aluno B"}', now()),
  ('d1000000-0000-0000-0000-0000000000d1', 'prof@test.local', '{"full_name":"Professora"}', now()),
  ('d2000000-0000-0000-0000-0000000000d2', 'admin@test.local','{"full_name":"Admin"}', now());
update public.profiles set role = 'professora', active = true where id = 'd1000000-0000-0000-0000-0000000000d1';
update public.profiles set role = 'admin',      active = true where id = 'd2000000-0000-0000-0000-0000000000d2';

-- Base das reposicoes: dia 10 do mes civil (Sao Paulo) daqui a 2 meses, meio-dia.
-- Base, base + 1 dia e base + 2 dias caem sempre no MESMO mes; base + 1 mes, no mes seguinte.
select set_config('test.mk',
  ((date_trunc('month', (now() at time zone 'America/Sao_Paulo') + interval '2 months')
    + interval '10 days 12 hours') at time zone 'America/Sao_Paulo')::text, true);

insert into public.lessons (id, student_id, starts_at) values
  ('10000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-00000000000a', now() + interval '30 hours'),
  ('10000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-00000000000a', now() + interval '10 hours'),
  ('10000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-00000000000a', now() + interval '15 hours'),
  ('10000000-0000-0000-0000-00000000000b', 'a0000000-0000-0000-0000-00000000000a', now() + interval '15 hours 5 minutes'),
  ('10000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-00000000000a', now() + interval '20 hours'),
  ('10000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-00000000000a', now() + interval '60 hours'),
  ('10000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-00000000000a', now() + interval '40 hours'),
  ('10000000-0000-0000-0000-000000000009', 'a0000000-0000-0000-0000-00000000000a', now() + interval '24 hours'),
  ('10000000-0000-0000-0000-000000000010', 'a0000000-0000-0000-0000-00000000000a', now() + interval '31 hours'),
  ('10000000-0000-0000-0000-00000000000c', 'b0000000-0000-0000-0000-00000000000b', now() + interval '30 hours'),
  ('10000000-0000-0000-0000-00000000000d', 'a0000000-0000-0000-0000-00000000000a', now() - interval '1 hour');

-- Insert direto ja cancelado pela professora: reposicao sempre.
insert into public.lessons (id, student_id, starts_at, status) values
  ('10000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-00000000000a',
   now() + interval '50 hours', 'cancelada_professora');

select is((select makeup_eligible from public.lessons where id = '10000000-0000-0000-0000-000000000007'),
          true, 'insert como cancelada_professora => makeup_eligible = true');
select throws_ok($$insert into public.lessons (student_id, starts_at, status)
                    values ('a0000000-0000-0000-0000-00000000000a', now() + interval '5 days', 'reposicao')$$,
                 '23514', null, 'status reposicao sem rescheduled_from e rejeitado');

-- ===================================================================== aluno A (RPC)
reset role;
select pg_temp.as_user('a1000000-0000-0000-0000-00000000000a');

select lives_ok($$select public.cancel_lesson('10000000-0000-0000-0000-000000000001', 'viagem')$$,
                'aluno A cancela aula com 30h de antecedencia');
select lives_ok($$select public.cancel_lesson('10000000-0000-0000-0000-000000000002')$$,
                'aluno A cancela aula com 10h de antecedencia');
select lives_ok($$select public.cancel_lesson('10000000-0000-0000-0000-000000000003')$$,
                'aluno A cancela aula com 15h (faixa intermediaria desligada)');
select throws_ok($$select public.cancel_lesson('10000000-0000-0000-0000-00000000000c')$$,
                 '42501', null, 'aluno A nao cancela a aula de outro aluno');
select throws_ok($$select public.cancel_lesson('10000000-0000-0000-0000-00000000000d')$$,
                 '23514', null, 'aula que ja comecou nao pode ser cancelada');
select throws_ok($$select public.cancel_lesson('10000000-0000-0000-0000-000000000001')$$,
                 '23514', null, 'aula ja cancelada nao pode ser cancelada de novo');
select throws_ok($$select public.cancel_lesson('10000000-0000-0000-0000-000000000008', null, true)$$,
                 '42501', null, 'aluno nao cancela "pela professora"');
select lives_ok($$update public.lessons set status = 'cancelada_aluno' where id = '10000000-0000-0000-0000-000000000008'$$,
                'aluno: UPDATE direto em lessons nao da erro (mas nao afeta linhas)');
select lives_ok($$update public.lessons set makeup_eligible = true where id = '10000000-0000-0000-0000-000000000002'$$,
                'aluno: UPDATE direto de makeup_eligible nao da erro (mas nao afeta linhas)');
select throws_ok($$select public.decide_makeup('10000000-0000-0000-0000-000000000003', true)$$,
                 '42501', null, 'aluno nao usa decide_makeup');
select throws_ok($$select public.schedule_makeup('10000000-0000-0000-0000-000000000001', now() + interval '90 days')$$,
                 '42501', null, 'aluno nao usa schedule_makeup');
select throws_ok($$select public.makeups_used_in_month('b0000000-0000-0000-0000-00000000000b', current_date)$$,
                 '42501', null, 'aluno nao consulta saldo de reposicoes de outro aluno');
select is((select public.makeups_used_in_month('a0000000-0000-0000-0000-00000000000a', current_date)), 0,
          'aluno consulta o proprio saldo (0 reposicoes)');

-- ============================================================ resultado (postgres)
reset role;
select is((select makeup_eligible from public.lessons where id = '10000000-0000-0000-0000-000000000001'),
          true, 'cancelamento com 30h (>= 24h) => COM reposicao');
select is((select canceled_by from public.lessons where id = '10000000-0000-0000-0000-000000000001'),
          'a1000000-0000-0000-0000-00000000000a'::uuid, 'canceled_by = aluno que cancelou');
select is((select status::text from public.lessons where id = '10000000-0000-0000-0000-000000000001'),
          'cancelada_aluno', 'status cancelada_aluno');
select is((select makeup_eligible from public.lessons where id = '10000000-0000-0000-0000-000000000002'),
          false, 'cancelamento com 10h (< 24h) => SEM reposicao (UPDATE direto do aluno nao alterou)');
select is((select makeup_eligible from public.lessons where id = '10000000-0000-0000-0000-000000000003'),
          false, 'faixa intermediaria desligada: 15h => SEM reposicao');
select is((select status::text from public.lessons where id = '10000000-0000-0000-0000-000000000008'),
          'agendada', 'UPDATE direto do aluno nao cancelou a aula');

-- Limite exato: antecedencia == cancellation_min_hours conta como "com reposicao".
select lives_ok($$update public.lessons set status = 'cancelada_aluno' where id = '10000000-0000-0000-0000-000000000009'$$,
                'cancela aula com exatamente 24h');
select is((select makeup_eligible from public.lessons where id = '10000000-0000-0000-0000-000000000009'),
          true, 'antecedencia exatamente igual ao minimo => COM reposicao');

-- makeup_eligible nao pode ser alterado manualmente (nem pelo postgres).
select throws_ok($$update public.lessons set makeup_eligible = true where id = '10000000-0000-0000-0000-000000000002'$$,
                 '42501', null, 'alteracao manual de makeup_eligible e rejeitada');

-- Checks de settings.
select throws_ok($$update public.settings set late_cancel_band_enabled = true, late_cancel_band_min_hours = 30$$,
                 '23514', null, 'faixa intermediaria deve ser menor que cancellation_min_hours');

-- Faixa intermediaria habilitada.
update public.settings set late_cancel_band_enabled = true;
select lives_ok($$update public.lessons set status = 'cancelada_aluno' where id = '10000000-0000-0000-0000-00000000000b'$$,
                'cancela aula com ~15h com a faixa habilitada');
select ok((select makeup_eligible is null from public.lessons where id = '10000000-0000-0000-0000-00000000000b'),
          'faixa intermediaria (12h <= antecedencia < 24h) => makeup_eligible NULL (a decidir)');

-- Falta do aluno: nunca ha reposicao (mesmo que se tente enviar true).
select lives_ok($$update public.lessons set status = 'falta_aluno', makeup_eligible = true where id = '10000000-0000-0000-0000-000000000004'$$,
                'marca falta do aluno');
select is((select makeup_eligible from public.lessons where id = '10000000-0000-0000-0000-000000000004'),
          false, 'falta_aluno => SEM reposicao (valor enviado e ignorado)');

-- ================================================================== professora
select pg_temp.as_user('d1000000-0000-0000-0000-0000000000d1');
select lives_ok($$select public.decide_makeup('10000000-0000-0000-0000-00000000000b', true)$$,
                'professora decide reposicao na faixa intermediaria');
select is((select makeup_eligible from public.lessons where id = '10000000-0000-0000-0000-00000000000b'),
          true, 'decide_makeup gravou makeup_eligible = true');
select is((select makeup_decided_by from public.lessons where id = '10000000-0000-0000-0000-00000000000b'),
          'd1000000-0000-0000-0000-0000000000d1'::uuid, 'decide_makeup gravou makeup_decided_by');
select throws_ok($$select public.decide_makeup('10000000-0000-0000-0000-000000000001', false)$$,
                 '23514', null, 'decide_makeup so vale quando makeup_eligible e NULL');

select lives_ok($$select public.cancel_lesson('10000000-0000-0000-0000-000000000005', 'professora doente', true)$$,
                'professora cancela aula pela professora');
select is((select status::text || '/' || makeup_eligible::text from public.lessons where id = '10000000-0000-0000-0000-000000000005'),
          'cancelada_professora/true', 'cancelada_professora => COM reposicao');

-- Reposicoes (mes civil da DATA DA REPOSICAO, fuso America/Sao_Paulo).
select throws_ok($$select public.schedule_makeup('10000000-0000-0000-0000-000000000002', current_setting('test.mk')::timestamptz)$$,
                 '23514', null, 'reposicao de aula SEM direito falha');
select lives_ok($$select public.schedule_makeup('10000000-0000-0000-0000-000000000001', current_setting('test.mk')::timestamptz)$$,
                '1a reposicao do mes');
select lives_ok($$select public.schedule_makeup('10000000-0000-0000-0000-000000000005', current_setting('test.mk')::timestamptz + interval '1 day')$$,
                '2a reposicao do mes');
select is((select public.makeups_used_in_month('a0000000-0000-0000-0000-00000000000a',
            (current_setting('test.mk')::timestamptz)::date)), 2,
          'saldo: 2 reposicoes usadas no mes');
select throws_ok($$select public.schedule_makeup('10000000-0000-0000-0000-00000000000b', current_setting('test.mk')::timestamptz + interval '2 days')$$,
                 '23514', null, '3a reposicao no mesmo mes falha (max_makeups_per_month = 2)');
select throws_ok($$select public.schedule_makeup('10000000-0000-0000-0000-000000000001', current_setting('test.mk')::timestamptz + interval '3 days')$$,
                 '23514', null, 'a mesma aula de origem nao ganha 2 reposicoes');
select lives_ok($$select public.schedule_makeup('10000000-0000-0000-0000-00000000000b', current_setting('test.mk')::timestamptz + interval '1 month')$$,
                'reposicao em OUTRO mes e permitida (conta o mes da reposicao)');
select is((select public.makeups_used_in_month('a0000000-0000-0000-0000-00000000000a',
            (current_setting('test.mk')::timestamptz + interval '1 month')::date)), 1,
          'saldo do mes seguinte: 1 reposicao');
select is((select count(*)::int from public.lessons
           where student_id = 'a0000000-0000-0000-0000-00000000000a' and status = 'reposicao'
             and rescheduled_from is not null), 3,
          '3 reposicoes agendadas (status reposicao com rescheduled_from)');

-- Reposicao de aula de outro aluno (insert direto pelo postgres).
reset role;
select throws_ok($$insert into public.lessons (student_id, starts_at, status, rescheduled_from)
                    values ('b0000000-0000-0000-0000-00000000000b', current_setting('test.mk')::timestamptz + interval '5 days',
                            'reposicao', '10000000-0000-0000-0000-000000000007')$$,
                 '23514', null, 'reposicao de aula de OUTRO aluno falha');

-- ====================================================================== admin
select pg_temp.as_user('d2000000-0000-0000-0000-0000000000d2');
select lives_ok($$update public.settings set cancellation_min_hours = 48$$,
                'admin altera cancellation_min_hours');

reset role;
select lives_ok($$update public.lessons set status = 'cancelada_aluno' where id = '10000000-0000-0000-0000-000000000010'$$,
                'cancela aula com 31h depois de o admin subir o minimo para 48h');
select ok((select makeup_eligible is null from public.lessons where id = '10000000-0000-0000-0000-000000000010'),
          'politica configurada em settings aplicada: 31h < 48h e >= 12h (faixa habilitada) => a decidir');

select * from finish();
rollback;
