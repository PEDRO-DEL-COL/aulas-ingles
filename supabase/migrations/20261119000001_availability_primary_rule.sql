-- 19 - Disponibilidade como regra PRIMARIA de horarios para todas as aulas. Idempotente.
--
-- Fonte de verdade continua sendo is_slot_available (migration 18). Agora vale para:
--   * aula nova (avulsa, gerada pelos horarios fixos ou reposicao) com status 'agendada' ou
--     'reposicao';
--   * remarcacao: mudanca de starts_at ou duration_minutes de aula 'agendada'/'reposicao';
--   * aula que VOLTA a ficar 'agendada'/'reposicao' (ex.: desfazer um cancelamento).
-- NAO revalida aulas existentes sem mudanca de horario, nem aulas canceladas, realizadas ou
-- com falta (nada e invalidado retroativamente).
--
-- Sem nenhum horario padrao ativo (professora ainda nao cadastrou), o banco continua
-- PERMISSIVO (dia inteiro disponivel, exceto ferias/feriados/dias fechados/bloqueios): assim a
-- operacao nao trava; o app mostra um alerta forte pedindo para cadastrar o horario padrao.
--
-- Geracao recorrente: generate_lessons passa a PULAR ocorrencias fora da disponibilidade (em
-- vez de falhar o lote) e generate_recurring_lessons devolve o que foi criado e o que foi pulado.

-- ------------------------------------------------------------- trigger unico
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

  v_res := public.is_slot_available(new.starts_at, new.duration_minutes);
  if v_res = 'ok' then
    return new;
  end if;

  if new.status = 'reposicao' then
    -- Mensagens mantidas da migration 16 (o front e os testes ja as conhecem).
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

-- Substitui o trigger so de reposicao (migration 16/18) pelo trigger geral.
drop trigger if exists lessons_makeup_availability on public.lessons;
drop trigger if exists lessons_availability_rule on public.lessons;
create trigger lessons_availability_rule
  before insert or update on public.lessons
  for each row execute function public.lessons_availability_rule();

revoke all on function public.lessons_availability_rule() from public, anon, authenticated;

-- ------------------------------------------------------- geracao recorrente
-- Candidatas = mesmas da migration 03 (schedules ativos, alunos ativos, sem blocked_dates).
-- Fica em uma funcao para generate_lessons e generate_recurring_lessons usarem igual.
create or replace function public.recurring_candidates(p_from date, p_to date)
returns table (student_id uuid, schedule_id uuid, duration_minutes integer, starts_at timestamptz)
language sql stable security invoker set search_path = '' as $$
  select s.student_id, s.id, s.duration_minutes,
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
    );
$$;

-- Mantida (o front antigo chama): agora so cria as ocorrencias disponiveis.
create or replace function public.generate_lessons(p_from date, p_to date)
returns integer language plpgsql security invoker set search_path = '' as $$
declare v_count integer;
begin
  if p_from is null or p_to is null or p_to < p_from then
    raise exception 'intervalo invalido';
  end if;
  if p_to - p_from > 366 then
    raise exception 'intervalo maximo de 366 dias';
  end if;

  with ins as (
    insert into public.lessons (student_id, schedule_id, starts_at, duration_minutes, status)
    select c.student_id, c.schedule_id, c.starts_at, c.duration_minutes, 'agendada'::public.lesson_status
    from public.recurring_candidates(p_from, p_to) c
    where public.is_slot_available(c.starts_at, c.duration_minutes) = 'ok'
    on conflict (schedule_id, starts_at) do nothing
    returning 1
  )
  select count(*) into v_count from ins;
  return v_count;
end $$;

-- Relatorio completo: { created: n, skipped: [ { student_id, student_name, starts_at,
-- duration_minutes, reason: 'bloqueado' | 'fora_disponibilidade' } ] } (skipped limitado a 200;
-- skipped_total traz o total). Ocorrencias que ja existiam nao aparecem.
create or replace function public.generate_recurring_lessons(p_from date, p_to date)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_created integer;
  v_skipped jsonb;
  v_skipped_total integer;
begin
  if not public.is_staff() then
    raise exception 'somente a equipe gera aulas' using errcode = '42501';
  end if;
  if p_from is null or p_to is null or p_to < p_from then
    raise exception 'intervalo invalido';
  end if;
  if p_to - p_from > 366 then
    raise exception 'intervalo maximo de 366 dias';
  end if;

  with c as (
    select rc.*, public.is_slot_available(rc.starts_at, rc.duration_minutes) as res
    from public.recurring_candidates(p_from, p_to) rc
    where not exists (select 1 from public.lessons l
                      where l.schedule_id = rc.schedule_id and l.starts_at = rc.starts_at)
  )
  select count(*) filter (where res <> 'ok'),
         coalesce(jsonb_agg(jsonb_build_object(
           'student_id', c.student_id,
           'student_name', st.full_name,
           'starts_at', c.starts_at,
           'duration_minutes', c.duration_minutes,
           'reason', c.res) order by c.starts_at) filter (where res <> 'ok'), '[]'::jsonb)
    into v_skipped_total, v_skipped
  from c join public.students st on st.id = c.student_id;

  v_created := public.generate_lessons(p_from, p_to);

  return jsonb_build_object(
    'created', v_created,
    'skipped_total', coalesce(v_skipped_total, 0),
    'skipped', (select coalesce(jsonb_agg(e), '[]'::jsonb)
                from (select e from jsonb_array_elements(v_skipped) e limit 200) x)
  );
end $$;

revoke all on function public.recurring_candidates(date, date) from public, anon;
revoke all on function public.generate_lessons(date, date) from public, anon;
revoke all on function public.generate_recurring_lessons(date, date) from public, anon;
grant execute on function public.recurring_candidates(date, date) to authenticated;
grant execute on function public.generate_lessons(date, date) to authenticated;
grant execute on function public.generate_recurring_lessons(date, date) to authenticated;
