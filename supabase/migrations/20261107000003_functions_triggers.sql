-- 03 - Funcoes, triggers e RPCs. Idempotente (create or replace / drop trigger if exists).
-- Todas as funcoes usam search_path = '' e nomes qualificados (anti-hijack).
-- Privilegios de EXECUTE sao ajustados no fim deste arquivo.

-- ------------------------------------------------------------ utilitarios
create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- E-mails sempre em minusculas e sem espacos (a professora pode digitar "Fulano@Gmail.com").
create or replace function public.normalize_email()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_table_name = 'student_guardians' then
    new.guardian_email := lower(btrim(new.guardian_email));
  else
    new.email := lower(btrim(new.email));
  end if;
  return new;
end $$;

-- ------------------------------------------------------ helpers de acesso
-- SECURITY DEFINER para ler profiles/students sem recursao de RLS.
-- Todos exigem profiles.active = true.
create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.active and p.role in ('professora', 'admin')
  );
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.active and p.role = 'admin'
  );
$$;

create or replace function public.is_active_user()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p where p.id = (select auth.uid()) and p.active
  );
$$;

-- Fichas em que o usuario logado e o proprio aluno.
create or replace function public.current_student_ids()
returns setof uuid language sql stable security definer set search_path = '' as $$
  select s.id
  from public.students s
  join public.profiles p on p.id = s.profile_id
  where s.profile_id = (select auth.uid()) and p.active;
$$;

-- Fichas em que o usuario logado e responsavel vinculado (qualquer vinculo).
create or replace function public.guardian_student_ids()
returns setof uuid language sql stable security definer set search_path = '' as $$
  select g.student_id
  from public.student_guardians g
  join public.profiles p on p.id = g.guardian_profile_id
  where g.guardian_profile_id = (select auth.uid()) and p.active;
$$;

-- Dados de aula/agenda/materiais: staff, o proprio aluno ou responsavel com can_view_lessons.
create or replace function public.can_view_student(p_student_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles me
    where me.id = (select auth.uid()) and me.active and (
      me.role in ('professora', 'admin')
      or exists (select 1 from public.students s
                 where s.id = p_student_id and s.profile_id = me.id)
      or exists (select 1 from public.student_guardians g
                 where g.student_id = p_student_id and g.guardian_profile_id = me.id
                   and g.can_view_lessons)
    )
  );
$$;

-- Ficha e financeiro: igual a acima, mas o responsavel ve mesmo sem can_view_lessons.
create or replace function public.can_view_student_finance(p_student_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles me
    where me.id = (select auth.uid()) and me.active and (
      me.role in ('professora', 'admin')
      or exists (select 1 from public.students s
                 where s.id = p_student_id and s.profile_id = me.id)
      or exists (select 1 from public.student_guardians g
                 where g.student_id = p_student_id and g.guardian_profile_id = me.id)
    )
  );
$$;

-- Materiais gerais (is_public_to_students): alunos e responsaveis com can_view_lessons.
create or replace function public.can_view_public_materials()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles me
    where me.id = (select auth.uid()) and me.active and (
      me.role in ('professora', 'admin')
      or exists (select 1 from public.students s where s.profile_id = me.id)
      or exists (select 1 from public.student_guardians g
                 where g.guardian_profile_id = me.id and g.can_view_lessons)
    )
  );
$$;

