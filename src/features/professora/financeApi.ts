/** Dados do financeiro da professora. A segurança vem do RLS (staff). */
import type { Invoice, InvoiceStatus } from '@/features/aluno/invoices'
import { friendlyError } from '@/features/shared/errors'
import { isValidTxid } from '@/lib/pix'
import { getSupabase } from '@/lib/supabase'
import type { TablesUpdate } from '@/types/database'

import type {
  InvoiceAdmin,
  InvoiceInsert,
  InvoicePayer,
  InvoiceStudent,
  PlanLite,
} from './finance'

function fail(error: unknown, fallback: string): never {
  throw new Error(friendlyError(error, fallback))
}

const TXID_ERROR = 'Identificador do Pix inválido: use até 25 letras ou números.'

/** O banco também valida (invoices_pix_txid_chk); aqui a mensagem chega antes. */
function assertTxid(txid: string | null | undefined): void {
  if (txid != null && !isValidTxid(txid)) throw new Error(TXID_ERROR)
}

const STUDENT_COLS = 'id, full_name, phone, plan_id, default_payer_id'

/** Cobranças (view com status efetivo) com vencimento em [from, to] (AAAA-MM-DD). */
export async function listInvoicesAdmin(
  range: { from?: string; to?: string } = {},
): Promise<InvoiceAdmin[]> {
  let q = getSupabase().from('invoices_with_status').select('*')
  if (range.from) q = q.gte('due_date', range.from)
  if (range.to) q = q.lte('due_date', range.to)
  const { data, error } = await q.order('due_date', { ascending: false })
  if (error) fail(error, 'Não foi possível carregar as cobranças.')

  const invoices: Invoice[] = []
  for (const row of data) {
    // Colunas de view vêm anuláveis nos tipos; as obrigatórias nunca são nulas na prática.
    if (!row.id || !row.student_id || row.amount_cents == null || !row.due_date) continue
    const status = row.status ?? 'em_aberto'
    invoices.push({
      id: row.id,
      student_id: row.student_id,
      payer_id: row.payer_id,
      plan_id: row.plan_id,
      billing_model: row.billing_model ?? 'mensalidade',
      reference_month: row.reference_month,
      description: row.description,
      lessons_count: row.lessons_count,
      amount_cents: row.amount_cents,
      due_date: row.due_date,
      status,
      student_notified_paid_at: row.student_notified_paid_at,
      paid_at: row.paid_at,
      confirmed_by: row.confirmed_by,
      pix_txid: row.pix_txid,
      created_at: row.created_at ?? '',
      updated_at: row.updated_at ?? '',
      effective_status: row.effective_status ?? status,
    })
  }

  const studentIds = [...new Set(invoices.map((i) => i.student_id))]
  const payerIds = [
    ...new Set(invoices.map((i) => i.payer_id).filter((x): x is string => !!x)),
  ]
  const students = new Map<string, InvoiceStudent>()
  const payers = new Map<string, InvoicePayer>()
  if (studentIds.length > 0) {
    const res = await getSupabase()
      .from('students')
      .select(STUDENT_COLS)
      .in('id', studentIds)
    if (res.error) fail(res.error, 'Não foi possível carregar os alunos.')
    for (const s of res.data) students.set(s.id, s)
  }
  if (payerIds.length > 0) {
    const res = await getSupabase()
      .from('payers')
      .select('id, name, phone')
      .in('id', payerIds)
    if (res.error) fail(res.error, 'Não foi possível carregar os pagadores.')
    for (const p of res.data) payers.set(p.id, p)
  }
  return invoices.map((i) => ({
    ...i,
    student: students.get(i.student_id) ?? null,
    payer: i.payer_id ? (payers.get(i.payer_id) ?? null) : null,
  }))
}

export async function createInvoice(insert: InvoiceInsert): Promise<void> {
  assertTxid(insert.pix_txid)
  const { error } = await getSupabase().from('invoices').insert(insert)
  if (error) fail(error, 'Não foi possível criar a cobrança.')
}

/** Só status salvos: 'atrasado' é derivado e nunca é gravado. */
export async function updateInvoiceStatus(
  id: string,
  status: Exclude<InvoiceStatus, 'atrasado'>,
): Promise<void> {
  const { error } = await getSupabase().from('invoices').update({ status }).eq('id', id)
  if (error) fail(error, 'Não foi possível atualizar a cobrança.')
}

export async function updateInvoice(
  id: string,
  patch: TablesUpdate<'invoices'>,
): Promise<void> {
  assertTxid(patch.pix_txid)
  const { error } = await getSupabase().from('invoices').update(patch).eq('id', id)
  if (error) fail(error, 'Não foi possível salvar a cobrança.')
}

export async function listStudentsForBilling(): Promise<InvoiceStudent[]> {
  const { data, error } = await getSupabase()
    .from('students')
    .select(STUDENT_COLS)
    .neq('status', 'saiu')
    .order('full_name', { ascending: true })
  if (error) fail(error, 'Não foi possível carregar os alunos.')
  return data
}

export async function listPlansForBilling(): Promise<PlanLite[]> {
  const { data, error } = await getSupabase()
    .from('plans')
    .select('id, name, billing_model, lessons_per_month, lessons_in_package, price_cents')
    .eq('active', true)
    .order('name', { ascending: true })
  if (error) fail(error, 'Não foi possível carregar os planos.')
  return data
}
