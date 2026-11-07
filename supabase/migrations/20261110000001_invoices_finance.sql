-- 10 - Financeiro da professora/admin. Idempotente.
-- RLS ja vigente: staff (professora/admin) le e escreve invoices; aluno so le as proprias
-- e avisa "ja paguei" pela RPC mark_invoice_as_paid_notice.
--
-- Mudancas:
--   * invoices_before_write: ao sair de 'pago' (desfazer pagamento) limpa paid_at e
--     confirmed_by; 'atrasado' nunca e gravado (e derivado na view invoices_with_status:
--     em_aberto vencida), vira 'em_aberto'.
--   * constraint invoices_billing_fields_chk: mensalidade exige reference_month; pacote
--     exige lessons_count (NOT VALID: linhas antigas nao travam a migration).
--   * indice para a lista de avisos de "ja paguei".

create or replace function public.invoices_before_write()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.status = 'atrasado' then
    new.status := 'em_aberto';
  end if;

  if new.status = 'pago' then
    if tg_op = 'INSERT' or old.status is distinct from 'pago' then
      new.paid_at := coalesce(new.paid_at, now());
      new.confirmed_by := coalesce(new.confirmed_by, (select auth.uid()));
    end if;
  elsif tg_op = 'UPDATE' and old.status = 'pago' then
    new.paid_at := null;
    new.confirmed_by := null;
  elsif tg_op = 'INSERT' then
    new.paid_at := null;
    new.confirmed_by := null;
  end if;
  return new;
end $$;

revoke all on function public.invoices_before_write() from public, anon, authenticated;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'invoices_billing_fields_chk'
                 and conrelid = 'public.invoices'::regclass) then
    alter table public.invoices add constraint invoices_billing_fields_chk
      check (
        (billing_model <> 'mensalidade' or reference_month is not null)
        and (billing_model <> 'pacote' or lessons_count is not null)
      ) not valid;
  end if;
end $$;

create index if not exists invoices_paid_notice_idx
  on public.invoices (student_notified_paid_at)
  where student_notified_paid_at is not null and status = 'em_aberto';
