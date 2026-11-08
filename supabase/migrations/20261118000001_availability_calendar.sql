-- 18 - Calendario: horario padrao com vigencia, excecoes por data e regra efetiva unica.
-- Evolui a migration 16 sem perder dados. Idempotente.
--
-- Modelo (tudo em horario LOCAL do fuso da professora, settings.teacher_timezone):
--   availability_patterns   horario padrao com vigencia (starts_on..ends_on; ends_on NULL =
--                           sem fim) e duracao padrao da aula. Varios padroes podem coexistir.
--   availability_slots      faixas semanais (dia da semana, inicio, fim) de um padrao
--                           (pattern_id). Intervalos (ex.: almoco) = faixas separadas.
--   availability_exceptions excecoes de UMA data:
--                             'fechado'    dia inteiro sem atendimento
--                             'substituir' o horario do dia passa a ser SO estas faixas
--                             'extra'      faixa a mais no dia
--                             'bloqueio'   faixa bloqueada no dia
--   blocked_dates           ferias/feriados (ja existia): dia inteiro bloqueado e aulas
--                           canceladas automaticamente (migration 13).
--
-- Disponibilidade efetiva de uma data D (availability_minutes):
--   1. D em blocked_dates ou com excecao 'fechado'          => vazio
--   2. base = faixas 'substituir' de D, se houver; senao as faixas ativas dos padroes ativos
--      vigentes em D para o dia da semana de D. Se NAO existir nenhum padrao ativo (horario
--      ainda nao configurado), base = dia inteiro (comportamento anterior).
--   3. + faixas 'extra'   4. - faixas 'bloqueio'
-- Uma aula de inicio S e duracao M esta disponivel se [S, S+M) cabe inteira na disponibilidade
-- efetiva do dia local de S (sem atravessar a meia-noite). Funcao unica: is_slot_available.
-- O front espelha a mesma regra em src/features/calendar/engine.ts.

-- ------------------------------------------------------------------ settings
alter table public.settings
  add column if not exists teacher_timezone text not null default 'America/Sao_Paulo';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'settings_teacher_timezone_chk'
                 and conrelid = 'public.settings'::regclass) then
    alter table public.settings add constraint settings_teacher_timezone_chk
      check (char_length(teacher_timezone) between 1 and 64);
  end if;
end $$;
comment on column public.settings.teacher_timezone is
  'Fuso das regras de disponibilidade (horario padrao, excecoes). Padrao America/Sao_Paulo.';

-- ------------------------------------------------------------------ padroes
create table if not exists public.availability_patterns (
  id                      uuid primary key default gen_random_uuid(),
  name                    text not null default 'Horário padrão'
                            check (char_length(btrim(name)) between 1 and 80),
  starts_on               date not null default current_date,
  ends_on                 date,
  default_lesson_minutes  integer not null default 60 check (default_lesson_minutes between 15 and 240),
  active                  boolean not null default true,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  constraint availability_patterns_range_chk check (ends_on is null or ends_on >= starts_on)
);

drop trigger if exists set_updated_at on public.availability_patterns;
create trigger set_updated_at before update on public.availability_patterns
  for each row execute function public.set_updated_at();

alter table public.availability_slots
  add column if not exists pattern_id uuid references public.availability_patterns (id) on delete cascade;
create index if not exists availability_slots_pattern_id_idx on public.availability_slots (pattern_id);

-- Faixas antigas (migration 16) viram um padrao sem fim, para nao mudar o comportamento.
do $$
declare v_id uuid;
begin
  if exists (select 1 from public.availability_slots where pattern_id is null) then
    insert into public.availability_patterns (name, starts_on, ends_on)
    values ('Horário padrão', '2000-01-01', null)
    returning id into v_id;
    update public.availability_slots set pattern_id = v_id where pattern_id is null;
  end if;
end $$;

alter table public.availability_slots alter column pattern_id set not null;

