-- 20 - Remarcacao desliga a ocorrencia do horario fixo + aulas so no futuro. Idempotente.
--
-- 1. lessons.original_starts_at: quando uma aula GERADA por horario fixo (schedule_id) muda de
--    data/hora, guardamos o horario original da ocorrencia. A geracao recorrente pula qualquer
--    ocorrencia (schedule_id + horario) que ja exista como aula, esteja ela no horario original,
--    remarcada (original_starts_at) ou cancelada. Assim gerar o periodo de novo nao recria a
--    aula no horario antigo. Indice unico garante idempotencia.
-- 2. Aulas so no futuro: pelo app (papeis anon/authenticated) nao se cria nem se remarca aula
--    'agendada'/'reposicao' para um horario que ja passou; a geracao recorrente so cria
--    ocorrencias futuras. O historico existente nao muda. SQL editor/servico nao sao limitados.

alter table public.lessons
  add column if not exists original_starts_at timestamptz;
comment on column public.lessons.original_starts_at is
  'Horario original da ocorrencia do horario fixo quando a aula foi remarcada (NULL = nunca remarcada).';
create unique index if not exists lessons_schedule_original_key
  on public.lessons (schedule_id, original_starts_at)
  where schedule_id is not null and original_starts_at is not null;

-- ------------------------------------------------ guarda o horario original
create or replace function public.lessons_track_reschedule()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.schedule_id is not null
     and old.schedule_id is not distinct from new.schedule_id
     and new.starts_at is distinct from old.starts_at
     and old.original_starts_at is null then
    new.original_starts_at := old.starts_at;
  end if;
  -- O cliente nao altera o original manualmente.
  if old.original_starts_at is not null then
    new.original_starts_at := old.original_starts_at;
  end if;
  return new;
end $$;

drop trigger if exists lessons_track_reschedule on public.lessons;
create trigger lessons_track_reschedule
  before update on public.lessons
  for each row execute function public.lessons_track_reschedule();

revoke all on function public.lessons_track_reschedule() from public, anon, authenticated;

-- ------------------------------------------------ regra unica + futuro
-- Igual a migration 19, acrescentando a checagem de "so futuro" para chamadas do app.
create or replace function public.lessons_availability_rule()
returns trigger language plpgsql set search_path = '' as $$
declare v_res text;
begin
  if new.status not in ('agendada', 'reposicao') then
    return new;
  end if;
  if tg_op = 'UPDATE'
     and old.status in ('agendada', 'reposicao')
     and new.starts_at is not distinct from old.starts_at
     and new.duration_minutes is not distinct from old.duration_minutes then
    return new;
  end if;

  if coalesce((select auth.role()), '') in ('anon', 'authenticated')
     and new.starts_at <= now()
     and (tg_op = 'INSERT' or new.starts_at is distinct from old.starts_at) then
    raise exception 'aula no passado: so e possivel criar ou remarcar aulas futuras'
      using errcode = '23514';
  end if;

  v_res := public.is_slot_available(new.starts_at, new.duration_minutes);
  if v_res = 'ok' then
    return new;
  end if;

  if new.status = 'reposicao' then
    if v_res = 'bloqueado' then
      raise exception 'reposicao em ferias ou feriado: escolha outra data' using errcode = '23514';
    end if;
    raise exception 'reposicao fora da disponibilidade da professora' using errcode = '23514';
  end if;

  if v_res = 'bloqueado' then
    raise exception 'aula em ferias, feriado ou dia fechado: escolha outra data' using errcode = '23514';
  end if;
  raise exception 'aula fora da disponibilidade da professora: escolha um horario disponivel'
    using errcode = '23514';
end $$;

-- ------------------------------------------------ candidatas da geracao
-- Igual a migration 19, mais: so futuro e pula ocorrencias que ja existem (em qualquer estado)
-- ou que foram remarcadas (original_starts_at).
create or replace function public.recurring_candidates(p_from date, p_to date)
returns table (student_id uuid, schedule_id uuid, duration_minutes integer, starts_at timestamptz)
language sql stable security invoker set search_path = '' as $$
  select x.student_id, x.schedule_id, x.duration_minutes, x.starts_at
  from (
    select s.student_id, s.id as schedule_id, s.duration_minutes,
           ((dd.d + s.start_time) at time zone s.timezone) as starts_at
    from public.schedules s
    join public.students st on st.id = s.student_id and st.status = 'ativo'
    cross join lateral generate_series(0, p_to - p_from) as g(i)
    cross join lateral (select p_from + g.i as d) dd
    where s.active
      and dd.d >= s.starts_on
      and dd.d <= coalesce(s.ends_on, 'infinity'::date)
      and extract(dow from dd.d) = s.weekday
      and not exists (
        select 1 from public.blocked_dates b where dd.d between b.starts_on and b.ends_on
      )
  ) x
  where x.starts_at > now()
    and not exists (
      select 1 from public.lessons l
      where l.schedule_id = x.schedule_id
        and (l.starts_at = x.starts_at or l.original_starts_at = x.starts_at)
    );
$$;

revoke all on function public.recurring_candidates(date, date) from public, anon;
grant execute on function public.recurring_candidates(date, date) to authenticated;
