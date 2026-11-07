-- 09 - Area do admin: protecao de usuarios/admins e validacoes de settings e plans.
-- Idempotente (create or replace / drop trigger if exists / constraints condicionais).
--
-- RLS ja vigente (migration 07): so admin escreve settings e plans e altera role/active de
-- profiles; professora so le. Esta migration acrescenta regras que valem NO BANCO:
--   * o admin nao pode rebaixar nem desativar a si mesmo (chamadas do app);
--   * nunca fica sem nenhum admin ativo (qualquer origem, inclusive SQL editor e a
--     exclusao do usuario em auth.users, que cascateia para profiles);
--   * o app nao atribui o papel 'responsavel' (nao da acesso a nada);
--   * settings: Pix pode ficar todo vazio, mas chave exige tipo, nome e cidade;
--     WhatsApp so digitos (10 a 15); limites da politica; strings vazias viram NULL;
--   * plans: mensalidade exige lessons_per_month; pacote exige lessons_in_package.

-- ------------------------------------------------------------ profiles: admins
-- SECURITY INVOKER de proposito: current_user identifica chamadas do app
-- ('authenticated'); o admin ja le todos os perfis pela RLS (profiles_select_staff).
create or replace function public.guard_admin_integrity()
returns trigger language plpgsql set search_path = '' as $$
declare
  v_from_app    boolean := current_user in ('authenticated', 'anon');
  v_was_admin   boolean := old.role = 'admin' and old.active;
  v_still_admin boolean := false;
begin
  if tg_op = 'UPDATE' then
    v_still_admin := new.role = 'admin' and new.active;
    if v_from_app and new.role = 'responsavel' and old.role is distinct from 'responsavel' then
      raise exception 'papel responsavel nao da acesso; use aluno, professora ou admin'
        using errcode = '22023';
    end if;
  end if;

  if v_was_admin and not v_still_admin then
    if v_from_app and old.id = (select auth.uid()) then
      raise exception 'voce nao pode remover o proprio acesso de admin' using errcode = '42501';
    end if;
    -- Serializa mudancas de admins (dois admins se rebaixando ao mesmo tempo).
    -- Em READ COMMITTED a consulta abaixo enxerga o que a outra transacao gravou.
    perform pg_advisory_xact_lock(hashtext('public.profiles:active_admins'));
    if not exists (
      select 1 from public.profiles p
      where p.role = 'admin' and p.active and p.id <> old.id
    ) then
      raise exception 'o sistema precisa de pelo menos um admin ativo' using errcode = '23514';
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end $$;

drop trigger if exists profiles_guard_admin on public.profiles;
create trigger profiles_guard_admin
  before update of role, active or delete on public.profiles
  for each row execute function public.guard_admin_integrity();

revoke all on function public.guard_admin_integrity() from public, anon, authenticated;

-- ------------------------------------------------------------------ settings
-- Normaliza strings vazias para NULL (Pix "vazio" nunca quebra o front) e o WhatsApp
-- para so digitos.
create or replace function public.settings_normalize()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.pix_key := nullif(btrim(new.pix_key), '');
  new.pix_key_type := nullif(btrim(new.pix_key_type), '');
  new.receiver_name := nullif(btrim(new.receiver_name), '');
  new.receiver_city := nullif(btrim(new.receiver_city), '');
  new.whatsapp_number := nullif(regexp_replace(coalesce(new.whatsapp_number, ''), '[^0-9]', '', 'g'), '');
  new.cancellation_policy_text := nullif(btrim(new.cancellation_policy_text), '');
  return new;
end $$;

drop trigger if exists settings_normalize on public.settings;
create trigger settings_normalize
  before insert or update on public.settings
  for each row execute function public.settings_normalize();

revoke all on function public.settings_normalize() from public, anon, authenticated;

-- Ajusta a linha existente antes das constraints (Pix ainda nao existe; WhatsApp invalido
-- vira NULL em vez de travar a migration).
update public.settings set
  pix_key = nullif(btrim(pix_key), ''),
  pix_key_type = nullif(btrim(pix_key_type), ''),
  receiver_name = nullif(btrim(receiver_name), ''),
  receiver_city = nullif(btrim(receiver_city), ''),
  whatsapp_number = case
    when regexp_replace(coalesce(whatsapp_number, ''), '[^0-9]', '', 'g') ~ '^[0-9]{10,15}$'
      then regexp_replace(whatsapp_number, '[^0-9]', '', 'g')
    else null end
where id;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'settings_whatsapp_format_chk'
                 and conrelid = 'public.settings'::regclass) then
    alter table public.settings add constraint settings_whatsapp_format_chk
      check (whatsapp_number is null or whatsapp_number ~ '^[0-9]{10,15}$');
  end if;
  -- Pix: tudo vazio e valido; com chave, exige tipo, nome e cidade (o BR Code precisa deles).
  -- NOT VALID: se a linha atual ja tiver chave incompleta, a migration nao falha, mas o
  -- proximo UPDATE da linha precisa completa-la.
  if not exists (select 1 from pg_constraint where conname = 'settings_pix_complete_chk'
                 and conrelid = 'public.settings'::regclass) then
    alter table public.settings add constraint settings_pix_complete_chk
      check (pix_key is null
             or (pix_key_type is not null and receiver_name is not null and receiver_city is not null))
      not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'settings_policy_limits_chk'
                 and conrelid = 'public.settings'::regclass) then
    alter table public.settings add constraint settings_policy_limits_chk
      check (cancellation_min_hours <= 720
             and late_cancel_band_min_hours <= 720
             and max_makeups_per_month <= 31)
      not valid;
  end if;
end $$;

comment on column public.settings.whatsapp_number is
  'WhatsApp da professora: so digitos com DDI e DDD (ex.: 5511999998888) ou NULL. Editavel so por admin.';

-- --------------------------------------------------------------------- plans
-- NOT VALID: planos antigos inconsistentes nao travam a migration; novos e editados sim.
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'plans_billing_fields_chk'
                 and conrelid = 'public.plans'::regclass) then
    alter table public.plans add constraint plans_billing_fields_chk
      check (
        (billing_model <> 'mensalidade' or lessons_per_month is not null)
        and (billing_model <> 'pacote' or lessons_in_package is not null)
      ) not valid;
  end if;
end $$;
