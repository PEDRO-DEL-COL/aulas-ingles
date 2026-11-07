-- 06 - Modelo de acesso: perfis de login = aluno, professora, admin.
-- O "responsavel" deixa de ser perfil de login nesta fase. As tabelas student_guardians e
-- payers continuam como DADOS da ficha (pagador / responsavel de menor), SEM acesso por
-- login. O valor 'responsavel' do enum user_role continua existindo (nao da para remover
-- valor de enum com seguranca) mas NAO concede nada.
-- Idempotente. Nao altera as migrations 01..04 (ja publicadas na v0.3.0).

-- ------------------------------------------------------------ students (ficha)
alter table public.students
  add column if not exists guardian_consent_name  text,
  add column if not exists guardian_consent_notes text;

do $$ begin
  if not exists (select 1 from pg_constraint
                 where conname = 'students_guardian_consent_name_len'
                   and conrelid = 'public.students'::regclass) then
    alter table public.students
      add constraint students_guardian_consent_name_len
      check (guardian_consent_name is null or char_length(guardian_consent_name) <= 200);
  end if;
  if not exists (select 1 from pg_constraint
                 where conname = 'students_guardian_consent_notes_len'
                   and conrelid = 'public.students'::regclass) then
    alter table public.students
      add constraint students_guardian_consent_notes_len
      check (guardian_consent_notes is null or char_length(guardian_consent_notes) <= 2000);
  end if;
  -- Formato simples de e-mail (a normalizacao para minusculas e feita antes pelo trigger
  -- normalize_email). NOT VALID: nao reprova linhas antigas, mas vale para todo
  -- INSERT/UPDATE novo.
  if not exists (select 1 from pg_constraint
                 where conname = 'students_email_format_chk'
                   and conrelid = 'public.students'::regclass) then
    alter table public.students
      add constraint students_email_format_chk
      check (email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$') not valid;
  end if;
end $$;

comment on column public.students.email is
  'E-mail de uma CONTA GOOGLE do aluno (Gmail, ou Conta Google criada com outro e-mail). O banco nao consegue verificar isso: a professora confere ao cadastrar. E por ele que o login e ligado a ficha.';
comment on column public.students.consent_by_guardian_at is
  'Consentimento do responsavel (aluno menor), registrado PELA PROFESSORA na ficha. Responsavel nao tem login.';
comment on column public.students.guardian_consent_name is
  'Nome de quem consentiu pelo menor (registrado pela professora).';
comment on column public.students.guardian_consent_notes is
  'Observacoes sobre o consentimento do menor (como foi dado, data, etc.).';

-- ------------------------------------------------------- fuso padrao (America/Sao_Paulo)
alter table public.profiles  alter column timezone set default 'America/Sao_Paulo';
alter table public.schedules alter column timezone set default 'America/Sao_Paulo';

-- ------------------------------------------------ settings: Pix pode ser nulo (ainda nao existe)
-- pix_key, pix_key_type, receiver_name e receiver_city ja sao nullable (migration 02).
insert into public.settings (id) values (true) on conflict (id) do nothing;

-- ---------------------------------------------------- comentarios (documentacao)
comment on type public.user_role is
  'Perfis de login: aluno, professora, admin. O valor responsavel e LEGADO: nao concede acesso a nada (responsavel nao tem login nesta fase).';
comment on table public.student_guardians is
  'Responsaveis de alunos menores: DADO da ficha, gerido pela professora. Nao ha login nem acesso por responsavel (guardian_profile_id nao e mais preenchido).';
comment on table public.payers is
  'Pagadores: DADO da ficha, visivel so para staff. O aluno nao ve esta tabela.';
comment on column public.lessons.student_id is
  'So aulas individuais: toda aula pertence a exatamente um aluno (obrigatorio).';

-- --------------------------------------------------------- helpers de acesso
-- Mesmas assinaturas e tipos de retorno da migration 03; sem caminho por responsavel.
create or replace function public.guardian_student_ids()
returns setof uuid language sql stable security definer set search_path = '' as $$
  select null::uuid where false;  -- legado: responsavel nao tem acesso
$$;

create or replace function public.can_view_student(p_student_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles me
    where me.id = (select auth.uid()) and me.active and (
      me.role in ('professora', 'admin')
      or exists (select 1 from public.students s
                 where s.id = p_student_id and s.profile_id = me.id)
    )
  );
$$;

create or replace function public.can_view_student_finance(p_student_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles me
    where me.id = (select auth.uid()) and me.active and (
      me.role in ('professora', 'admin')
      or exists (select 1 from public.students s
                 where s.id = p_student_id and s.profile_id = me.id)
    )
  );
$$;

create or replace function public.can_view_public_materials()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles me
    where me.id = (select auth.uid()) and me.active and (
      me.role in ('professora', 'admin')
      or exists (select 1 from public.students s where s.profile_id = me.id)
    )
  );
$$;

-- ------------------------------------------------ ligacao login <-> ficha
-- Agora liga SOMENTE students. Continua exigindo e-mail confirmado em auth.users e nao
-- reativa quem ja estava ligado (so age quando liga algo NOVO). Nunca mexe em
-- professora/admin.
create or replace function public.link_profile_access(p_profile_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_email text;
  v_n integer;
begin
  select p.email into v_email
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.id = p_profile_id and u.email_confirmed_at is not null;
  if v_email is null then return; end if;

  update public.students s set profile_id = p_profile_id
  where s.profile_id is null and s.email = v_email
    and not exists (select 1 from public.students s2 where s2.profile_id = p_profile_id);
  get diagnostics v_n = row_count;
  if v_n = 0 then return; end if;

  update public.profiles
  set role = 'aluno'::public.user_role, active = true
  where id = p_profile_id and role in ('aluno', 'responsavel');
end $$;

-- Responsavel nao liga mais conta: remove o trigger e a funcao dele.
drop trigger if exists student_guardians_link_profile on public.student_guardians;
drop function if exists public.link_guardian_to_existing_profile();

-- Contas de responsavel que existiam (role 'responsavel' sem ficha de aluno) ficam inativas.
update public.profiles p set active = false
where p.role = 'responsavel'
  and not exists (select 1 from public.students s where s.profile_id = p.id);

-- ------------------------------------------------------------------ RPCs
-- "Ja paguei": SOMENTE o proprio aluno (nem staff, nem responsavel).
create or replace function public.mark_invoice_as_paid_notice(p_invoice_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_student uuid;
begin
  select student_id into v_student from public.invoices
  where id = p_invoice_id and status in ('em_aberto', 'atrasado');

  if v_student is null or v_student not in (select public.current_student_ids()) then
    raise exception 'cobranca nao encontrada ou ja encerrada' using errcode = '42501';
  end if;

  update public.invoices set student_notified_paid_at = now() where id = p_invoice_id;
end $$;

-- Aceite de termos/privacidade. O consentimento do menor NAO e mais registrado aqui:
-- a professora preenche students.consent_by_guardian_at na ficha.
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
end $$;
