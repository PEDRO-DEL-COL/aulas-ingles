-- 17 - Interessados: protecao do formulario publico contra repeticao e enxurrada. Idempotente.
--
-- A insercao anonima em leads ja existe (migration 04: policy leads_public_insert e grant
-- de INSERT so nas colunas name, contact, message, source, consent). Aqui so acrescentamos,
-- no banco, limites que o front nao garante sozinho (o honeypot e do front):
--   * o mesmo contato (comparado so pelos digitos/letras) nao envia de novo em 10 minutos;
--   * no maximo 30 interessados novos por hora no total (freia robos).
-- Vale so para chamadas do app sem login/aluno (anon e authenticated nao-staff, pelo papel
-- do JWT em auth.role()); professora/admin e o SQL editor nao sao limitados.
-- SECURITY DEFINER: anon nao tem SELECT em leads, mas a contagem precisa ler a tabela.

create or replace function public.leads_rate_limit()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_key text := lower(regexp_replace(coalesce(new.contact, ''), '[^0-9A-Za-z@.]', '', 'g'));
begin
  -- So limita chamadas do app (PostgREST: papel anon/authenticated no JWT). SQL editor,
  -- service_role e funcoes internas passam; staff logado tambem.
  if coalesce((select auth.role()), '') not in ('anon', 'authenticated') or public.is_staff() then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtext('public.leads:rate'));

  if exists (
    select 1 from public.leads l
    where l.created_at > now() - interval '10 minutes'
      and lower(regexp_replace(l.contact, '[^0-9A-Za-z@.]', '', 'g')) = v_key
  ) then
    raise exception 'interessado ja enviado recentemente' using errcode = '23505';
  end if;

  if (select count(*) from public.leads l where l.created_at > now() - interval '1 hour') >= 30 then
    raise exception 'muitos envios no momento, tente mais tarde' using errcode = '54000';
  end if;

  return new;
end $$;

drop trigger if exists leads_rate_limit on public.leads;
create trigger leads_rate_limit
  before insert on public.leads
  for each row execute function public.leads_rate_limit();

revoke all on function public.leads_rate_limit() from public, anon, authenticated;
