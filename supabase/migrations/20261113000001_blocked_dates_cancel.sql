-- 13 - Ferias e feriados cancelam as aulas ja agendadas no periodo. Idempotente.
--
-- Ao inserir um periodo em blocked_dates (ou ampliar/alterar as datas), as aulas
-- 'agendada'/'reposicao' que ainda nao comecaram e cuja data LOCAL (fuso do horario fixo;
-- sem horario fixo, America/Sao_Paulo) cai no periodo viram 'cancelada_professora'.
-- O trigger lessons_cancellation_rules ja da direito a reposicao (makeup_eligible = true).
-- lessons.blocked_date_id registra qual periodo cancelou a aula (resumo na tela).
-- Excluir o periodo NAO reativa as aulas (a professora decide caso a caso).
--
-- Limite de reposicoes: reposicao cuja aula de origem foi 'cancelada_professora' (por
-- ferias/feriado ou nao) NAO conta para max_makeups_per_month: o cancelamento foi da
-- professora. Vale no trigger lessons_makeup_rules e em makeups_used_in_month.

alter table public.lessons
  add column if not exists blocked_date_id uuid references public.blocked_dates (id) on delete set null;
create index if not exists lessons_blocked_date_id_idx on public.lessons (blocked_date_id);

comment on column public.lessons.blocked_date_id is
  'Periodo de ferias/feriado (blocked_dates) que cancelou esta aula automaticamente.';

-- ------------------------------------------------ cancelamento automatico
-- SECURITY INVOKER: so staff escreve blocked_dates (RLS) e staff pode alterar lessons.
create or replace function public.blocked_dates_cancel_lessons()
returns trigger language plpgsql set search_path = '' as $$
declare v_reason text;
begin
  if tg_op = 'UPDATE'
     and new.starts_on = old.starts_on and new.ends_on = old.ends_on then
    return null;
  end if;

  v_reason := left('Férias/feriado' || coalesce(': ' || nullif(btrim(new.reason), ''), ''), 500);

  update public.lessons l
  set status = 'cancelada_professora'::public.lesson_status,
      cancel_reason = v_reason,
      blocked_date_id = new.id
  where l.status in ('agendada', 'reposicao')
    and l.starts_at > now()
    and (l.starts_at at time zone coalesce(
           (select s.timezone from public.schedules s where s.id = l.schedule_id),
           'America/Sao_Paulo'))::date between new.starts_on and new.ends_on;

  return null;
end $$;

drop trigger if exists blocked_dates_cancel_lessons on public.blocked_dates;
create trigger blocked_dates_cancel_lessons
  after insert or update of starts_on, ends_on on public.blocked_dates
  for each row execute function public.blocked_dates_cancel_lessons();

revoke all on function public.blocked_dates_cancel_lessons() from public, anon, authenticated;

-- ------------------------------------------------ contagem do limite de reposicoes
-- Reposicoes do aluno que CONTAM no mes civil (America/Sao_Paulo) de p_at, exceto p_exclude.
-- Nao contam: reposicao cancelada pela professora; reposicao cancelada pelo aluno com direito
-- a nova; reposicao cuja origem foi cancelada pela professora.
create or replace function public.makeups_counted_in_month(
  p_student uuid, p_at timestamptz, p_exclude uuid default null)
returns integer language sql stable security invoker set search_path = '' as $$
  select count(*)::int
  from public.lessons l
  join public.lessons o on o.id = l.rescheduled_from
  where l.student_id = p_student
    and (p_exclude is null or l.id <> p_exclude)
    and l.status <> 'cancelada_professora'
    and not (l.status = 'cancelada_aluno' and l.makeup_eligible is true)
    and o.status <> 'cancelada_professora'
    and date_trunc('month', l.starts_at at time zone 'America/Sao_Paulo')
        = date_trunc('month', p_at at time zone 'America/Sao_Paulo');
$$;

-- SECURITY INVOKER: respeita a RLS de quem chama (staff ve tudo; aluno so o proprio).
-- Precisa de EXECUTE para authenticated porque o trigger roda como o usuario do app.
revoke all on function public.makeups_counted_in_month(uuid, timestamptz, uuid) from public, anon;
grant execute on function public.makeups_counted_in_month(uuid, timestamptz, uuid) to authenticated;

-- Igual a migration 08, trocando a contagem e isentando origem cancelada pela professora.
create or replace function public.lessons_makeup_rules()
returns trigger language plpgsql set search_path = '' as $$
declare
  v_origin public.lessons;
  v_max    integer;
  v_used   integer;
begin
  if tg_op = 'UPDATE' and new.rescheduled_from is null and old.rescheduled_from is not null then
    return new;
  end if;

  if new.status = 'reposicao' and new.rescheduled_from is null
     and (tg_op = 'INSERT' or old.status is distinct from new.status) then
    raise exception 'reposicao exige a aula de origem (rescheduled_from)' using errcode = '23514';
  end if;

  if new.rescheduled_from is null then return new; end if;
  if new.status in ('cancelada_aluno', 'cancelada_professora') then return new; end if;

  if tg_op = 'UPDATE'
     and new.rescheduled_from is not distinct from old.rescheduled_from
     and new.starts_at is not distinct from old.starts_at
     and new.student_id is not distinct from old.student_id
     and not (new.status = 'reposicao' and old.status is distinct from 'reposicao') then
    return new;
  end if;

  select * into v_origin from public.lessons where id = new.rescheduled_from;
  if not found then
    raise exception 'aula de origem nao encontrada' using errcode = '23514';
  end if;
  if v_origin.id = new.id then
    raise exception 'uma aula nao pode ser reposicao de si mesma' using errcode = '23514';
  end if;
  if v_origin.student_id <> new.student_id then
    raise exception 'a reposicao deve ser do mesmo aluno da aula de origem' using errcode = '23514';
  end if;
  if v_origin.makeup_eligible is not true then
    raise exception 'a aula de origem nao tem direito a reposicao' using errcode = '23514';
  end if;
  if exists (select 1 from public.lessons r
             where r.rescheduled_from = new.rescheduled_from and r.id <> new.id) then
    raise exception 'a aula de origem ja tem reposicao' using errcode = '23514';
  end if;

  -- Cancelamento da professora: a reposicao nao entra no limite do aluno.
  if v_origin.status = 'cancelada_professora' then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(new.student_id::text, 0));

  select s.max_makeups_per_month into v_max from public.settings s where s.id;
  v_max := coalesce(v_max, 2);

  v_used := public.makeups_counted_in_month(new.student_id, new.starts_at, new.id);

  if v_used >= v_max then
    raise exception 'limite de % reposicoes no mes atingido para este aluno', v_max
      using errcode = '23514';
  end if;

  return new;
end $$;

create or replace function public.makeups_used_in_month(p_student uuid, p_month date)
returns integer language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.can_view_student(p_student) then
    raise exception 'acesso negado' using errcode = '42501';
  end if;
  return public.makeups_counted_in_month(
    p_student, (p_month::timestamp at time zone 'America/Sao_Paulo'), null);
end $$;

revoke all on function public.lessons_makeup_rules() from public, anon, authenticated;
revoke all on function public.makeups_used_in_month(uuid, date) from public, anon;
grant execute on function public.makeups_used_in_month(uuid, date) to authenticated;