-- ------------------------------------------------ ligacao login <-> fichas
-- Liga um profile existente as fichas (students/student_guardians) com o mesmo
-- e-mail e, se algo foi ligado, ativa o profile com o papel certo.
-- Chamada por handle_new_user (primeiro login) e pelos triggers de students/
-- student_guardians (professora cadastra DEPOIS do primeiro login).
-- Nunca mexe em professora/admin. Nao reativa quem ja estava ligado e foi desativado
-- (so age quando liga algo NOVO).
create or replace function public.link_profile_access(p_profile_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_email text;
  v_n integer;
  v_linked boolean := false;
  v_is_student boolean;
begin
  -- So liga contas com e-mail CONFIRMADO (o Google ja entrega confirmado). Evita que um
  -- cadastro por e-mail/senha nao verificado "reivindique" a ficha de outra pessoa,
  -- caso esse provedor seja habilitado por engano no painel.
  select p.email into v_email
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.id = p_profile_id and u.email_confirmed_at is not null;
  if v_email is null then return; end if;

  update public.students s set profile_id = p_profile_id
  where s.profile_id is null and s.email = v_email
    and not exists (select 1 from public.students s2 where s2.profile_id = p_profile_id);
  get diagnostics v_n = row_count;
  v_linked := v_n > 0;

  update public.student_guardians g set guardian_profile_id = p_profile_id
  where g.guardian_profile_id is null and g.guardian_email = v_email;
  get diagnostics v_n = row_count;
  v_linked := v_linked or v_n > 0;

  if not v_linked then return; end if;

  v_is_student := exists (select 1 from public.students where profile_id = p_profile_id);

  update public.profiles
  set role = case when v_is_student then 'aluno'::public.user_role
                  else 'responsavel'::public.user_role end,
      active = true
  where id = p_profile_id and role in ('aluno', 'responsavel');
end $$;

-- Primeiro login (auth.users INSERT). Se o e-mail nao esta liberado em lugar
-- nenhum, o profile nasce inativo => RLS nega tudo e o app mostra "acesso nao liberado".
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name, email, role, active)
  values (
    new.id,
    coalesce(
      nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(btrim(new.raw_user_meta_data ->> 'name'), ''),
      split_part(coalesce(new.email, ''), '@', 1)
    ),
    coalesce(lower(btrim(new.email)), new.id::text || '@sem-email.invalid'),
    'aluno',
    false
  )
  on conflict (id) do nothing;

  perform public.link_profile_access(new.id);
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Professora cadastra o aluno DEPOIS do primeiro login do aluno.
create or replace function public.link_student_to_existing_profile()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_profile uuid;
begin
  if new.profile_id is null then
    select id into v_profile from public.profiles where email = new.email;
    if v_profile is not null then
      perform public.link_profile_access(v_profile);
    end if;
  end if;
  return null;
end $$;

drop trigger if exists students_link_profile on public.students;
create trigger students_link_profile
  after insert or update of email on public.students
  for each row execute function public.link_student_to_existing_profile();

create or replace function public.link_guardian_to_existing_profile()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_profile uuid;
begin
  if new.guardian_profile_id is null then
    select id into v_profile from public.profiles where email = new.guardian_email;
    if v_profile is not null then
      perform public.link_profile_access(v_profile);
    end if;
  end if;
  return null;
end $$;

drop trigger if exists student_guardians_link_profile on public.student_guardians;
create trigger student_guardians_link_profile
  after insert or update of guardian_email on public.student_guardians
  for each row execute function public.link_guardian_to_existing_profile();

-- ------------------------------------------- protecao de profiles (anti-escalada)
-- Quando a chamada vem do front (role authenticated/anon), so admin altera
-- role/active/email/id. Chamadas internas (funcoes SECURITY DEFINER, SQL editor,
-- service_role: current_user diferente) passam.
create or replace function public.guard_profile_update()
returns trigger language plpgsql set search_path = '' as $$
begin
  if current_user in ('authenticated', 'anon') then
    if new.id is distinct from old.id then
      raise exception 'id do perfil nao pode ser alterado' using errcode = '42501';
    end if;
    if (new.role, new.active, new.email) is distinct from (old.role, old.active, old.email)
       and not public.is_admin() then
      raise exception 'somente admin pode alterar papel, situacao ou e-mail' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists profiles_guard_update on public.profiles;
create trigger profiles_guard_update
  before update on public.profiles
  for each row execute function public.guard_profile_update();

-- --------------------------------------------------------- invoices: pagamento
-- Ao marcar como pago: preenche paid_at e confirmed_by se faltarem.
create or replace function public.invoices_before_write()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.status = 'pago' then
    if tg_op = 'INSERT' then
      new.paid_at := coalesce(new.paid_at, now());
      new.confirmed_by := coalesce(new.confirmed_by, (select auth.uid()));
    elsif old.status is distinct from 'pago' then
      new.paid_at := coalesce(new.paid_at, now());
      new.confirmed_by := coalesce(new.confirmed_by, (select auth.uid()));
    end if;
  end if;
  return new;
end $$;

drop trigger if exists invoices_before_write on public.invoices;
create trigger invoices_before_write
  before insert or update on public.invoices
  for each row execute function public.invoices_before_write();

