# Testes (pgTAP)

- `rls.test.sql` (98 testes): liberação de acesso (login ligado à ficha pelo e-mail, só conta confirmada), RLS por papel e permissões de escrita. Cobre: aluno vê só o próprio (aulas, cobranças e a view `invoices_with_status`, materiais, notas), não vê `payers`/`student_guardians`/`private_notes`, não escreve em `settings`/`plans`; "responsável" (e-mail só em `student_guardians`) fica inativo e não lê nada; professora lança cobrança, marca como paga, cria ficha, mas não altera `settings`, `plans`, papéis, não exclui ficha nem perfil; admin faz tudo isso; anon só insere lead válido.
- `cancellation.test.sql` (48 testes): política de cancelamento e reposição. Cobre: cancelamento com 30h (com reposição), 10h (sem), exatamente 24h (com), faixa intermediária desligada/ligada (`NULL` + `decide_makeup`), falta (sem reposição, mesmo enviando `true`), cancelada pela professora (com), limite de 2 reposições no mês (3ª falha, mês seguinte passa), reposição de aula não elegível/de outro aluno/sem origem/segunda reposição da mesma origem falham, aluno cancela a própria aula por RPC mas não a de outro, aluno sem UPDATE direto em `lessons`, alteração manual de `makeup_eligible` rejeitada e mudança de `cancellation_min_hours` pelo admin refletida.
- `admin_finance.test.sql` (35 testes): área do admin e financeiro. Cobre: admin não rebaixa nem desativa a si mesmo; não fica sem nenhum admin ativo (nem pelo SQL editor, nem excluindo o login em `auth.users`); app não atribui o papel `responsavel`; professora não muda papéis nem `settings`; Pix todo vazio é aceito, chave sem nome/cidade é rejeitada; WhatsApp normalizado para dígitos e validado; limites da política; mensalidade sem aulas por mês é rejeitada em `plans`; professora lança mensalidade, a segunda do mesmo mês é rejeitada, mensalidade sem mês é rejeitada, marcar pago e desfazer (limpa `paid_at`/`confirmed_by`); `pix_txid` com mais de 25 caracteres é rejeitado.

Cada arquivo roda numa transação com `rollback` (não deixa dados). Se mudar a quantidade de testes, ajuste o `plan(n)` no topo do arquivo.

## Rodar (Docker + Supabase CLI)

```bash
supabase start
supabase test db
```

Atenção: os arquivos foram escritos sem acesso a um Postgres (nenhuma execução real até agora); se algo falhar na primeira execução, ajuste e reporte.

Observações para quem for ajustar os testes:

- Sem policy de UPDATE/DELETE para um papel, o Postgres NÃO dá erro: a operação afeta 0 linhas. Por isso os testes usam `lives_ok` e conferem depois, como `postgres`, que nada mudou. Já `INSERT` sem policy dá erro `42501`.
- Os testes de cancelamento usam datas relativas a `now()` (constante dentro da transação) e uma data-base guardada em `current_setting('test.mk')` para as reposições caírem sempre no mesmo mês civil.

## Validar manualmente no SQL editor (projeto remoto)

Não rode os testes em produção com dados reais (eles usam transação com rollback, mas prefira um projeto de teste). Para simular um usuário no SQL editor:

```sql
begin;
set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub', '<uuid do usuário em auth.users>', 'role', 'authenticated')::text, true);

select count(*) from public.invoices;      -- só as do aluno
select count(*) from public.private_notes; -- 0 para aluno
rollback;
```

Para anon use `set local role anon;` com `'{"role":"anon"}'`.
