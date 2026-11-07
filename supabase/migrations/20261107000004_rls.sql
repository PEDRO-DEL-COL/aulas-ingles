-- 04 - Row Level Security e privilegios. Idempotente (drop policy if exists + create).
--
-- Modelo:
--   staff (professora/admin ativos): acesso total, exceto o que esta marcado abaixo.
--   aluno: so o que e dele (via can_view_student / can_view_student_finance).
--   responsavel: alunos vinculados; sem can_view_lessons => so ficha e financeiro.
--   anon: nada, exceto INSERT em leads (colunas limitadas).
-- DECISAO settings: leitura por qualquer usuario ativo (precisa da chave Pix para
-- gerar o codigo); escrita por STAFF (professora tambem edita Pix e politica de
-- cancelamento). Troca de papel/ativacao de usuarios continua exclusiva do admin
-- (trigger guard_profile_update).

alter table public.profiles          enable row level security;
alter table public.plans             enable row level security;
alter table public.payers            enable row level security;
alter table public.students          enable row level security;
alter table public.student_guardians enable row level security;
alter table public.schedules         enable row level security;
alter table public.lessons           enable row level security;
alter table public.lesson_notes      enable row level security;
alter table public.private_notes     enable row level security;
alter table public.materials         enable row level security;
alter table public.invoices          enable row level security;
alter table public.settings          enable row level security;
alter table public.leads             enable row level security;
alter table public.blocked_dates     enable row level security;

-- ------------------------------------------------ staff: um conjunto por comando
do $$
declare t text;
begin
  foreach t in array array[
    'plans','payers','students','student_guardians','schedules','lessons','lesson_notes',
    'private_notes','materials','invoices','leads','blocked_dates'
  ] loop
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

-- ---------------------------------------------------------------- profiles
-- Sem policy de INSERT/DELETE: perfis nascem pelo trigger e somem com auth.users.
drop policy if exists profiles_select_own on public.profiles;
drop policy if exists profiles_select_staff on public.profiles;
drop policy if exists profiles_update_own on public.profiles;
drop policy if exists profiles_update_staff on public.profiles;

-- Mesmo inativo o usuario le o proprio perfil (o app mostra "acesso nao liberado").
create policy profiles_select_own on public.profiles for select to authenticated
  using (id = (select auth.uid()));
create policy profiles_select_staff on public.profiles for select to authenticated
  using ((select public.is_staff()));
-- Alteracao de role/active/email e bloqueada para nao-admin pelo trigger guard_profile_update.
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy profiles_update_staff on public.profiles for update to authenticated
  using ((select public.is_staff())) with check ((select public.is_staff()));

-- ------------------------------------------------------------------- plans
drop policy if exists plans_select_active_user on public.plans;
create policy plans_select_active_user on public.plans for select to authenticated
  using ((select public.is_active_user()));

-- ----------------------------------------------------------------- payers
drop policy if exists payers_select_own on public.payers;
create policy payers_select_own on public.payers for select to authenticated
  using (profile_id = (select auth.uid()) and (select public.is_active_user()));

-- ---------------------------------------------------------------- students
drop policy if exists students_select_linked on public.students;
create policy students_select_linked on public.students for select to authenticated
  using ((select public.can_view_student_finance(id)));

-- -------------------------------------------------------- student_guardians
drop policy if exists student_guardians_select_own on public.student_guardians;
create policy student_guardians_select_own on public.student_guardians for select to authenticated
  using (guardian_profile_id = (select auth.uid()) and (select public.is_active_user()));

-- --------------------------------------------------------------- schedules
drop policy if exists schedules_select_linked on public.schedules;
create policy schedules_select_linked on public.schedules for select to authenticated
  using ((select public.can_view_student(student_id)));

-- ----------------------------------------------------------------- lessons
drop policy if exists lessons_select_linked on public.lessons;
create policy lessons_select_linked on public.lessons for select to authenticated
  using ((select public.can_view_student(student_id)));

-- ----------------------------------------------------------- lesson_notes
drop policy if exists lesson_notes_select_linked on public.lesson_notes;
create policy lesson_notes_select_linked on public.lesson_notes for select to authenticated
  using (exists (
    select 1 from public.lessons l
    where l.id = lesson_notes.lesson_id and (select public.can_view_student(l.student_id))
  ));

-- ------------------------------------------------------------ private_notes
-- Apenas as policies de staff (loop acima). Nenhuma policy para aluno/responsavel.

-- --------------------------------------------------------------- materials
drop policy if exists materials_select_linked on public.materials;
create policy materials_select_linked on public.materials for select to authenticated
  using (
    (student_id is not null and (select public.can_view_student(student_id)))
    or (lesson_id is not null and exists (
          select 1 from public.lessons l
          where l.id = materials.lesson_id and (select public.can_view_student(l.student_id))))
    or (is_public_to_students and (select public.can_view_public_materials()))
  );

-- ---------------------------------------------------------------- invoices
-- Aluno/responsavel so leem. O aviso "Ja paguei" e a RPC mark_invoice_as_paid_notice.
drop policy if exists invoices_select_linked on public.invoices;
create policy invoices_select_linked on public.invoices for select to authenticated
  using ((select public.can_view_student_finance(student_id)));

-- ---------------------------------------------------------------- settings
drop policy if exists settings_select_active_user on public.settings;
drop policy if exists settings_staff_insert on public.settings;
drop policy if exists settings_staff_update on public.settings;
create policy settings_select_active_user on public.settings for select to authenticated
  using ((select public.is_active_user()));
create policy settings_staff_insert on public.settings for insert to authenticated
  with check ((select public.is_staff()));
create policy settings_staff_update on public.settings for update to authenticated
  using ((select public.is_staff())) with check ((select public.is_staff()));
-- Sem DELETE: a linha singleton nao deve sumir.

-- ------------------------------------------------------------------- leads
-- Formulario publico: anon (e logado) so insere, com checks. Leitura/edicao so staff (loop).
drop policy if exists leads_public_insert on public.leads;
create policy leads_public_insert on public.leads for insert to anon, authenticated
  with check (
    status = 'novo'
    and consent is true
    and char_length(btrim(name)) between 1 and 120
    and char_length(btrim(contact)) between 3 and 160
    and (message is null or char_length(message) <= 1000)
    and (source is null or char_length(source) <= 60)
    and notes is null
  );

-- ------------------------------------------------------------ blocked_dates
drop policy if exists blocked_dates_select_active_user on public.blocked_dates;
create policy blocked_dates_select_active_user on public.blocked_dates for select to authenticated
  using ((select public.is_active_user()));

-- =========================================================== PRIVILEGIOS
-- O Supabase concede ALL em tabelas novas a anon/authenticated por padrao.
-- Revogamos tudo e concedemos so o necessario; o RLS faz o resto.
revoke all on all tables in schema public from anon, authenticated;
alter default privileges in schema public revoke all on tables from anon;

grant select, insert, update, delete on
  public.plans, public.payers, public.students, public.student_guardians,
  public.schedules, public.lessons, public.lesson_notes, public.private_notes,
  public.materials, public.invoices, public.leads, public.blocked_dates
  to authenticated;
grant select, update on public.profiles to authenticated;      -- sem insert/delete
grant select, insert, update on public.settings to authenticated; -- sem delete
grant select on public.invoices_with_status to authenticated;

-- anon: so INSERT em colunas especificas de leads (status/notes ficam com default).
-- Importante no front: .insert(...) SEM .select() (anon nao tem SELECT para o RETURNING).
grant insert (name, contact, message, source, consent) on public.leads to anon;
