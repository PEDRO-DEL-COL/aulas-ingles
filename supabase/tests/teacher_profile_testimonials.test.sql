-- pgTAP: curriculo da professora (teacher_profile) e depoimentos (testimonials),
-- migration 20261121000001: RLS (so staff), moderacao, public_site_info() e CHECKs.
-- Roda numa transacao com ROLLBACK (supabase test db).

begin;
create extension if not exists pgtap with schema extensions;
select plan(29);

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
-- Usuarios: aluno (com ficha ligada pelo e-mail), professora e admin.
insert into public.students (id, full_name, email, status) values
  ('a0000000-0000-0000-0000-00000000000a', 'Aluno A', 'a@test.local', 'ativo');
insert into auth.users (id, email, raw_user_meta_data, email_confirmed_at) values
  ('a1000000-0000-0000-0000-00000000000a', 'a@test.local',     '{"full_name":"Aluno A"}', now()),
  ('d1000000-0000-0000-0000-0000000000d1', 'prof@test.local',  '{"full_name":"Professora"}', now()),
  ('d2000000-0000-0000-0000-0000000000d2', 'admin@test.local', '{"full_name":"Admin"}', now());
update public.profiles set role = 'professora', active = true where id = 'd1000000-0000-0000-0000-0000000000d1';
update public.profiles set role = 'admin', active = true where id = 'd2000000-0000-0000-0000-0000000000d2';

-- Um depoimento ja existente (nao publicado), para o aluno tentar ler.
insert into public.testimonials (id, author_name, body) values
  ('11111111-0000-0000-0000-000000000001', 'Pre-existente', 'Texto pre-existente');

-- ====================================================================== anon
select pg_temp.as_anon();
select throws_ok($$select * from public.teacher_profile$$, '42501', null, 'anon nao le teacher_profile');
select throws_ok($$select * from public.testimonials$$, '42501', null, 'anon nao le testimonials');
select throws_ok($$insert into public.testimonials (author_name, body) values ('Anon', 'Oi')$$,
                 '42501', null, 'anon nao insere depoimento');
reset role;

-- ====================================================================== aluno
select pg_temp.as_user('a1000000-0000-0000-0000-00000000000a');
select is((select count(*)::int from public.testimonials), 0, 'aluno nao ve depoimentos (RLS)');
select is((select count(*)::int from public.teacher_profile), 0, 'aluno nao ve teacher_profile (RLS)');
select throws_ok($$insert into public.testimonials (author_name, body) values ('Aluno', 'Quero publicar')$$,
                 '42501', null, 'aluno nao insere depoimento (RLS)');
reset role;

-- ================================================================== professora
select pg_temp.as_user('d1000000-0000-0000-0000-0000000000d1');
select lives_ok($$update public.teacher_profile set
                    display_name = 'Prof Ana', headline = 'Professora de ingles', bio = 'Bio longa',
                    education = array['Letras', 'CELTA'], experience = array['10 anos de aulas'],
                    certifications = array['CELTA'], languages = array['Portugues', 'Ingles'],
                    photo_url = 'https://example.com/foto.jpg', published = false$$,
                'professora atualiza teacher_profile');
select throws_ok($$insert into public.teacher_profile (id) values (false)$$,
                 '42501', null, 'professora nao insere em teacher_profile (sem grant de insert)');
select lives_ok($$insert into public.testimonials (id, author_name, body)
                   values ('22222222-0000-0000-0000-000000000002', 'Maria', 'Aulas excelentes')$$,
                'professora insere depoimento (sem informar published)');
select is((select published from public.testimonials where id = '22222222-0000-0000-0000-000000000002'),
          false, 'depoimento nasce com published = false');
reset role;

-- Moderacao: nao publicado nao aparece para o visitante.
select pg_temp.as_anon();
select is((select jsonb_array_length(public.public_site_info() -> 'testimonials')), 0,
          'depoimento nao publicado nao aparece em public_site_info');
reset role;

select pg_temp.as_user('d1000000-0000-0000-0000-0000000000d1');
select lives_ok($$update public.testimonials set published = true where id = '22222222-0000-0000-0000-000000000002'$$,
                'professora publica depoimento');
