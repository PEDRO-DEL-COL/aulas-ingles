-- 08 - Politica de cancelamento e reposicao, aplicada NO BANCO. Idempotente.
-- Depende da migration 05 (valor 'cancelada_aluno' do enum, ja commitado).
--
-- Regras (configuraveis em settings; so admin edita):
--   cancelada_aluno      antecedencia >= cancellation_min_hours            => makeup_eligible = true
--                        faixa intermediaria habilitada e antecedencia
--                          >= late_cancel_band_min_hours (e < min_hours)   => NULL (professora decide)
--                        caso contrario                                    => false
--   falta_aluno          => makeup_eligible = false (sempre)
--   cancelada_professora => makeup_eligible = true  (sempre)
-- O calculo e SEMPRE feito pelo trigger; o valor enviado e ignorado. A unica forma de mudar
-- makeup_eligible depois (quando NULL) e a RPC decide_makeup (so staff).
-- Reposicao: lessons com status 'reposicao' e rescheduled_from preenchido.
--   Validada por trigger: mesma pessoa, origem com makeup_eligible = true, uma reposicao por
--   origem (indice unico) e limite max_makeups_per_month no MES CIVIL DA REPOSICAO
--   (starts_at da reposicao, fuso America/Sao_Paulo, constante).

-- ------------------------------------------------------------------ settings
alter table public.settings
  add column if not exists late_cancel_band_enabled   boolean not null default false,
  add column if not exists late_cancel_band_min_hours integer not null default 12,
  add column if not exists max_makeups_per_month      integer not null default 2;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'settings_late_band_min_hours_chk'
                 and conrelid = 'public.settings'::regclass) then
    alter table public.settings add constraint settings_late_band_min_hours_chk
      check (late_cancel_band_min_hours >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'settings_max_makeups_chk'
                 and conrelid = 'public.settings'::regclass) then
    alter table public.settings add constraint settings_max_makeups_chk
      check (max_makeups_per_month >= 0);
  end if;
  -- So exige band < min quando a faixa esta habilitada (senao desligar a faixa ficaria
  -- preso a um valor inutil; ex.: cancellation_min_hours = 0).
  if not exists (select 1 from pg_constraint where conname = 'settings_late_band_lt_min_chk'
                 and conrelid = 'public.settings'::regclass) then
    alter table public.settings add constraint settings_late_band_lt_min_chk
      check (not late_cancel_band_enabled or late_cancel_band_min_hours < cancellation_min_hours);
  end if;
end $$;

comment on column public.settings.cancellation_min_hours is
  'Antecedencia minima (horas) para o aluno cancelar COM direito a reposicao. Editavel so por admin.';
comment on column public.settings.late_cancel_band_enabled is
  'Faixa intermediaria: cancelamento com antecedencia >= late_cancel_band_min_hours e < cancellation_min_hours fica com reposicao "a criterio da professora" (makeup_eligible NULL).';
comment on column public.settings.max_makeups_per_month is
  'Maximo de reposicoes por aluno no mes civil (America/Sao_Paulo) da DATA DA REPOSICAO.';
comment on column public.settings.pix_key is
  'Chave Pix. Pode ser NULL enquanto nao existir; o front trata null.';

-- ------------------------------------------------------------------ lessons
alter table public.lessons
  add column if not exists canceled_at        timestamptz,
  add column if not exists canceled_by        uuid references public.profiles (id) on delete set null,
  add column if not exists makeup_eligible    boolean,
  add column if not exists makeup_decided_by  uuid references public.profiles (id) on delete set null;

create index if not exists lessons_canceled_by_idx       on public.lessons (canceled_by);
create index if not exists lessons_makeup_decided_by_idx on public.lessons (makeup_decided_by);

-- Uma reposicao por aula de origem. Substitui o indice comum da migration 02.
drop index if exists public.lessons_rescheduled_from_idx;
create unique index if not exists lessons_rescheduled_from_key
  on public.lessons (rescheduled_from) where rescheduled_from is not null;

comment on column public.lessons.makeup_eligible is
  'true = tem direito a reposicao; false = nao tem; NULL = (cancelada_aluno na faixa intermediaria) a decidir pela professora via decide_makeup, ou aula sem cancelamento. Calculado pelo trigger.';
