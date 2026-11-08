# Supabase: banco, RLS e testes

SQL versionado do projeto. Nunca altere tabelas só pelo painel; crie uma nova migration.

## Ordem das migrations (`migrations/`)

1. `20261107000001_enums.sql`: tipos enumerados.
2. `20261107000002_tables.sql`: tabelas, índices, checks, view `invoices_with_status`, linha singleton de `settings`.
3. `20261107000003_functions_triggers.sql`: `updated_at`, normalização de e-mail, helpers de acesso, trigger do primeiro login, proteção contra auto-promoção de papel, RPCs (`mark_invoice_as_paid_notice`, `accept_terms`, `generate_lessons`).
4. `20261107000004_rls.sql`: RLS em todas as tabelas, policies por comando e revogação de privilégios.
5. `20261108000001_lesson_status_cancelada_aluno.sql`: novo valor `cancelada_aluno` do enum `lesson_status` (sozinho de propósito: valor de enum só pode ser usado após o commit).
6. `20261108000002_access_model.sql`: perfis de login = aluno, professora, admin (responsável sai do login); `link_profile_access` liga só `students`; remove o trigger de responsável; `accept_terms` sem consentimento de responsável; "já paguei" só do próprio aluno; colunas de consentimento do menor; check de formato de e-mail dos alunos; defaults de fuso.
7. `20261108000003_rls_roles.sql`: papéis nas policies (escrita em `settings`/`plans`, alteração e exclusão de `profiles`, exclusão de `students` = só admin; professora edita o resto); remove policies de responsável.
8. `20261108000004_cancellation_policy.sql`: política de cancelamento e reposição (colunas, triggers e RPCs).
9. `20261109000001_admin_area.sql`: proteção de admins (trigger `profiles_guard_admin`: o admin não rebaixa/desativa a si mesmo pelo app; nunca fica sem admin ativo, de qualquer origem; o app não atribui `responsavel`), normalização de `settings` (vazio vira `NULL`, WhatsApp só dígitos) e checks `settings_whatsapp_format_chk`, `settings_pix_complete_chk`, `settings_policy_limits_chk`, `plans_billing_fields_chk`.
10. `20261110000001_invoices_finance.sql`: financeiro — desfazer pagamento limpa `paid_at`/`confirmed_by`; `atrasado` nunca é gravado (vira `em_aberto`; é derivado na view); check `invoices_billing_fields_chk` (mensalidade exige `reference_month`, pacote exige `lessons_count`); índice dos avisos de "já paguei".
11. `20261111000001_pix_txid_limit.sql`: `invoices.pix_txid` passa a aceitar só 1 a 25 alfanuméricos (limite do BR Code; antes 35). Valores fora do padrão viram `NULL` (o front gera o txid). Check `invoices_pix_txid_chk`.
12. `20261112000001_public_site_info.sql`: RPC pública `public_site_info()` (anon e authenticated): devolve só `whatsapp_number` de `settings` e os planos ativos (campos de exibição). anon continua sem SELECT em `settings`/`plans`.
13. `20261113000001_blocked_dates_cancel.sql`: inserir/alterar datas em `blocked_dates` cancela as aulas `agendada`/`reposicao` futuras do período (data local) como `cancelada_professora` (com reposição), com `cancel_reason` e `lessons.blocked_date_id`; reposição cuja origem foi cancelada pela professora não conta no limite mensal (`makeups_counted_in_month`, usada pelo trigger e por `makeups_used_in_month`).
14. `20261114000001_monthly_invoices_batch.sql`: RPC `generate_monthly_invoices(p_month, p_due_day, p_dry_run)` (só staff): prévia ou geração idempotente das mensalidades do mês para alunos ativos com plano de mensalidade ativo.
15. `20261115000001_plan_benefits_due_day.sql`: tabelas `benefits` (catálogo de vantagens, rótulo único sem diferenciar maiúsculas) e `plan_benefits` (vantagens de cada plano, com ordem); leitura por usuário ativo, escrita só admin; `public_site_info` passa a incluir `benefits` dos planos ativos; `settings.default_due_day` (1–31, só admin).

As migrations 1 a 8 já foram aplicadas no projeto remoto: não edite; mudanças vão em arquivos novos com timestamp maior (`supabase migration new nome`). Todas são idempotentes.

## Papéis

