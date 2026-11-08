-- pgTAP: formulario de interessados - limites anti-repeticao e anti-enxurrada
-- (migration 20261117000001).
-- Roda numa transacao com ROLLBACK (supabase test db).

begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

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

select pg_temp.as_anon();
select lives_ok($$insert into public.leads (name, contact, consent, source) values ('Visitante', '(11) 99999-0000', true, 'landing')$$,
                'anon envia interessado');
select throws_ok($$insert into public.leads (name, contact, consent, source) values ('Visitante', '11999990000', true, 'landing')$$,
                 '23505', null, 'mesmo contato (outra mascara) em 10 minutos e rejeitado');
select lives_ok($$insert into public.leads (name, contact, consent) values ('Outra pessoa', '21988887777', true)$$,
                'outro contato passa');
reset role;

-- Professora cadastra manualmente sem limite.
select pg_temp.as_user('d1000000-0000-0000-0000-0000000000d1');
select lives_ok($$insert into public.leads (name, contact, consent) values ('Manual', '11999990000', true)$$,
                'professora nao e limitada');
reset role;

-- Enxurrada: com 30 envios na ultima hora, o proximo e barrado. Os 30 entram como postgres
-- sem JWT (fora do limite).
select set_config('request.jwt.claims', '', true);
insert into public.leads (name, contact, consent)
  select 'Robo ' || g, 'robo' || g || '@test.local', true from generate_series(1, 30) g;
select pg_temp.as_anon();
select throws_ok($$insert into public.leads (name, contact, consent) values ('Mais um', '31977776666', true)$$,
                 '54000', null, 'acima de 30 por hora e rejeitado');
reset role;
select is((select count(*)::int from public.leads where name = 'Mais um'), 0, 'envio barrado nao foi gravado');

select * from finish();
rollback;