comment on column public.lessons.canceled_at is
  'Momento do cancelamento (base da antecedencia). Preenchido pelo trigger (now() se nao informado por staff).';
comment on column public.lessons.rescheduled_from is
  'Aula de origem desta reposicao (mesmo aluno, makeup_eligible = true, uma reposicao por origem).';

-- --------------------------------------------- trigger: cancelamento / falta
create or replace function public.lessons_cancellation_rules()
returns trigger language plpgsql set search_path = '' as $$
declare
  v_min      integer;
  v_band     boolean;
  v_band_min integer;
  v_at       timestamptz;
  v_decide   boolean := coalesce(current_setting('app.decide_makeup', true), '') = 'on';
begin
  -- Status inalterado: protege os campos calculados.
  if tg_op = 'UPDATE' and new.status is not distinct from old.status then
    if new.makeup_eligible is distinct from old.makeup_eligible and not v_decide then
      raise exception 'makeup_eligible so pode ser definido pela RPC decide_makeup'
        using errcode = '42501';
    end if;
    if new.makeup_decided_by is distinct from old.makeup_decided_by
       and new.makeup_decided_by is not null and not v_decide then
      raise exception 'makeup_decided_by so pode ser definido pela RPC decide_makeup'
        using errcode = '42501';
    end if;
    if new.canceled_at is distinct from old.canceled_at then
      raise exception 'canceled_at nao pode ser alterado sem mudar o status'
        using errcode = '42501';
    end if;
    -- canceled_by: so pode virar NULL (ex.: exclusao do perfil via FK on delete set null)
    if new.canceled_by is distinct from old.canceled_by and new.canceled_by is not null then
      raise exception 'canceled_by nao pode ser alterado sem mudar o status'
        using errcode = '42501';
    end if;
    return new;
  end if;

  -- INSERT ou mudanca de status ----------------------------------------------
  if new.status = 'cancelada_aluno' then
    if tg_op = 'UPDATE' and old.status not in ('agendada', 'reposicao') then
      raise exception 'so aula agendada ou reposicao pode ser cancelada pelo aluno'
        using errcode = '23514';
    end if;

    select s.cancellation_min_hours, s.late_cancel_band_enabled, s.late_cancel_band_min_hours
      into v_min, v_band, v_band_min
    from public.settings s where s.id;
    v_min      := coalesce(v_min, 24);
    v_band     := coalesce(v_band, false);
    v_band_min := coalesce(v_band_min, 12);

    v_at := coalesce(new.canceled_at, now());
    if v_at >= new.starts_at then
      raise exception 'a aula ja comecou: nao pode ser cancelada' using errcode = '23514';
    end if;
    if v_at > now() + interval '1 minute' then
      raise exception 'canceled_at no futuro' using errcode = '23514';
    end if;

    new.canceled_at := v_at;
    new.canceled_by := coalesce(new.canceled_by, (select auth.uid()));
    new.makeup_decided_by := null;
    if new.starts_at - v_at >= make_interval(hours => v_min) then
      new.makeup_eligible := true;
    elsif v_band and new.starts_at - v_at >= make_interval(hours => v_band_min) then
      new.makeup_eligible := null;  -- a decidir (decide_makeup)
    else
      new.makeup_eligible := false;
    end if;

  elsif new.status = 'falta_aluno' then
    new.makeup_eligible := false;
    new.makeup_decided_by := null;
    new.canceled_at := null;
    new.canceled_by := null;

  elsif new.status = 'cancelada_professora' then
    if tg_op = 'UPDATE' and old.status = 'realizada' then
      raise exception 'aula realizada nao pode ser cancelada' using errcode = '23514';
    end if;
    new.makeup_eligible := true;
    new.makeup_decided_by := null;
    new.canceled_at := coalesce(new.canceled_at, now());
    new.canceled_by := coalesce(new.canceled_by, (select auth.uid()));

  else
    -- agendada / realizada / reposicao: sem campos de cancelamento.
    if tg_op = 'UPDATE' and old.status in ('cancelada_aluno', 'cancelada_professora', 'falta_aluno')
       and exists (select 1 from public.lessons r where r.rescheduled_from = new.id) then
      raise exception 'esta aula ja tem reposicao; nao pode voltar a ficar sem cancelamento'
        using errcode = '23514';
    end if;
    new.canceled_at := null;
    new.canceled_by := null;
    new.makeup_eligible := null;
    new.makeup_decided_by := null;
  end if;

  return new;