select isnt((select published_at from public.testimonials where id = '22222222-0000-0000-0000-000000000002'),
            null, 'published_at preenchido ao publicar');
reset role;

select pg_temp.as_anon();
select is((select public.public_site_info() -> 'testimonials' -> 0 ->> 'author_name'), 'Maria',
          'depoimento publicado aparece em public_site_info');
reset role;

select pg_temp.as_user('d1000000-0000-0000-0000-0000000000d1');
update public.testimonials set published = false where id = '22222222-0000-0000-0000-000000000002';
select is((select published_at from public.testimonials where id = '22222222-0000-0000-0000-000000000002'),
          null, 'published_at limpo ao despublicar');
select lives_ok($$delete from public.testimonials where id = '22222222-0000-0000-0000-000000000002'$$,
                'professora apaga depoimento');
select is((select count(*)::int from public.testimonials where id = '22222222-0000-0000-0000-000000000002'),
          0, 'depoimento apagado some');
reset role;

-- ====================================================================== admin
select pg_temp.as_user('d2000000-0000-0000-0000-0000000000d2');
select lives_ok($$insert into public.testimonials (author_name, body) values ('Feito pelo admin', 'Texto do admin')$$,
                'admin insere depoimento');
reset role;

-- ============================================== ordenacao e formato (public_site_info)
-- Tres publicados com posicoes fora de ordem (postgres, sem RLS).
insert into public.testimonials (author_name, author_context, body, rating, published, position) values
  ('Terceiro', 'Aluna desde 2024', 'Corpo 3', 5, true, 3),
  ('Primeiro', null,               'Corpo 1', 4, true, 1),
  ('Segundo',  'Ingles para viagem', 'Corpo 2', null, true, 2);

select pg_temp.as_anon();
select is((select array_agg(x.t ->> 'author_name' order by x.ord)
           from jsonb_array_elements(public.public_site_info() -> 'testimonials') with ordinality as x(t, ord)),
          array['Primeiro', 'Segundo', 'Terceiro'],
          'depoimentos ordenados por position (so os publicados)');
select is((select array_agg(k order by k collate "C")
           from jsonb_object_keys(public.public_site_info() -> 'testimonials' -> 0) k),
          array['author_context', 'author_name', 'body', 'id', 'rating'],
          'depoimento so expoe id, author_name, author_context, body e rating');
select is((select array_agg(k order by k collate "C") from jsonb_object_keys(public.public_site_info()) k),
          array['plans', 'teacher_profile', 'testimonials', 'whatsapp_number'],
          'public_site_info expoe plans, teacher_profile, testimonials e whatsapp_number');
-- teacher_profile ainda com published = false.
select is(jsonb_typeof(public.public_site_info() -> 'teacher_profile'), 'null',
          'teacher_profile nao publicado vira null em public_site_info');
reset role;

update public.teacher_profile set published = true;

select pg_temp.as_anon();
select is((select public.public_site_info() -> 'teacher_profile' ->> 'headline'), 'Professora de ingles',
          'teacher_profile publicado devolve headline');
select is((select public.public_site_info() -> 'teacher_profile' -> 'education'), '["Letras", "CELTA"]'::jsonb,
          'teacher_profile publicado devolve os arrays');
select is((select array_agg(k order by k collate "C")
           from jsonb_object_keys(public.public_site_info() -> 'teacher_profile') k),
          array['bio', 'certifications', 'display_name', 'education', 'experience', 'headline', 'languages', 'photo_url'],
          'teacher_profile so expoe campos publicaveis (sem published, created_at, updated_at)');
reset role;

-- ================================================================== CHECKs (postgres)
select throws_ok($$update public.teacher_profile set photo_url = 'http://x'$$,
                 '23514', null, 'photo_url exige https');
select throws_ok($$update public.teacher_profile set education = array['Letras', '']$$,
                 '23514', null, 'item vazio em education e rejeitado');
select throws_ok($$insert into public.testimonials (author_name, body, rating) values ('X', 'Texto', 6)$$,
                 '23514', null, 'rating 6 e rejeitado');
select throws_ok($$insert into public.testimonials (author_name, body) values ('X', '')$$,
                 '23514', null, 'body vazio e rejeitado');

select * from finish();
rollback;
