-- 01 - Enums. Idempotente: ignora se o tipo ja existe.
-- Para ADICIONAR valor depois: alter type public.x add value if not exists 'novo';
-- (nao remova valores; crie um tipo novo numa migration futura).

do $$ begin
  create type public.user_role as enum ('aluno', 'responsavel', 'professora', 'admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.student_status as enum ('ativo', 'pausado', 'saiu');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.lesson_status as enum
    ('agendada', 'realizada', 'falta_aluno', 'cancelada_professora', 'reposicao');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.invoice_status as enum ('em_aberto', 'pago', 'atrasado', 'cancelado');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.material_type as enum ('drive', 'pdf', 'audio', 'video', 'link', 'outro');
exception when duplicate_object then null; end $$;

-- Modelo de cobranca EM ABERTO (CLAUDE.md secao 11): os tres modelos convivem.
do $$ begin
  create type public.billing_model as enum ('mensalidade', 'pacote', 'avulsa');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.lead_status as enum ('novo', 'contatado', 'convertido', 'descartado');
exception when duplicate_object then null; end $$;
