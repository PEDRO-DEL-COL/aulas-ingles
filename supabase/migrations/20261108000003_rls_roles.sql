-- 07 - Papeis e RLS: professora edita o que e dela; SOMENTE admin escreve settings e plans,
-- altera role/active de profiles, exclui contas (profiles) e exclui fichas (students).
-- Aluno le so o que e dele. Idempotente (drop policy if exists + create).
--
-- Excluir uma conta de verdade (auth.users) so pelo painel do Supabase (Authentication >
-- Users). O DELETE em profiles feito por admin remove apenas o perfil: a pessoa continua
-- podendo logar, mas sem perfil o app mostra "acesso nao liberado".
-- Professora nao exclui ficha: usa students.status = 'saiu'.

-- ------------------------------------------------ responsavel: fora das policies
drop policy if exists student_guardians_select_own on public.student_guardians;
drop policy if exists payers_select_own on public.payers;  -- aluno nao ve pagadores; so staff

-- ------------------------------------------------------------------- plans
-- Leitura: qualquer usuario ativo (plans_select_active_user, migration 04). Escrita: admin.
drop policy if exists plans_staff_select on public.plans;  -- redundante com plans_select_active_user
drop policy if exists plans_staff_insert on public.plans;
drop policy if exists plans_staff_update on public.plans;
drop policy if exists plans_staff_delete on public.plans;
drop policy if exists plans_admin_insert on public.plans;
drop policy if exists plans_admin_update on public.plans;
drop policy if exists plans_admin_delete on public.plans;
create policy plans_admin_insert on public.plans for insert to authenticated
  with check ((select public.is_admin()));
create policy plans_admin_update on public.plans for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy plans_admin_delete on public.plans for delete to authenticated
  using ((select public.is_admin()));

-- ---------------------------------------------------------------- settings
-- Leitura: usuario ativo (aluno precisa da chave Pix). Escrita: admin.
drop policy if exists settings_staff_insert on public.settings;
drop policy if exists settings_staff_update on public.settings;
drop policy if exists settings_admin_insert on public.settings;
drop policy if exists settings_admin_update on public.settings;
create policy settings_admin_insert on public.settings for insert to authenticated
  with check ((select public.is_admin()));
create policy settings_admin_update on public.settings for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
-- Sem DELETE: a linha singleton nao deve sumir.

-- ---------------------------------------------------------------- students
-- Professora: select/insert/update (policies students_staff_* da migration 04).
-- Delete: somente admin.
drop policy if exists students_staff_delete on public.students;
drop policy if exists students_admin_delete on public.students;
create policy students_admin_delete on public.students for delete to authenticated
  using ((select public.is_admin()));

-- ---------------------------------------------------------------- profiles
-- Professora le todos (profiles_select_staff) mas NAO altera perfis de outras pessoas.
-- Cada usuario atualiza o proprio (profiles_update_own; o trigger guard_profile_update
-- bloqueia role/active/email para nao-admin). Admin atualiza e exclui qualquer perfil.
drop policy if exists profiles_update_staff on public.profiles;
drop policy if exists profiles_update_admin on public.profiles;
drop policy if exists profiles_delete_admin on public.profiles;
create policy profiles_update_admin on public.profiles for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy profiles_delete_admin on public.profiles for delete to authenticated
  using ((select public.is_admin()) and id <> (select auth.uid()));  -- admin nao exclui a si mesmo

-- ---------------------------------------------------------------- privilegios
grant delete on public.profiles to authenticated;
