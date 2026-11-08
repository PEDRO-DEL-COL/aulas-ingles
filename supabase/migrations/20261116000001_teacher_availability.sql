-- 16 - Disponibilidade da professora e regra de reposicao. Idempotente.
--
-- availability_slots: faixas semanais em que a professora aceita aulas (dia da semana,
-- inicio e fim no horario LOCAL do fuso `timezone`). Base da futura "agenda virtual".
-- Excecoes: blocked_dates (ferias/feriados) valem por cima da disponibilidade.
--
-- Regra (trigger lessons_makeup_availability): uma REPOSICAO (status 'reposicao') so pode
-- ser marcada/movida para
--   * fora de ferias/feriados (data local em blocked_dates => erro), e
--   * dentro de uma faixa ATIVA de disponibilidade que contenha a aula inteira
--     (inicio >= faixa.inicio e inicio + duracao <= faixa.fim, no mesmo dia local).
-- Enquanto NENHUMA faixa ativa existir, so a regra de ferias/feriados vale (a
-- disponibilidade ainda nao foi configurada); a tela avisa a professora.
-- Aulas recorrentes (generate_lessons) nao passam por esta regra.
-- Leitura e escrita de availability_slots: staff (professora/admin).

create table if not exists public.availability_slots (
  id         uuid primary key default gen_random_uuid(),
  weekday    smallint not null check (weekday between 0 and 6),  -- 0 = domingo
  start_time time not null,
  end_time   time not null,
  timezone   text not null default 'America/Sao_Paulo' check (char_length(timezone) between 1 and 64),
  active     boolean not null default true,
  notes      text check (notes is null or char_length(notes) <= 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint availability_slots_range_chk check (end_time > start_time)
);
create index if not exists availability_slots_weekday_idx
  on public.availability_slots (weekday) where active;

drop trigger if exists set_updated_at on public.availability_slots;
create trigger set_updated_at before update on public.availability_slots
  for each row execute function public.set_updated_at();

alter table public.availability_slots enable row level security;
drop policy if exists availability_slots_staff_select on public.availability_slots;
drop policy if exists availability_slots_staff_insert on public.availability_slots;
drop policy if exists availability_slots_staff_update on public.availability_slots;
drop policy if exists availability_slots_staff_delete on public.availability_slots;
create policy availability_slots_staff_select on public.availability_slots for select to authenticated
  using ((select public.is_staff()));
create policy availability_slots_staff_insert on public.availability_slots for insert to authenticated
  with check ((select public.is_staff()));
create policy availability_slots_staff_update on public.availability_slots for update to authenticated
  using ((select public.is_staff())) with check ((select public.is_staff()));
create policy availability_slots_staff_delete on public.availability_slots for delete to authenticated
  using ((select public.is_staff()));

revoke all on public.availability_slots from anon, authenticated;
grant select, insert, update, delete on public.availability_slots to authenticated;

-- ------------------------------------------------------------ verificacao
-- 'ok' | 'bloqueado' (ferias/feriado) | 'fora_disponibilidade'.
-- SECURITY DEFINER para o trigger enxergar blocked_dates/availability_slots qualquer que
-- seja o papel de quem grava (as RPCs de reposicao ja sao so de staff).
create or replace function public.check_makeup_slot(p_starts_at timestamptz, p_duration integer)
returns text language plpgsql stable security definer set search_path = '' as $$
declare
  v_any   boolean;
  v_local timestamp;
begin
  if p_starts_at is null or p_duration is null or p_duration <= 0 then
    return 'fora_disponibilidade';
  end if;

  -- Ferias/feriados pela data local de Sao Paulo (mesmo criterio das aulas sem horario fixo).
  if exists (
    select 1 from public.blocked_dates b
    where (p_starts_at at time zone 'America/Sao_Paulo')::date between b.starts_on and b.ends_on
  ) then
    return 'bloqueado';
  end if;

  select exists (select 1 from public.availability_slots where active) into v_any;
  if not v_any then
    return 'ok';  -- disponibilidade ainda nao configurada
  end if;

  if exists (
    select 1 from public.availability_slots a
    where a.active
      and extract(dow from (p_starts_at at time zone a.timezone)) = a.weekday
      and (p_starts_at at time zone a.timezone)::time >= a.start_time
      -- a aula inteira cabe na faixa e termina no mesmo dia local
      and (p_starts_at at time zone a.timezone) + make_interval(mins => p_duration)
          <= (p_starts_at at time zone a.timezone)::date + a.end_time
  ) then
    return 'ok';
  end if;
  return 'fora_disponibilidade';
end $$;

revoke all on function public.check_makeup_slot(timestamptz, integer) from public, anon;
grant execute on function public.check_makeup_slot(timestamptz, integer) to authenticated;

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

  v_res := public.check_makeup_slot(new.starts_at, new.duration_minutes);
  if v_res = 'bloqueado' then
    raise exception 'reposicao em ferias ou feriado: escolha outra data' using errcode = '23514';
  elsif v_res = 'fora_disponibilidade' then
    raise exception 'reposicao fora da disponibilidade da professora' using errcode = '23514';
  end if;
  return new;
end $$;

drop trigger if exists lessons_makeup_availability on public.lessons;
create trigger lessons_makeup_availability
  before insert or update on public.lessons
  for each row execute function public.lessons_makeup_availability();

revoke all on function public.lessons_makeup_availability() from public, anon, authenticated;
