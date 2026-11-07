# Supabase: banco, RLS e testes

SQL versionado do projeto. Nunca altere tabelas só pelo painel; crie uma nova migration.

## Ordem das migrations (`migrations/`)

1. `20261107000001_enums.sql`: tipos enumerados.
2. `20261107000002_tables.sql`: tabelas, índices, checks, view `invoices_with_status`, linha singleton de `settings`.
3. `20261107000003_functions_triggers.sql`: `updated_at`, normalização de e-mail, helpers de acesso (`is_staff`, `can_view_student`...), trigger do primeiro login (`handle_new_user`), ligação aluno/responsável por e-mail (também quando a ficha é criada depois do login), proteção contra auto-promoção de papel, RPCs (`mark_invoice_as_paid_notice`, `accept_terms`, `generate_lessons`).
4. `20261107000004_rls.sql`: RLS em todas as tabelas, policies por comando e revogação de privilégios.

Todas são idempotentes. Para mudanças futuras, crie arquivos novos com timestamp maior (`supabase migration new nome`).

## Aplicar

```bash
supabase login
supabase link --project-ref <ref-do-projeto>
supabase db push
```

Local (precisa de Docker): `supabase start` e `supabase db reset`.

## Tipos TypeScript

```bash
supabase gen types typescript --linked > src/types/database.ts
```

## Bootstrap do primeiro admin

Ninguém é admin no início e o front não consegue se promover. Depois do primeiro login com Google (o profile nasce com `active = false`), rode no SQL editor do painel:

```sql
update public.profiles set role = 'admin', active = true
where email = 'email-do-admin@exemplo.com';
```

Detalhes em `seed.sql`. Os demais papéis são trocados por um admin.

## Fluxo de liberação

A professora cadastra o aluno em `students` (e responsáveis em `student_guardians`) com o e-mail Google. No primeiro login, `handle_new_user` liga o login à ficha e ativa o acesso. Se o e-mail não estiver cadastrado, o profile fica `active = false` e as policies negam tudo (o app mostra "acesso não liberado"). Se a ficha for criada depois do login, os triggers de `students`/`student_guardians` fazem a ligação na hora.

## Pontos de atenção para o front

- `leads`: o formulário público deve usar `.insert(...)` **sem** `.select()` (anon só tem INSERT).
- "Já paguei": `supabase.rpc('mark_invoice_as_paid_notice', { p_invoice_id })`. Aceite de termos: `rpc('accept_terms', { p_version })`.
- Inadimplência: consulte `invoices_with_status` e use `effective_status`.
- Mensalidades: valores em centavos, `reference_month` no dia 1.
- Aulas recorrentes: `rpc('generate_lessons', { p_from, p_to })` (só staff, máx. 366 dias, pula `blocked_dates`).
- Tabelas novas: o Supabase concede privilégios amplos por padrão; sempre habilite RLS e revogue de `anon`/`authenticated` o que não for usado.
- Config: `config.toml` foi escrito à mão (a CLI não estava instalada). Se rodar `supabase init`, mescle. Para Google, defina `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID` e `SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET` e ponha `enabled = true`.

Testes de RLS: ver `tests/README.md`.
