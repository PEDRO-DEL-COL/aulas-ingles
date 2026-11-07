-- 02 - Tabelas, indices e view. Idempotente (create ... if not exists).
-- Convencoes: ids uuid; valores em centavos; horarios em timestamptz (UTC);
-- e-mails sempre em minusculas (trigger normalize_email na migration 03).

-- ---------------------------------------------------------------- profiles
-- Toda pessoa com login. Criada pelo trigger handle_new_user (nunca pelo front).
-- Default active=false: sem liberacao explicita nao ha acesso.
create table if not exists public.profiles (
  id                uuid primary key references auth.users (id) on delete cascade,
  full_name         text not null default '' check (char_length(full_name) <= 200),
  email             text not null check (email = lower(email) and char_length(email) <= 320),
  phone             text check (phone is null or char_length(phone) <= 30),
  role              public.user_role not null default 'aluno',
  timezone          text not null default 'America/Sao_Paulo' check (char_length(timezone) between 1 and 64),
  active            boolean not null default false,
  terms_accepted_at timestamptz,
  terms_version     text check (terms_version is null or char_length(terms_version) <= 40),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create unique index if not exists profiles_email_key on public.profiles (email);
create index if not exists profiles_role_idx on public.profiles (role) where active;

-- ------------------------------------------------------------------- plans
-- billing_model + campos opcionais deixam o modelo de cobranca flexivel:
--   mensalidade: lessons_per_month; pacote: lessons_in_package; avulsa: nenhum dos dois.
create table if not exists public.plans (
  id                    uuid primary key default gen_random_uuid(),
  name                  text not null check (char_length(name) between 1 and 120),
  billing_model         public.billing_model not null default 'mensalidade',
  lessons_per_month     integer check (lessons_per_month is null or lessons_per_month > 0),
  lessons_in_package    integer check (lessons_in_package is null or lessons_in_package > 0),
  lesson_duration_minutes integer not null default 60 check (lesson_duration_minutes between 5 and 480),
  price_cents           integer not null check (price_cents >= 0),
  currency              text not null default 'BRL' check (currency ~ '^[A-Z]{3}$'),
  active                boolean not null default true,
  description           text check (description is null or char_length(description) <= 1000),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- ------------------------------------------------------------------ payers
-- DECISAO: pagador e uma entidade propria, independente de login. O pagador
-- pode ser o aluno, um pai que nunca entra no sistema, uma empresa, etc. Assim
-- "quem paga" (financeiro) fica separado de "quem acompanha" (student_guardians)
-- e de "quem tem conta" (profiles). profile_id e opcional, so para o caso do
-- pagador tambem ter login.
create table if not exists public.payers (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(name) between 1 and 200),
  email      text check (email is null or (email = lower(email) and char_length(email) <= 320)),
  phone      text check (phone is null or char_length(phone) <= 30),
  document   text check (document is null or char_length(document) <= 20), -- CPF/CNPJ opcional (dado pessoal: LGPD)
  profile_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists payers_profile_id_idx on public.payers (profile_id);

-- ---------------------------------------------------------------- students
create table if not exists public.students (
  id                    uuid primary key default gen_random_uuid(),
  full_name             text not null check (char_length(full_name) between 1 and 200),
  email                 text not null check (email = lower(email) and position('@' in email) > 1 and char_length(email) <= 320),
  profile_id            uuid unique references public.profiles (id) on delete set null,
  birth_date            date check (birth_date is null or birth_date <= current_date),
  -- Coluna simples (nao generated: idade depende de current_date, que nao e immutable).
  -- O app/professora marca; se is_minor, o aceite vem do responsavel (consent_by_guardian_at).
  is_minor              boolean not null default false,
  level                 text check (level is null or char_length(level) <= 40),
  goal                  text check (goal is null or char_length(goal) <= 1000),
  plan_id               uuid references public.plans (id) on delete set null,
  default_payer_id      uuid references public.payers (id) on delete set null,
  meet_link             text check (meet_link is null or char_length(meet_link) <= 500),
  status                public.student_status not null default 'ativo',
  phone                 text check (phone is null or char_length(phone) <= 30),
  notes_public          text check (notes_public is null or char_length(notes_public) <= 4000),
  consent_by_guardian_at timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create unique index if not exists students_email_key on public.students (email);
create index if not exists students_plan_id_idx on public.students (plan_id);
create index if not exists students_default_payer_id_idx on public.students (default_payer_id);
create index if not exists students_status_idx on public.students (status);

-- -------------------------------------------------------- student_guardians
-- N:N entre alunos e responsaveis. guardian_email permite liberar o responsavel
-- ANTES do primeiro login; guardian_profile_id e preenchido pelo trigger.
create table if not exists public.student_guardians (
  id                       uuid primary key default gen_random_uuid(),
  student_id               uuid not null references public.students (id) on delete cascade,
  guardian_profile_id      uuid references public.profiles (id) on delete set null,
  guardian_email           text not null check (guardian_email = lower(guardian_email) and position('@' in guardian_email) > 1 and char_length(guardian_email) <= 320),
  guardian_name            text check (guardian_name is null or char_length(guardian_name) <= 200),
  relationship             text check (relationship is null or char_length(relationship) <= 60),
  is_financial_responsible boolean not null default false,
  can_view_lessons         boolean not null default true,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  unique (student_id, guardian_email)
);
create index if not exists student_guardians_student_id_idx on public.student_guardians (student_id);
create index if not exists student_guardians_profile_idx on public.student_guardians (guardian_profile_id);
create index if not exists student_guardians_email_idx on public.student_guardians (guardian_email);

-- --------------------------------------------------------------- schedules
-- Horario fixo semanal. weekday: 0=domingo ... 6=sabado (igual a extract(dow)).
-- start_time e hora LOCAL no fuso `timezone` (o da professora ao cadastrar),
-- para a aula continuar no mesmo horario de parede em mudancas de horario de verao.
create table if not exists public.schedules (
  id               uuid primary key default gen_random_uuid(),
  student_id       uuid not null references public.students (id) on delete cascade,
  weekday          smallint not null check (weekday between 0 and 6),
  start_time       time not null,
  timezone         text not null default 'America/Sao_Paulo' check (char_length(timezone) between 1 and 64),
  duration_minutes integer not null default 60 check (duration_minutes between 5 and 480),
  starts_on        date not null default current_date,
  ends_on          date,
  active           boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  check (ends_on is null or ends_on >= starts_on)
);
create index if not exists schedules_student_id_idx on public.schedules (student_id);
create index if not exists schedules_active_weekday_idx on public.schedules (weekday) where active;

-- ----------------------------------------------------------------- lessons
create table if not exists public.lessons (
  id               uuid primary key default gen_random_uuid(),
  student_id       uuid not null references public.students (id) on delete cascade,
  schedule_id      uuid references public.schedules (id) on delete set null,
  starts_at        timestamptz not null,
  duration_minutes integer not null default 60 check (duration_minutes between 5 and 480),
  status           public.lesson_status not null default 'agendada',
  meet_link        text check (meet_link is null or char_length(meet_link) <= 500), -- null = usa students.meet_link
  rescheduled_from uuid references public.lessons (id) on delete set null,
  cancel_reason    text check (cancel_reason is null or char_length(cancel_reason) <= 500),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  -- torna generate_lessons() idempotente (null em schedule_id nao conflita)
  unique (schedule_id, starts_at)
);
create index if not exists lessons_student_starts_idx on public.lessons (student_id, starts_at desc);
create index if not exists lessons_starts_at_idx on public.lessons (starts_at);
create index if not exists lessons_status_idx on public.lessons (status);
create index if not exists lessons_rescheduled_from_idx on public.lessons (rescheduled_from);

-- ------------------------------------------------------------ lesson_notes
-- Registro VISIVEL ao aluno/responsavel. Anotacao privada fica em private_notes.
create table if not exists public.lesson_notes (
  id         uuid primary key default gen_random_uuid(),
  lesson_id  uuid not null unique references public.lessons (id) on delete cascade,
  content    text check (content is null or char_length(content) <= 8000),
  summary    text check (summary is null or char_length(summary) <= 4000),
  homework   text check (homework is null or char_length(homework) <= 4000),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists lesson_notes_created_by_idx on public.lesson_notes (created_by);

-- ----------------------------------------------------------- private_notes
-- NUNCA visivel a aluno/responsavel (so staff; ver RLS). Tabela separada de proposito.
create table if not exists public.private_notes (
  id         uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  lesson_id  uuid references public.lessons (id) on delete set null,
  body       text not null check (char_length(body) between 1 and 8000),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists private_notes_student_id_idx on public.private_notes (student_id);
create index if not exists private_notes_lesson_id_idx on public.private_notes (lesson_id);
create index if not exists private_notes_created_by_idx on public.private_notes (created_by);

-- --------------------------------------------------------------- materials
-- DECISAO (escopo): um material precisa de pelo menos UM alvo:
--   student_id (so aquele aluno), lesson_id (quem ve a aula) ou
--   is_public_to_students = true (material geral para todos os alunos/responsaveis).
-- student_id e lesson_id nulos E is_public false e rejeitado pelo check, evitando
-- material "orfao" ou, pior, publico por engano. Se student_id e lesson_id vierem
-- juntos, a visibilidade e a UNIAO (ve quem se enquadra em qualquer um).
create table if not exists public.materials (
  id                    uuid primary key default gen_random_uuid(),
  title                 text not null check (char_length(title) between 1 and 200),
  type                  public.material_type not null default 'link',
  url                   text not null check (char_length(url) between 1 and 2000),
  description           text check (description is null or char_length(description) <= 2000),
  lesson_id             uuid references public.lessons (id) on delete cascade,
  student_id            uuid references public.students (id) on delete cascade,
  is_public_to_students boolean not null default false,
  created_by            uuid references public.profiles (id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  check (student_id is not null or lesson_id is not null or is_public_to_students)
);
create index if not exists materials_student_id_idx on public.materials (student_id);
create index if not exists materials_lesson_id_idx on public.materials (lesson_id);
create index if not exists materials_created_by_idx on public.materials (created_by);
create index if not exists materials_public_idx on public.materials (is_public_to_students) where is_public_to_students;

-- ---------------------------------------------------------------- invoices
create table if not exists public.invoices (
  id                       uuid primary key default gen_random_uuid(),
  student_id               uuid not null references public.students (id) on delete restrict,
  payer_id                 uuid references public.payers (id) on delete set null,
  plan_id                  uuid references public.plans (id) on delete set null,
  billing_model            public.billing_model not null default 'mensalidade',
  reference_month          date check (reference_month is null or extract(day from reference_month) = 1),
  description              text check (description is null or char_length(description) <= 500),
  lessons_count            integer check (lessons_count is null or lessons_count > 0),
  amount_cents             integer not null check (amount_cents > 0),
  due_date                 date not null,
  status                   public.invoice_status not null default 'em_aberto',
  -- "Ja paguei": so avisa a professora; NAO muda status (confirmacao e manual).
  student_notified_paid_at timestamptz,
  paid_at                  timestamptz,
  confirmed_by             uuid references public.profiles (id) on delete set null,
  pix_txid                 text check (pix_txid is null or char_length(pix_txid) <= 35),
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);
-- on delete restrict em student_id: nao apagar historico financeiro por acidente
-- (para sair, use students.status = 'saiu').
create index if not exists invoices_student_id_idx on public.invoices (student_id);
create index if not exists invoices_payer_id_idx on public.invoices (payer_id);
create index if not exists invoices_plan_id_idx on public.invoices (plan_id);
create index if not exists invoices_confirmed_by_idx on public.invoices (confirmed_by);
create index if not exists invoices_status_due_idx on public.invoices (status, due_date);
-- uma mensalidade por aluno por mes (cobrancas canceladas nao contam)
create unique index if not exists invoices_monthly_unique
  on public.invoices (student_id, reference_month)
  where billing_model = 'mensalidade' and reference_month is not null and status <> 'cancelado';

-- 'atrasado' e derivado: em_aberto + vencida (data no fuso do Brasil) => atrasado.
-- security_invoker: a view respeita o RLS de quem consulta.
create or replace view public.invoices_with_status
with (security_invoker = true) as
select
  i.*,
  case
    when i.status = 'em_aberto'
         and i.due_date < (now() at time zone 'America/Sao_Paulo')::date
      then 'atrasado'::public.invoice_status
    else i.status
  end as effective_status
from public.invoices i;

-- ---------------------------------------------------------------- settings
-- Singleton: id boolean sempre true.
create table if not exists public.settings (
  id                       boolean primary key default true check (id),
  pix_key                  text check (pix_key is null or char_length(pix_key) <= 77),
  pix_key_type             text check (pix_key_type is null or pix_key_type in ('cpf','cnpj','email','telefone','aleatoria')),
  receiver_name            text check (receiver_name is null or char_length(receiver_name) <= 25),  -- limite do BR Code
  receiver_city            text check (receiver_city is null or char_length(receiver_city) <= 15), -- limite do BR Code
  cancellation_policy_text text check (cancellation_policy_text is null or char_length(cancellation_policy_text) <= 4000),
  cancellation_min_hours   integer not null default 24 check (cancellation_min_hours >= 0),
  whatsapp_number          text check (whatsapp_number is null or char_length(whatsapp_number) <= 20),
  business_name            text check (business_name is null or char_length(business_name) <= 120),
  terms_version            text check (terms_version is null or char_length(terms_version) <= 40),
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);
insert into public.settings (id) values (true) on conflict (id) do nothing;

-- ------------------------------------------------------------------- leads
-- Formulario da landing (Fase 2). INSERT publico via anon (RLS + grants por coluna).
create table if not exists public.leads (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(name) between 1 and 120),
  contact    text not null check (char_length(contact) between 3 and 160),
  message    text check (message is null or char_length(message) <= 1000),
  source     text check (source is null or char_length(source) <= 60),
  status     public.lead_status not null default 'novo',
  consent    boolean not null default false,
  notes      text check (notes is null or char_length(notes) <= 2000), -- da professora
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists leads_status_created_idx on public.leads (status, created_at desc);

-- junto com ferias/feriados: generate_lessons() pula estas datas.
create table if not exists public.blocked_dates (
  id         uuid primary key default gen_random_uuid(),
  starts_on  date not null,
  ends_on    date not null,
  reason     text check (reason is null or char_length(reason) <= 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_on >= starts_on)
);
create index if not exists blocked_dates_range_idx on public.blocked_dates (starts_on, ends_on);
