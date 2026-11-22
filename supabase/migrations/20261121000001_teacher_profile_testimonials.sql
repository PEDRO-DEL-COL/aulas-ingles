-- 21 - Landing: curriculo da professora (teacher_profile) e depoimentos reais
-- (testimonials). Idempotente.
--
-- Escrita: so professora/admin ativos (is_staff), via RLS. Alunos e anon nao leem
-- nenhuma das duas tabelas. O visitante (anon) ve apenas, via public_site_info():
--   - teacher_profile: campos publicaveis, e SO quando published = true;
--   - testimonials: SO os marcados published = true pela professora (moderacao:
--     tudo nasce como nao publicado).
-- public_site_info() mantem as chaves anteriores (whatsapp_number, plans) e ganha
-- "teacher_profile" (objeto ou null) e "testimonials" (lista, ate 24).

-- ------------------------------------------------------------------ utilitario
-- Lista de textos curtos: ate p_max_items itens, cada um com 1..p_max_len caracteres
-- (sem contar espacos nas pontas). IMMUTABLE para poder ser usada em CHECK.
create or replace function public.text_items_ok(p_items text[], p_max_items integer, p_max_len integer)
returns boolean language sql immutable set search_path = '' as $$
  select p_items is not null
     and coalesce(array_length(p_items, 1), 0) <= p_max_items
     and not exists (
       select 1 from unnest(p_items) as i(v)
       where v is null or char_length(btrim(v)) not between 1 and p_max_len
     );
$$;

