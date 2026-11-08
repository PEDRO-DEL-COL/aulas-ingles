-- 15 - Vantagens dos planos (lista reutilizavel) e dia de vencimento padrao. Idempotente.
--
-- benefits: catalogo de vantagens ("Material em PDF", "Correcao de tarefas" ...).
-- plan_benefits: quais vantagens cada plano tem, na ordem de exibicao.
-- Leitura: qualquer usuario ativo (como plans). Escrita: SO admin (como plans).
-- Visitante (anon) ve as vantagens apenas dos planos ATIVOS, via public_site_info().
-- settings.default_due_day: dia de vencimento padrao das mensalidades (1 a 31; so admin edita).

-- ------------------------------------------------------------------ tabelas
create table if not exists public.benefits (
  id         uuid primary key default gen_random_uuid(),
  label      text not null check (char_length(btrim(label)) between 1 and 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- Mesma vantagem nao se repete (sem diferenciar maiusculas/espacos).
create unique index if not exists benefits_label_key on public.benefits (lower(btrim(label)));

create table if not exists public.plan_benefits (
  plan_id    uuid not null references public.plans (id) on delete cascade,
  benefit_id uuid not null references public.benefits (id) on delete cascade,
  position   integer not null default 0 check (position between 0 and 1000),
  created_at timestamptz not null default now(),
  primary key (plan_id, benefit_id)
);
create index if not exists plan_benefits_benefit_id_idx on public.plan_benefits (benefit_id);

drop trigger if exists set_updated_at on public.benefits;
create trigger set_updated_at before update on public.benefits
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------- RLS
alter table public.benefits      enable row level security;
alter table public.plan_benefits enable row level security;

drop policy if exists benefits_select_active_user on public.benefits;
drop policy if exists benefits_admin_insert on public.benefits;
drop policy if exists benefits_admin_update on public.benefits;
drop policy if exists benefits_admin_delete on public.benefits;
create policy benefits_select_active_user on public.benefits for select to authenticated
  using ((select public.is_active_user()));
create policy benefits_admin_insert on public.benefits for insert to authenticated
  with check ((select public.is_admin()));
create policy benefits_admin_update on public.benefits for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy benefits_admin_delete on public.benefits for delete to authenticated
  using ((select public.is_admin()));

drop policy if exists plan_benefits_select_active_user on public.plan_benefits;
drop policy if exists plan_benefits_admin_insert on public.plan_benefits;
drop policy if exists plan_benefits_admin_update on public.plan_benefits;
drop policy if exists plan_benefits_admin_delete on public.plan_benefits;
create policy plan_benefits_select_active_user on public.plan_benefits for select to authenticated
  using ((select public.is_active_user()));
create policy plan_benefits_admin_insert on public.plan_benefits for insert to authenticated
  with check ((select public.is_admin()));
create policy plan_benefits_admin_update on public.plan_benefits for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy plan_benefits_admin_delete on public.plan_benefits for delete to authenticated
  using ((select public.is_admin()));

revoke all on public.benefits, public.plan_benefits from anon, authenticated;
grant select, insert, update, delete on public.benefits, public.plan_benefits to authenticated;

-- ------------------------------------------------------- settings: vencimento
alter table public.settings
  add column if not exists default_due_day integer not null default 10;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'settings_default_due_day_chk'
                 and conrelid = 'public.settings'::regclass) then
    alter table public.settings add constraint settings_default_due_day_chk
      check (default_due_day between 1 and 31);
  end if;
end $$;
comment on column public.settings.default_due_day is
  'Dia de vencimento padrao das mensalidades (1 a 31; meses curtos usam o ultimo dia). Editavel so por admin.';

-- ---------------------------------------------- public_site_info com vantagens
-- Igual a migration 12, acrescentando "benefits" (rotulos, na ordem) em cada plano ativo.
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
    ), '[]'::jsonb)
  );
$$;

revoke all on function public.public_site_info() from public;
grant execute on function public.public_site_info() to anon, authenticated;
