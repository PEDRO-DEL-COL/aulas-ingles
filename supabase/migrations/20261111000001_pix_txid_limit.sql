-- 11 - pix_txid: o BR Code (campo 62-05) aceita no maximo 25 caracteres alfanumericos.
-- A migration 02 permitia 35 (limite do Pix com QR dinamico/API, que nao usamos).
-- Idempotente.
--
-- Valores existentes fora do padrao viram NULL: o front ja gera um txid valido a partir do
-- aluno e do mes quando a coluna e NULL (src/pages/aluno/PagarPix.tsx).

update public.invoices
set pix_txid = null
where pix_txid is not null and pix_txid !~ '^[A-Za-z0-9]{1,25}$';

-- Remove a check antiga (nome gerado pelo Postgres para a check de coluna da migration 02).
do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.invoices'::regclass and contype = 'c'
      and conname <> 'invoices_pix_txid_chk'
      and pg_get_constraintdef(oid) like '%pix_txid%'
  loop
    execute format('alter table public.invoices drop constraint %I', c.conname);
  end loop;

  if not exists (select 1 from pg_constraint where conname = 'invoices_pix_txid_chk'
                 and conrelid = 'public.invoices'::regclass) then
    alter table public.invoices add constraint invoices_pix_txid_chk
      check (pix_txid is null or pix_txid ~ '^[A-Za-z0-9]{1,25}$');
  end if;
end $$;

comment on column public.invoices.pix_txid is
  'Identificador do Pix (BR Code, campo 05): 1 a 25 letras/numeros, ou NULL (o front gera um a partir do aluno e do mes).';
