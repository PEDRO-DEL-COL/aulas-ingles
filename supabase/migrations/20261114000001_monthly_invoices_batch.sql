-- 14 - Mensalidades em lote. Idempotente.
--
-- generate_monthly_invoices(p_month, p_due_day, p_dry_run): uma linha por aluno 'ativo',
-- dizendo o que acontece com a mensalidade do mes de p_month:
--   'criar'        (previa) / 'criada' (executado): plano ativo de mensalidade, sem cobranca
--   'ja_existe'    ja ha mensalidade nao cancelada desse mes (qualquer origem)
--   'sem_plano'    aluno sem plano
--   'plano_inativo'
--   'nao_mensal'   plano de pacote ou avulsa (nao geram em lote)
-- Valor = price_cents do plano; pagador = students.default_payer_id; vencimento = dia
-- p_due_day do mes (limitado ao ultimo dia do mes). Status 'em_aberto'.
-- Idempotente: rodar de novo nao duplica (indice invoices_monthly_unique + on conflict).
-- So staff (professora/admin). SECURITY INVOKER: a RLS de invoices/students/plans vale.

create or replace function public.generate_monthly_invoices(
  p_month date, p_due_day integer default 10, p_dry_run boolean default true)
returns table (
  student_id     uuid,
  student_name   text,
  plan_id        uuid,
  plan_name      text,
  amount_cents   integer,
  reference_month date,
  due_date       date,
  action         text,
  invoice_id     uuid
)
language plpgsql security invoker set search_path = '' as $$
#variable_conflict use_column
declare
  v_ref  date;
  v_due  date;
  r      record;
  v_id   uuid;
begin
  if not public.is_staff() then
    raise exception 'somente a equipe gera mensalidades' using errcode = '42501';
  end if;
  if p_month is null then
    raise exception 'informe o mes de referencia' using errcode = '22023';
  end if;
  if p_due_day is null or p_due_day < 1 or p_due_day > 31 then
    raise exception 'dia de vencimento invalido (1 a 31)' using errcode = '22023';
  end if;

  v_ref := date_trunc('month', p_month)::date;
  v_due := v_ref + (least(p_due_day,
                          extract(day from (v_ref + interval '1 month' - interval '1 day'))::int) - 1);

  if not p_dry_run then
    -- Duas execucoes simultaneas do mesmo mes ficam em fila.
    perform pg_advisory_xact_lock(hashtext('generate_monthly_invoices:' || v_ref::text));
  end if;

  for r in
    select s.id as sid, s.full_name, s.default_payer_id,
           p.id as pid, p.name as pname, p.active as pactive, p.billing_model as pmodel,
           p.price_cents
    from public.students s
    left join public.plans p on p.id = s.plan_id
    where s.status = 'ativo'
    order by s.full_name
  loop
    student_id := r.sid;
    student_name := r.full_name;
    plan_id := r.pid;
    plan_name := r.pname;
    amount_cents := r.price_cents;
    reference_month := v_ref;
    due_date := v_due;
    invoice_id := null;

    select i.id into v_id
    from public.invoices i
    where i.student_id = r.sid and i.billing_model = 'mensalidade'
      and i.reference_month = v_ref and i.status <> 'cancelado'
    limit 1;

    if v_id is not null then
      action := 'ja_existe';
      invoice_id := v_id;
    elsif r.pid is null then
      action := 'sem_plano';
    elsif not r.pactive then
      action := 'plano_inativo';
    elsif r.pmodel <> 'mensalidade' then
      action := 'nao_mensal';
    elsif r.price_cents is null or r.price_cents <= 0 then
      action := 'sem_plano';
    elsif p_dry_run then
      action := 'criar';
    else
      insert into public.invoices
        (student_id, payer_id, plan_id, billing_model, reference_month, description,
         amount_cents, due_date, status)
      values
        (r.sid, r.default_payer_id, r.pid, 'mensalidade', v_ref,
         left('Mensalidade - ' || r.pname, 500), r.price_cents, v_due, 'em_aberto')
      on conflict (student_id, reference_month)
        where billing_model = 'mensalidade' and reference_month is not null and status <> 'cancelado'
        do nothing
      returning id into v_id;

      if v_id is null then
        action := 'ja_existe';
      else
        action := 'criada';
        invoice_id := v_id;
      end if;
    end if;

    v_id := null;
    return next;
  end loop;
end $$;

revoke all on function public.generate_monthly_invoices(date, integer, boolean) from public, anon;
grant execute on function public.generate_monthly_invoices(date, integer, boolean) to authenticated;
