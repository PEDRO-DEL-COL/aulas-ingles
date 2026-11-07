-- 12 - Dados publicos da landing: WhatsApp da professora e planos ativos. Idempotente.
--
-- Exposicao minima para visitantes (anon): UMA funcao que devolve so estes campos.
-- anon continua sem SELECT em settings e plans (nenhum grant de tabela muda aqui);
-- chave Pix, recebedor, politica e demais colunas de settings nunca saem por aqui.
-- SECURITY DEFINER para ler settings/plans sem abrir a RLS dessas tabelas ao anon.
--
-- Front: GET {SUPABASE_URL}/rest/v1/rpc/public_site_info com os headers
--   apikey: <anon key>   e   Authorization: Bearer <anon key>
-- (funcao STABLE: o PostgREST aceita GET). Retorno (jsonb):
--   { "whatsapp_number": "5511999998888" | null,
--     "plans": [ { "id", "name", "billing_model", "lessons_per_month",
--                  "lessons_in_package", "lesson_duration_minutes", "price_cents",
--                  "currency", "description" }, ... ] }   -- so active = true, por preco

create or replace function public.public_site_info()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'whatsapp_number',
    (select s.whatsapp_number from public.settings s where s.id),
    'plans',
    coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', p.id,
               'name', p.name,
               'billing_model', p.billing_model,
               'lessons_per_month', p.lessons_per_month,
               'lessons_in_package', p.lessons_in_package,
               'lesson_duration_minutes', p.lesson_duration_minutes,
               'price_cents', p.price_cents,
               'currency', p.currency,
               'description', p.description)
             order by p.price_cents, p.name)
      from public.plans p
      where p.active
    ), '[]'::jsonb)
  );
$$;

comment on function public.public_site_info() is
  'Dados publicos da landing (anon): WhatsApp da professora e planos ativos. Nada alem disso.';

revoke all on function public.public_site_info() from public;
grant execute on function public.public_site_info() to anon, authenticated;