-- ------------------------------------------------------------------ excecoes
create table if not exists public.availability_exceptions (
  id         uuid primary key default gen_random_uuid(),
  on_date    date not null,
  kind       text not null check (kind in ('fechado', 'substituir', 'extra', 'bloqueio')),
  start_time time,
  end_time   time,
  reason     text check (reason is null or char_length(reason) <= 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- 'fechado' nao tem faixa; os demais tem (fim > inicio; 24:00 = fim do dia).
  constraint availability_exceptions_range_chk check (
    (kind = 'fechado' and start_time is null and end_time is null)
    or (kind <> 'fechado' and start_time is not null and end_time is not null
        and (end_time > start_time or end_time = '24:00'::time))
  )
);
create index if not exists availability_exceptions_date_idx on public.availability_exceptions (on_date);

drop trigger if exists set_updated_at on public.availability_exceptions;
create trigger set_updated_at before update on public.availability_exceptions
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------------ RLS (staff)
alter table public.availability_patterns   enable row level security;
alter table public.availability_exceptions enable row level security;

do $$
declare t text;
begin
  foreach t in array array['availability_patterns', 'availability_exceptions'] loop
    execute format('drop policy if exists %I on public.%I', t || '_staff_select', t);
    execute format('drop policy if exists %I on public.%I', t || '_staff_insert', t);
    execute format('drop policy if exists %I on public.%I', t || '_staff_update', t);
    execute format('drop policy if exists %I on public.%I', t || '_staff_delete', t);
    execute format('create policy %I on public.%I for select to authenticated using ((select public.is_staff()))', t || '_staff_select', t);
    execute format('create policy %I on public.%I for insert to authenticated with check ((select public.is_staff()))', t || '_staff_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using ((select public.is_staff())) with check ((select public.is_staff()))', t || '_staff_update', t);
    execute format('create policy %I on public.%I for delete to authenticated using ((select public.is_staff()))', t || '_staff_delete', t);
  end loop;
end $$;

revoke all on public.availability_patterns, public.availability_exceptions from anon, authenticated;
grant select, insert, update, delete on public.availability_patterns, public.availability_exceptions to authenticated;

-- ------------------------------------------------------------------ regra efetiva
-- Minutos de 0 a 1440 como int4multirange. "24:00" vira 1440.
create or replace function public.time_to_minute(p time)
returns integer language sql immutable set search_path = '' as $$
  select (extract(epoch from p) / 60)::integer;
$$;

-- Disponibilidade efetiva (minutos locais) de uma data. SECURITY DEFINER: o trigger de
-- reposicao precisa ler as tabelas qualquer que seja o papel de quem grava.
create or replace function public.availability_minutes(p_date date)
returns int4multirange language plpgsql stable security definer set search_path = '' as $$
declare
  v_base   int4multirange;
  v_extra  int4multirange;
  v_block  int4multirange;
  v_dow    integer := extract(dow from p_date)::integer;
begin
  if p_date is null then
    return '{}'::int4multirange;
  end if;
  if exists (select 1 from public.blocked_dates b where p_date between b.starts_on and b.ends_on)
     or exists (select 1 from public.availability_exceptions e
                where e.on_date = p_date and e.kind = 'fechado') then
    return '{}'::int4multirange;
  end if;

  if exists (select 1 from public.availability_exceptions e
             where e.on_date = p_date and e.kind = 'substituir') then
    select range_agg(int4range(public.time_to_minute(e.start_time), public.time_to_minute(e.end_time)))
      into v_base
    from public.availability_exceptions e
    where e.on_date = p_date and e.kind = 'substituir';
  elsif not exists (select 1 from public.availability_patterns p where p.active) then
    v_base := int4multirange(int4range(0, 1440));  -- horario ainda nao configurado
  else
    select range_agg(int4range(public.time_to_minute(s.start_time), public.time_to_minute(s.end_time)))
      into v_base
    from public.availability_slots s
    join public.availability_patterns p on p.id = s.pattern_id
    where p.active and s.active
      and s.weekday = v_dow
      and p_date >= p.starts_on
      and (p.ends_on is null or p_date <= p.ends_on);
  end if;

  select range_agg(int4range(public.time_to_minute(e.start_time), public.time_to_minute(e.end_time)))
    into v_extra
  from public.availability_exceptions e
  where e.on_date = p_date and e.kind = 'extra';

  select range_agg(int4range(public.time_to_minute(e.start_time), public.time_to_minute(e.end_time)))
    into v_block
  from public.availability_exceptions e
  where e.on_date = p_date and e.kind = 'bloqueio';

  return (coalesce(v_base, '{}'::int4multirange) + coalesce(v_extra, '{}'::int4multirange))
         - coalesce(v_block, '{}'::int4multirange);
end $$;

-- 'ok' | 'bloqueado' (ferias/feriado ou dia fechado) | 'fora_disponibilidade'.
create or replace function public.is_slot_available(p_starts_at timestamptz, p_duration integer)
returns text language plpgsql stable security definer set search_path = '' as $$
declare
  v_tz    text;
  v_local timestamp;
  v_date  date;
  v_start integer;
begin
  if p_starts_at is null or p_duration is null or p_duration <= 0 then
    return 'fora_disponibilidade';
  end if;
  select coalesce(s.teacher_timezone, 'America/Sao_Paulo') into v_tz from public.settings s where s.id;
  v_tz := coalesce(v_tz, 'America/Sao_Paulo');
  v_local := p_starts_at at time zone v_tz;
  v_date := v_local::date;
  v_start := (extract(hour from v_local) * 60 + extract(minute from v_local))::integer;

  if exists (select 1 from public.blocked_dates b where v_date between b.starts_on and b.ends_on)
     or exists (select 1 from public.availability_exceptions e
                where e.on_date = v_date and e.kind = 'fechado') then
    return 'bloqueado';
  end if;

  if v_start + p_duration <= 1440
     and int4range(v_start, v_start + p_duration) <@ public.availability_minutes(v_date) then
    return 'ok';
  end if;
  return 'fora_disponibilidade';
end $$;

-- Compatibilidade: check_makeup_slot (migration 16, usado pelo front) delega para a regra nova.
create or replace function public.check_makeup_slot(p_starts_at timestamptz, p_duration integer)
returns text language sql stable security definer set search_path = '' as $$
  select public.is_slot_available(p_starts_at, p_duration);
$$;

create or replace function public.lessons_makeup_availability()
returns trigger language plpgsql set search_path = '' as $$
declare v_res text;
begin
  if new.status <> 'reposicao' then
    return new;
  end if;
  if tg_op = 'UPDATE'
     and old.status = 'reposicao'
     and new.starts_at is not distinct from old.starts_at
     and new.duration_minutes is not distinct from old.duration_minutes then
    return new;
  end if;

  v_res := public.is_slot_available(new.starts_at, new.duration_minutes);
  if v_res = 'bloqueado' then
    raise exception 'reposicao em ferias ou feriado: escolha outra data' using errcode = '23514';
  elsif v_res = 'fora_disponibilidade' then
    raise exception 'reposicao fora da disponibilidade da professora' using errcode = '23514';
  end if;
  return new;
end $$;

revoke all on function public.time_to_minute(time) from public, anon;
revoke all on function public.availability_minutes(date) from public, anon;
revoke all on function public.is_slot_available(timestamptz, integer) from public, anon;
revoke all on function public.check_makeup_slot(timestamptz, integer) from public, anon;
revoke all on function public.lessons_makeup_availability() from public, anon, authenticated;
grant execute on function public.time_to_minute(time) to authenticated;
grant execute on function public.availability_minutes(date) to authenticated;
grant execute on function public.is_slot_available(timestamptz, integer) to authenticated;
grant execute on function public.check_makeup_slot(timestamptz, integer) to authenticated;