-- --------------------------------------------- triggers de updated_at / e-mail
do $$
declare t text;
begin
  foreach t in array array[
    'profiles','plans','payers','students','student_guardians','schedules','lessons',
    'lesson_notes','private_notes','materials','invoices','settings','leads','blocked_dates'
  ] loop
    execute format('drop trigger if exists set_updated_at on public.%I', t);
    execute format(
      'create trigger set_updated_at before update on public.%I
         for each row execute function public.set_updated_at()', t);
  end loop;

  foreach t in array array['profiles','payers','students','student_guardians'] loop
    execute format('drop trigger if exists normalize_email on public.%I', t);
    execute format(
      'create trigger normalize_email before insert or update on public.%I
         for each row execute function public.normalize_email()', t);
  end loop;
end $$;

-- ------------------------------------------------------------------- RPCs
-- "Ja paguei": o aluno/responsavel so avisa; nada de update amplo em invoices.
create or replace function public.mark_invoice_as_paid_notice(p_invoice_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_student uuid;
begin
  select student_id into v_student from public.invoices
  where id = p_invoice_id and status in ('em_aberto', 'atrasado');

  if v_student is null or not public.can_view_student_finance(v_student) then
    raise exception 'cobranca nao encontrada ou ja encerrada' using errcode = '42501';
  end if;

  update public.invoices set student_notified_paid_at = now() where id = p_invoice_id;
end $$;

-- Aceite de termos/privacidade no primeiro acesso. Se quem aceita e responsavel,
-- registra tambem o consentimento nas fichas de menores vinculados.
create or replace function public.accept_terms(p_version text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid());
begin
  if v_uid is null or not public.is_active_user() then
    raise exception 'acesso nao liberado' using errcode = '42501';
  end if;
  if p_version is null or btrim(p_version) = '' or char_length(p_version) > 40 then
    raise exception 'versao dos termos invalida';
  end if;

  update public.profiles
  set terms_accepted_at = now(), terms_version = btrim(p_version)
  where id = v_uid;

  update public.students s set consent_by_guardian_at = now()
  where s.is_minor and s.consent_by_guardian_at is null
    and exists (select 1 from public.student_guardians g
                where g.student_id = s.id and g.guardian_profile_id = v_uid);
end $$;

-- --------------------------------------------- geracao de aulas recorrentes
-- Gera aulas dos schedules ativos (alunos 'ativo') entre p_from e p_to (max 366 dias),
-- pulando blocked_dates (comparadas pela data LOCAL do schedule). Idempotente via
-- unique(schedule_id, starts_at). SECURITY INVOKER de proposito: o RLS ja restringe o
-- INSERT em lessons a staff. Limitacao: se uma aula gerada for movida (starts_at muda)
-- e o intervalo for gerado de novo, o horario original volta a ser criado; para
-- remarcar prefira status/rescheduled_from (a original fica cancelada no mesmo horario).
-- Retorna quantas aulas foram criadas.
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

  with candidates as (
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
  ), ins as (
    insert into public.lessons (student_id, schedule_id, starts_at, duration_minutes, status)
    select student_id, schedule_id, starts_at, duration_minutes, 'agendada'::public.lesson_status
    from candidates
    on conflict (schedule_id, starts_at) do nothing
    returning 1
  )
  select count(*) into v_count from ins;

  return v_count;
end $$;

-- ---------------------------------------------------- privilegios de EXECUTE
-- Por padrao o Postgres/Supabase concede EXECUTE a PUBLIC/anon/authenticated.
-- Fechamos tudo e abrimos so o necessario.
revoke all on function
  public.set_updated_at(), public.normalize_email(), public.link_profile_access(uuid),
  public.handle_new_user(), public.link_student_to_existing_profile(),
  public.link_guardian_to_existing_profile(), public.guard_profile_update(),
  public.invoices_before_write()
  from public, anon, authenticated;

revoke all on function
  public.is_staff(), public.is_admin(), public.is_active_user(),
  public.current_student_ids(), public.guardian_student_ids(),
  public.can_view_student(uuid), public.can_view_student_finance(uuid),
  public.can_view_public_materials(),
  public.mark_invoice_as_paid_notice(uuid), public.accept_terms(text),
  public.generate_lessons(date, date)
  from public, anon;

grant execute on function
  public.is_staff(), public.is_admin(), public.is_active_user(),
  public.current_student_ids(), public.guardian_student_ids(),
  public.can_view_student(uuid), public.can_view_student_finance(uuid),
  public.can_view_public_materials(),
  public.mark_invoice_as_paid_notice(uuid), public.accept_terms(text),
  public.generate_lessons(date, date)
  to authenticated;
