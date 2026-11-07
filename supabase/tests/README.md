# Testes de RLS (pgTAP)

`rls.test.sql` cria alunos, responsáveis, professora, admin e um usuário não liberado em `auth.users`, e confere triggers de liberação e RLS simulando cada papel. Roda dentro de uma transação com `rollback` (não deixa dados).

## Rodar (Docker + Supabase CLI)

```bash
supabase start
supabase test db
```

Atenção: o arquivo foi escrito sem acesso a um Postgres; se algo falhar na primeira execução, ajuste e reporte.

## Validar manualmente no SQL editor (projeto remoto)

Não rode os testes em produção com dados reais (eles usam transação com rollback, mas prefira um projeto de teste). Para simular um usuário no SQL editor:

```sql
begin;
set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub', '<uuid do usuário em auth.users>', 'role', 'authenticated')::text, true);

select count(*) from public.invoices;      -- só as do aluno
select count(*) from public.private_notes; -- 0 para aluno/responsável
rollback;
```

Para anon use `set local role anon;` com `'{"role":"anon"}'`.