| Papel      | Pode                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| aluno      | Ler só o que é dele: ficha, aulas, registros de aula, materiais, cobranças (`invoices` e `invoices_with_status`, somente leitura), `settings` (chave Pix), `plans`, `blocked_dates`. "Já paguei" (`mark_invoice_as_paid_notice`) só nas próprias cobranças. Cancelar a própria aula só pela RPC `cancel_lesson`. Não vê `payers`, `student_guardians`, `private_notes`, `leads`. Atualiza o próprio nome/telefone/fuso. |
| professora | Lê e edita `students`, `student_guardians`, `payers`, `schedules`, `lessons`, `lesson_notes`, `private_notes`, `materials`, `invoices` (lançar, marcar pago), `blocked_dates`, `leads`. Lê `plans`, `settings` e `profiles`. Não escreve `settings`/`plans`, não altera perfis de outras pessoas, não exclui fichas (usa `students.status = 'saiu'`) nem contas.                                                        |
| admin      | Tudo da professora + escreve `settings` e `plans`, altera `role`/`active` de `profiles`, exclui `students` e `profiles` (não a si mesmo). Não rebaixa nem desativa a si mesmo e não pode deixar o sistema sem admin ativo (trigger `profiles_guard_admin`).                                                                                                                                                             |

**Responsável não é perfil de login nesta fase.** `student_guardians` e `payers` são dados da ficha, geridos pela professora; ninguém entra com eles. O valor `responsavel` do enum `user_role` continua existindo (não dá para remover valor de enum com segurança) mas não concede nada; quem só tem e-mail em `student_guardians` fica com o profile inativo. O consentimento do menor é registrado pela professora na ficha (`students.consent_by_guardian_at`, `guardian_consent_name`, `guardian_consent_notes`).

**Excluir conta:** o `DELETE` em `profiles` (admin) remove só o perfil; a conta em `auth.users` continua e a pessoa vê "acesso não liberado" se logar. Excluir de verdade é pelo painel do Supabase (Authentication > Users).

**Aulas só individuais:** `lessons.student_id` é obrigatório e único por aula.

**E-mail do aluno:** `students.email` deve ser o de uma conta Google (Gmail ou Conta Google criada com outro e-mail). O banco só valida o formato; a professora confere ao cadastrar. Fuso padrão: `America/Sao_Paulo` (`profiles.timezone`, `schedules.timezone`).

**Pix:** `settings.pix_key` e afins podem ser `null` (ainda não existe); o front trata `null`.

## Cancelamento e reposição (aplicado no banco)

Configuração em `settings` (só admin edita): `cancellation_min_hours` (padrão 24), `late_cancel_band_enabled` (padrão false), `late_cancel_band_min_hours` (padrão 12; deve ser menor que `cancellation_min_hours` quando a faixa está ligada), `max_makeups_per_month` (padrão 2).

Trigger `lessons_cancellation_rules` (o valor de `makeup_eligible` enviado pelo cliente é sempre ignorado):

- `cancelada_aluno`: antecedência (`starts_at - canceled_at`) >= `cancellation_min_hours` => `makeup_eligible = true` (exatamente igual ao mínimo conta como "com"). Faixa ligada e antecedência >= `late_cancel_band_min_hours` => `NULL` (a professora decide por `decide_makeup`). Senão `false`. Aula que já começou => erro. Só aula `agendada`/`reposicao` pode ser cancelada.
- `falta_aluno`: `makeup_eligible = false`, sempre.
- `cancelada_professora`: `makeup_eligible = true`, sempre.
- `canceled_at` é `now()` (staff pode informar um horário passado ao registrar retroativamente). Voltar a aula para agendada/realizada limpa os campos (bloqueado se já existir reposição dela).
- `makeup_eligible` só muda depois pela RPC `decide_makeup` (e só quando está `NULL`); qualquer outra alteração manual dá erro `42501`.

Trigger `lessons_makeup_rules` (reposição = `status 'reposicao'` com `rescheduled_from`):

- `reposicao` sem `rescheduled_from` => erro. A origem deve ser do mesmo aluno, ter `makeup_eligible = true` e ainda não ter reposição (índice único parcial `lessons_rescheduled_from_key`).
- Limite `max_makeups_per_month` por aluno no **mês civil da data da reposição** (`starts_at`, fuso `America/Sao_Paulo` fixo no código), não o mês da aula cancelada. Não contam para o limite: reposição cancelada pela professora e reposição cancelada pelo aluno com direito a nova reposição. Se uma reposição for cancelada com direito, ela própria vira origem da próxima (encadeamento).
- Não contam também (desde a migration 13) reposições cuja **aula de origem foi cancelada pela professora** (inclusive por férias/feriado): o cancelamento foi dela.
- Fora isso, o limite não tem exceção por staff; para liberar mais, o admin sobe `max_makeups_per_month`.

## Férias e feriados

Ao inserir um período em `blocked_dates` (ou mudar as datas), o trigger `blocked_dates_cancel_lessons` cancela as aulas futuras `agendada`/`reposicao` cuja data local (fuso do horário fixo; sem horário, `America/Sao_Paulo`) cai no período: `cancelada_professora`, `makeup_eligible = true`, `cancel_reason = 'Férias/feriado: <motivo>'`, `blocked_date_id`. Excluir o período não reativa as aulas. `generate_lessons` continua pulando as datas bloqueadas.