end $$;

drop trigger if exists lessons_cancellation_rules on public.lessons;
create trigger lessons_cancellation_rules
  before insert or update on public.lessons
  for each row execute function public.lessons_cancellation_rules();

-- --------------------------------------------------- trigger: reposicao
-- Roda depois de lessons_cancellation_rules (ordem alfabetica dos triggers).
create or replace function public.lessons_makeup_rules()
returns trigger language plpgsql set search_path = '' as $$
declare
  v_origin public.lessons;
  v_max    integer;
  v_used   integer;
  v_tz     constant text := 'America/Sao_Paulo';
begin
  -- Desligar a origem (ex.: a aula de origem foi excluida => FK on delete set null).
  if tg_op = 'UPDATE' and new.rescheduled_from is null and old.rescheduled_from is not null then
    return new;
  end if;

  if new.status = 'reposicao' and new.rescheduled_from is null
     and (tg_op = 'INSERT' or old.status is distinct from new.status) then
    raise exception 'reposicao exige a aula de origem (rescheduled_from)' using errcode = '23514';
  end if;

  if new.rescheduled_from is null then return new; end if;
  if new.status in ('cancelada_aluno', 'cancelada_professora') then return new; end if;

  -- So valida quando algo relevante mudou.
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

  -- Serializa por aluno para dois inserts simultaneos nao furarem o limite.
  perform pg_advisory_xact_lock(hashtextextended(new.student_id::text, 0));

  select s.max_makeups_per_month into v_max from public.settings s where s.id;
  v_max := coalesce(v_max, 2);

  -- Reposicoes do aluno no mes civil (SP) da data desta reposicao. Nao contam: reposicao
  -- cancelada pela professora, nem cancelada pelo aluno COM direito a nova reposicao.
  -- (Mesma regra de makeups_used_in_month.)
  select count(*)::int into v_used
  from public.lessons l
  where l.student_id = new.student_id
    and l.rescheduled_from is not null
    and l.id <> new.id
    and l.status <> 'cancelada_professora'
    and not (l.status = 'cancelada_aluno' and l.makeup_eligible is true)
    and date_trunc('month', l.starts_at at time zone v_tz)
        = date_trunc('month', new.starts_at at time zone v_tz);

  if v_used >= v_max then
    raise exception 'limite de % reposicoes no mes atingido para este aluno', v_max
      using errcode = '23514';
  end if;

  return new;
end $$;

drop trigger if exists lessons_makeup_rules on public.lessons;
create trigger lessons_makeup_rules
  before insert or update on public.lessons
  for each row execute function public.lessons_makeup_rules();

-- ------------------------------------------------------------------ RPCs
-- cancel_lesson: UMA assinatura com p_by_teacher opcional.
--   aluno (dono da aula): aula 'agendada'/'reposicao' futura => 'cancelada_aluno'.
--   staff: p_by_teacher = false => registra cancelamento pedido pelo aluno ('cancelada_aluno',
--          mesmas regras de antecedencia); p_by_teacher = true => 'cancelada_professora'.
-- Retorna a aula atualizada (makeup_eligible: true = com reposicao, false = sem, null = a decidir).
create or replace function public.cancel_lesson(
  p_lesson_id uuid, p_reason text default null, p_by_teacher boolean default false)
returns public.lessons language plpgsql security definer set search_path = '' as $$
declare
  v_uid   uuid := (select auth.uid());
  v_staff boolean;
  v_l     public.lessons;
begin
  if v_uid is null or not public.is_active_user() then
    raise exception 'acesso nao liberado' using errcode = '42501';
  end if;
  v_staff := public.is_staff();
  if p_by_teacher and not v_staff then
    raise exception 'somente a professora cancela pela professora' using errcode = '42501';
  end if;

  select * into v_l from public.lessons where id = p_lesson_id for update;
  if not found then
    raise exception 'aula nao encontrada' using errcode = '42501';
  end if;
  if not v_staff and v_l.student_id not in (select public.current_student_ids()) then
    raise exception 'aula nao encontrada' using errcode = '42501';
  end if;

  if v_l.status not in ('agendada', 'reposicao') then
    raise exception 'so aulas agendadas ou reposicoes podem ser canceladas' using errcode = '23514';
  end if;
  if v_l.starts_at <= now() then
    raise exception 'a aula ja comecou: nao pode ser cancelada' using errcode = '23514';
  end if;

  update public.lessons
  set status = case when p_by_teacher then 'cancelada_professora'::public.lesson_status
                    else 'cancelada_aluno'::public.lesson_status end,
      cancel_reason = nullif(btrim(coalesce(p_reason, '')), ''),
      canceled_by = v_uid
  where id = v_l.id
  returning * into v_l;

  return v_l;