-- ------------------------------------------------------------ teacher_profile
create table if not exists public.teacher_profile (
  id             boolean primary key default true check (id),
  display_name   text check (display_name is null or char_length(btrim(display_name)) between 1 and 80),
  headline       text check (headline is null or char_length(btrim(headline)) between 1 and 120),
  bio            text check (bio is null or char_length(bio) <= 2000),
  education      text[] not null default '{}' check (public.text_items_ok(education, 12, 200)),
  experience     text[] not null default '{}' check (public.text_items_ok(experience, 12, 200)),
  certifications text[] not null default '{}' check (public.text_items_ok(certifications, 12, 200)),
  languages      text[] not null default '{}' check (public.text_items_ok(languages, 12, 200)),
  photo_url      text check (photo_url is null or (char_length(photo_url) <= 500 and photo_url ~ '^https://[^[:space:]]+$')),
  published      boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

comment on table public.teacher_profile is
  'Curriculo da professora para a secao "Sobre" da landing (linha unica). Publico so via public_site_info() e so com published = true.';
comment on column public.teacher_profile.photo_url is
  'Foto opcional: URL https de uma imagem publica (ex.: link direto). Nao guardamos arquivos no Supabase.';

insert into public.teacher_profile (id) values (true) on conflict (id) do nothing;

drop trigger if exists set_updated_at on public.teacher_profile;
create trigger set_updated_at before update on public.teacher_profile
  for each row execute function public.set_updated_at();

-- --------------------------------------------------------------- testimonials
create table if not exists public.testimonials (
  id             uuid primary key default gen_random_uuid(),
  author_name    text not null check (char_length(btrim(author_name)) between 1 and 80),
  author_context text check (author_context is null or char_length(btrim(author_context)) between 1 and 80),
  body           text not null check (char_length(btrim(body)) between 1 and 600),
  rating         smallint check (rating is null or rating between 1 and 5),
  published      boolean not null default false,
  position       integer not null default 0 check (position between 0 and 1000),
  published_at   timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists testimonials_published_order_idx
  on public.testimonials (position, created_at) where published;

comment on table public.testimonials is
  'Depoimentos de alunos. Moderacao: nascem nao publicados; so a professora/admin publica. Publico so via public_site_info().';
comment on column public.testimonials.author_context is
  'Complemento opcional do nome, ex.: "Aluna desde 2024" ou "Ingles para viagem".';

drop trigger if exists set_updated_at on public.testimonials;
create trigger set_updated_at before update on public.testimonials
  for each row execute function public.set_updated_at();

-- published_at acompanha o estado: preenchido ao publicar, limpo ao despublicar.
create or replace function public.testimonials_published_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.published and (tg_op = 'INSERT' or not old.published) then
    new.published_at := now();
  elsif not new.published then
    new.published_at := null;
  end if;
  return new;
end $$;

drop trigger if exists testimonials_published_at on public.testimonials;
create trigger testimonials_published_at before insert or update on public.testimonials
  for each row execute function public.testimonials_published_at();

-- ---------------------------------------------------------------------- RLS
alter table public.teacher_profile enable row level security;
alter table public.testimonials    enable row level security;

drop policy if exists teacher_profile_staff_select on public.teacher_profile;
drop policy if exists teacher_profile_staff_update on public.teacher_profile;
create policy teacher_profile_staff_select on public.teacher_profile for select to authenticated
  using ((select public.is_staff()));
create policy teacher_profile_staff_update on public.teacher_profile for update to authenticated
  using ((select public.is_staff())) with check ((select public.is_staff()));

drop policy if exists testimonials_staff_select on public.testimonials;
drop policy if exists testimonials_staff_insert on public.testimonials;
drop policy if exists testimonials_staff_update on public.testimonials;
drop policy if exists testimonials_staff_delete on public.testimonials;
create policy testimonials_staff_select on public.testimonials for select to authenticated
  using ((select public.is_staff()));
create policy testimonials_staff_insert on public.testimonials for insert to authenticated
  with check ((select public.is_staff()));
create policy testimonials_staff_update on public.testimonials for update to authenticated
  using ((select public.is_staff())) with check ((select public.is_staff()));
create policy testimonials_staff_delete on public.testimonials for delete to authenticated
  using ((select public.is_staff()));

-- Linha unica: sem insert/delete pelo app (a linha ja existe).
revoke all on public.teacher_profile, public.testimonials from anon, authenticated;
grant select, update on public.teacher_profile to authenticated;
grant select, insert, update, delete on public.testimonials to authenticated;

-- ------------------------------------- public_site_info com curriculo e depoimentos
-- Igual a migration 15 (whatsapp_number, plans com benefits), acrescentando
-- "teacher_profile" e "testimonials". Lista explicita de campos: nada alem disso sai.
create or replace function public.public_site_info()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'whatsapp_number',
    (select s.whatsapp_number from public.settings s where s.id),
    'plans',
    coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', p.id,
               'name', p.name,
               'billing_model', p.billing_model,
               'lessons_per_month', p.lessons_per_month,
               'lessons_in_package', p.lessons_in_package,
               'lesson_duration_minutes', p.lesson_duration_minutes,
               'price_cents', p.price_cents,
               'currency', p.currency,
               'description', p.description,
               'benefits', coalesce((
                 select jsonb_agg(b.label order by pb.position, b.label)
                 from public.plan_benefits pb
                 join public.benefits b on b.id = pb.benefit_id
                 where pb.plan_id = p.id
               ), '[]'::jsonb))
             order by p.price_cents, p.name)
      from public.plans p
      where p.active
    ), '[]'::jsonb),
    'teacher_profile',
    (select jsonb_build_object(
              'display_name', tp.display_name,
              'headline', tp.headline,
              'bio', tp.bio,
              'education', to_jsonb(tp.education),
              'experience', to_jsonb(tp.experience),
              'certifications', to_jsonb(tp.certifications),
              'languages', to_jsonb(tp.languages),
              'photo_url', tp.photo_url)
       from public.teacher_profile tp
       where tp.id and tp.published),
    'testimonials',
    coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', t.id,
               'author_name', t.author_name,
               'author_context', t.author_context,
               'body', t.body,
               'rating', t.rating)
             order by t.position, t.created_at)
      from (
        select * from public.testimonials
        where published
        order by position, created_at
        limit 24
      ) t
    ), '[]'::jsonb)
  );
$$;

comment on function public.public_site_info() is
  'Dados publicos da landing (anon): WhatsApp, planos ativos com vantagens, curriculo publicado da professora e depoimentos publicados. Nada alem disso.';

revoke all on function public.public_site_info() from public;
grant execute on function public.public_site_info() to anon, authenticated;