## Aplicar

```bash
supabase login
supabase link --project-ref <ref-do-projeto>
supabase db push
```

Local (precisa de Docker): `supabase start` e `supabase db reset`.

## Tipos TypeScript

Hoje `src/types/database.ts` é **escrito à mão** espelhando as migrations (gerar exige um Postgres com elas aplicadas: o remoto ou um local com Docker). Quem tiver acesso pode regenerar e conferir com `npm run typecheck`:

```bash
supabase gen types typescript --linked > src/types/database.ts   # projeto remoto
supabase gen types typescript --local  > src/types/database.ts   # após supabase start
```

Toda migration que muda colunas, enums ou RPCs deve atualizar esse arquivo no mesmo commit.

## Bootstrap do primeiro admin

Ninguém é admin no início e o front não consegue se promover. Depois do primeiro login com Google (o profile nasce com `active = false`), rode no SQL editor do painel:

```sql
update public.profiles set role = 'admin', active = true
where email = 'email-do-admin@exemplo.com';
```

Detalhes em `seed.sql`. Os demais papéis são trocados por um admin.

## Fluxo de liberação

A professora cadastra o aluno em `students` com o e-mail da conta Google dele. No primeiro login, `handle_new_user` liga o login à ficha (só se o e-mail estiver confirmado em `auth.users`) e ativa o acesso como `aluno`. Se o e-mail não estiver cadastrado, o profile fica `active = false` e as policies negam tudo (o app mostra "acesso não liberado"). Se a ficha for criada depois do login, o trigger de `students` faz a ligação na hora.

## Funções que o front chama (`supabase.rpc`)

| Função                                                                                                  | Quem                                                                                                                   | Retorno                                                                                                     |
| ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `cancel_lesson(p_lesson_id uuid, p_reason text default null, p_by_teacher boolean default false)`       | aluno dono da aula; staff (`p_by_teacher = true` => `cancelada_professora`; `false` => registra cancelamento do aluno) | linha de `lessons`; ver `makeup_eligible` (true = com reposição, false = sem, null = a decidir)             |
| `decide_makeup(p_lesson_id uuid, p_eligible boolean)`                                                   | staff                                                                                                                  | linha de `lessons`                                                                                          |
| `schedule_makeup(p_original_lesson uuid, p_starts_at timestamptz, p_duration integer default null)`     | staff                                                                                                                  | linha de `lessons` (nova reposição)                                                                         |
| `makeups_used_in_month(p_student uuid, p_month date)`                                                   | quem pode ver o aluno (ele mesmo ou staff)                                                                             | integer                                                                                                     |
| `mark_invoice_as_paid_notice(p_invoice_id uuid)`                                                        | só o próprio aluno                                                                                                     | void                                                                                                        |
| `accept_terms(p_version text)`                                                                          | usuário ativo                                                                                                          | void                                                                                                        |
| `public_site_info()` (GET `/rest/v1/rpc/public_site_info` com a anon key)                               | anon e authenticated                                                                                                   | jsonb `{ whatsapp_number, plans[] }`                                                                        |
| `generate_monthly_invoices(p_month date, p_due_day integer default 10, p_dry_run boolean default true)` | staff                                                                                                                  | uma linha por aluno ativo: `action` = `criar`/`criada`/`ja_existe`/`sem_plano`/`plano_inativo`/`nao_mensal` |
| `generate_lessons(p_from date, p_to date)`                                                              | staff                                                                                                                  | integer                                                                                                     |

## Pontos de atenção para o front

- `leads`: o formulário público deve usar `.insert(...)` **sem** `.select()` (anon só tem INSERT).
- Aluno não faz UPDATE em `lessons`; cancelamento só por `cancel_lesson`.
- Inadimplência: consulte `invoices_with_status` e use `effective_status`.
- Mensalidades: valores em centavos, `reference_month` no dia 1.
- Aulas recorrentes: `rpc('generate_lessons', { p_from, p_to })` (só staff, máx. 366 dias, pula `blocked_dates`). A Agenda oferece a semana exibida ou as próximas 4/8 semanas a partir de hoje.
- Tabelas novas: o Supabase concede privilégios amplos por padrão; sempre habilite RLS e revogue de `anon`/`authenticated` o que não for usado.
- Config: `config.toml` foi escrito à mão (a CLI não estava instalada). Se rodar `supabase init`, mescle. Para Google, defina `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID` e `SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET` e ponha `enabled = true`.

Testes: ver `tests/README.md`.