end $$;

-- decide_makeup: so staff, so para cancelada_aluno com makeup_eligible NULL (faixa intermediaria).
create or replace function public.decide_makeup(p_lesson_id uuid, p_eligible boolean)
returns public.lessons language plpgsql security definer set search_path = '' as $$
declare v_l public.lessons;
begin
  if not public.is_staff() then
    raise exception 'somente a equipe decide reposicao' using errcode = '42501';
  end if;
  if p_eligible is null then
    raise exception 'informe true ou false';
  end if;

  select * into v_l from public.lessons where id = p_lesson_id for update;
  if not found then
    raise exception 'aula nao encontrada';
  end if;
  if v_l.status <> 'cancelada_aluno' or v_l.makeup_eligible is not null then
    raise exception 'so aulas canceladas pelo aluno na faixa intermediaria (a decidir) aceitam decisao'
      using errcode = '23514';
  end if;

  perform set_config('app.decide_makeup', 'on', true);
  update public.lessons
  set makeup_eligible = p_eligible, makeup_decided_by = (select auth.uid())
  where id = v_l.id
  returning * into v_l;
  perform set_config('app.decide_makeup', 'off', true);

  return v_l;
end $$;

-- schedule_makeup: so staff; cria a reposicao (as validacoes vem do trigger).
create or replace function public.schedule_makeup(
  p_original_lesson uuid, p_starts_at timestamptz, p_duration integer default null)
returns public.lessons language plpgsql security definer set search_path = '' as $$
declare
  v_o public.lessons;
  v_n public.lessons;
begin
  if not public.is_staff() then
    raise exception 'somente a equipe agenda reposicao' using errcode = '42501';
  end if;
  select * into v_o from public.lessons where id = p_original_lesson;
  if not found then
    raise exception 'aula de origem nao encontrada';
  end if;
  if p_starts_at is null or p_starts_at <= now() then
    raise exception 'a reposicao deve ser no futuro';
  end if;

  insert into public.lessons (student_id, starts_at, duration_minutes, status, rescheduled_from)
  values (v_o.student_id, p_starts_at, coalesce(p_duration, v_o.duration_minutes),
          'reposicao'::public.lesson_status, v_o.id)
  returning * into v_n;

  return v_n;
end $$;

-- Saldo para o front: reposicoes do aluno no mes civil (America/Sao_Paulo) de p_month.
-- Mesma regra de contagem do trigger lessons_makeup_rules.
create or replace function public.makeups_used_in_month(p_student uuid, p_month date)
returns integer language plpgsql stable security definer set search_path = '' as $$
declare v_n integer;
begin
  if not public.can_view_student(p_student) then
    raise exception 'acesso negado' using errcode = '42501';
  end if;
  select count(*)::int into v_n
  from public.lessons l
  where l.student_id = p_student
    and l.rescheduled_from is not null
    and l.status <> 'cancelada_professora'
    and not (l.status = 'cancelada_aluno' and l.makeup_eligible is true)
    and date_trunc('month', l.starts_at at time zone 'America/Sao_Paulo')
        = date_trunc('month', p_month::timestamp);
  return v_n;
end $$;

-- ---------------------------------------------------- privilegios de EXECUTE
revoke all on function
  public.lessons_cancellation_rules(), public.lessons_makeup_rules()
  from public, anon, authenticated;

revoke all on function
  public.cancel_lesson(uuid, text, boolean), public.decide_makeup(uuid, boolean),
  public.schedule_makeup(uuid, timestamptz, integer), public.makeups_used_in_month(uuid, date)
  from public, anon;

grant execute on function
  public.cancel_lesson(uuid, text, boolean), public.decide_makeup(uuid, boolean),
  public.schedule_makeup(uuid, timestamptz, integer), public.makeups_used_in_month(uuid, date)
  to authenticated;
