/** Lógica pura do financeiro da professora (sem acesso a dados). */
import type { Invoice } from '@/features/aluno/invoices'
import { formatDateOnly, formatReferenceMonth } from '@/features/shared/datetime'
import { formatBRL } from '@/lib/format'
import type { Tables, TablesInsert } from '@/types/database'

export type BillingModel = Tables<'invoices'>['billing_model']
export type PlanLite = Pick<
  Tables<'plans'>,
  | 'id'
  | 'name'
  | 'billing_model'
  | 'lessons_per_month'
  | 'lessons_in_package'
  | 'price_cents'
>

export type InvoiceStudent = Pick<
  Tables<'students'>,
  'id' | 'full_name' | 'phone' | 'plan_id' | 'default_payer_id'
>
export type InvoicePayer = Pick<Tables<'payers'>, 'id' | 'name' | 'phone'>

/** Cobrança com aluno e pagador anexados. */
export type InvoiceAdmin = Invoice & {
  student: InvoiceStudent | null
  payer: InvoicePayer | null
}

// ------------------------------------------------------------------ formulário

export type InvoiceFormValues = {
  student_id: string
  payer_id: string
  plan_id: string
  billing_model: BillingModel
  /** "150,00" ou "1.234,56" */
  amount: string
  /** "AAAA-MM" (mensalidade) */
  reference_month: string
  /** Quantidade de aulas (pacote obrigatório; avulsa opcional) */
  lessons_count: string
  description: string
  /** "AAAA-MM-DD" */
  due_date: string
  status: 'em_aberto' | 'pago'
}

export type InvoiceFormErrors = Partial<Record<keyof InvoiceFormValues, string>>

export type InvoiceInsert = TablesInsert<'invoices'>

/** "150,00" / "1.234,56" / "150" / "150.5" => centavos; null se inválido ou <= 0. */
export function parseBRLToCents(input: string): number | null {
  let s = input
    .trim()
    .replace(/^R\$\s*/i, '')
    .replace(/\s/g, '')
  if (s === '') return null
  if (s.includes(',')) {
    s = s.replace(/\./g, '').replace(',', '.')
  } else if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
    s = s.replace(/\./g, '') // "1.234" = mil duzentos e trinta e quatro
  }
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null
  const [int = '0', frac = ''] = s.split('.')
  const cents = Number(int) * 100 + Number(frac.padEnd(2, '0'))
  if (!Number.isSafeInteger(cents) || cents <= 0 || cents > 2_147_483_647) return null
  return cents
}

/** Centavos => "150,00" (para preencher o campo de valor). */
export function centsToInput(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping: false,
  })
}

function isRealDate(iso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number]
  const dt = new Date(Date.UTC(y, m - 1, d))
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
}

export function validateInvoiceForm(
  v: InvoiceFormValues,
):
  | { data: InvoiceInsert & { amount_cents: number; due_date: string } }
  | { errors: InvoiceFormErrors } {
  const errors: InvoiceFormErrors = {}

  if (!v.student_id) errors.student_id = 'Escolha o aluno.'

  const cents = parseBRLToCents(v.amount)
  if (cents === null) errors.amount = 'Informe um valor maior que zero, como 150,00.'

  if (!isRealDate(v.due_date)) errors.due_date = 'Informe a data de vencimento.'

  let referenceMonth: string | null = null
  if (v.billing_model === 'mensalidade') {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(v.reference_month)) {
      errors.reference_month = 'Informe o mês de referência.'
    } else {
      referenceMonth = `${v.reference_month}-01`
    }
  }

  let lessons: number | null = null
  const rawLessons = v.lessons_count.trim()
  if (
    v.billing_model === 'pacote' ||
    (v.billing_model === 'avulsa' && rawLessons !== '')
  ) {
    if (
      !/^\d+$/.test(rawLessons) ||
      Number(rawLessons) < 1 ||
      Number(rawLessons) > 1000
    ) {
      errors.lessons_count =
        v.billing_model === 'pacote'
          ? 'Informe quantas aulas tem o pacote.'
          : 'Use um número inteiro maior que zero.'
    } else {
      lessons = Number(rawLessons)
    }
  }

  const description = v.description.trim()
  if (description.length > 500) errors.description = 'Use no máximo 500 caracteres.'

  if (Object.keys(errors).length > 0 || cents === null) return { errors }

  return {
    data: {
      student_id: v.student_id,
      payer_id: v.payer_id || null,
      plan_id: v.plan_id || null,
      billing_model: v.billing_model,
      reference_month: referenceMonth,
      description: description === '' ? null : description,
      lessons_count: lessons,
      amount_cents: cents,
      due_date: v.due_date,
      status: v.status,
    },
  }
}

/** "AAAA-MM" do mês de `now` (fuso de Brasília). */
export function currentMonthInput(now: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
  })
    .format(now)
    .slice(0, 7)
}

/** Pré-preenche modelo, valor, aulas e mês a partir de um plano. */
export function invoiceDefaultsFromPlan(
  plan: PlanLite,
  now: Date,
): Pick<
  InvoiceFormValues,
  'plan_id' | 'billing_model' | 'amount' | 'lessons_count' | 'reference_month'
> {
  const lessons =
    plan.billing_model === 'pacote'
      ? plan.lessons_in_package
      : plan.billing_model === 'avulsa'
        ? 1
        : null
  return {
    plan_id: plan.id,
    billing_model: plan.billing_model,
    amount: centsToInput(plan.price_cents),
    lessons_count: lessons ? String(lessons) : '',
    reference_month: plan.billing_model === 'mensalidade' ? currentMonthInput(now) : '',
  }
}

// ------------------------------------------------------------------ listas

export type InvoiceGroups<T> = {
  atrasadas: T[]
  abertas: T[]
  avisosJaPaguei: T[]
  pagas: T[]
  canceladas: T[]
}

type Groupable = Pick<Invoice, 'effective_status' | 'student_notified_paid_at'>

/**
 * Agrupa as cobranças. Um aviso de "Já paguei" (em aberto/atrasada) vai só para
 * `avisosJaPaguei`; as demais atrasadas e em aberto ficam nos seus grupos.
 */
export function groupInvoices<T extends Groupable>(list: readonly T[]): InvoiceGroups<T> {
  const g: InvoiceGroups<T> = {
    atrasadas: [],
    abertas: [],
    avisosJaPaguei: [],
    pagas: [],
    canceladas: [],
  }
  for (const i of list) {
    const s = i.effective_status
    if (s === 'pago') g.pagas.push(i)
    else if (s === 'cancelado') g.canceladas.push(i)
    else if (i.student_notified_paid_at) g.avisosJaPaguei.push(i)
    else if (s === 'atrasado') g.atrasadas.push(i)
    else g.abertas.push(i)
  }
  return g
}

export type InvoiceStatusFilter =
  'todas' | 'atrasadas' | 'abertas' | 'pagas' | 'canceladas'

function norm(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

/**
 * Filtra por nome do aluno/pagador (sem acento), situação e mês.
 * `month` ("AAAA-MM") confere com o mês de referência, ou com o vencimento se não houver.
 * "abertas" inclui as atrasadas; "atrasadas" só as vencidas.
 */
export function filterInvoices<
  T extends Pick<Invoice, 'effective_status' | 'due_date' | 'reference_month'> & {
    student?: { full_name: string } | null
    payer?: { name: string } | null
  },
>(
  list: readonly T[],
  opts: { search?: string; status?: InvoiceStatusFilter; month?: string },
): T[] {
  const q = norm(opts.search ?? '')
  const status = opts.status ?? 'todas'
  const month = opts.month ?? ''
  return list.filter((i) => {
    const s = i.effective_status
    if (status === 'atrasadas' && s !== 'atrasado') return false
    if (status === 'abertas' && s !== 'em_aberto' && s !== 'atrasado') return false
    if (status === 'pagas' && s !== 'pago') return false
    if (status === 'canceladas' && s !== 'cancelado') return false
    if (month) {
      const m = (i.reference_month ?? i.due_date).slice(0, 7)
      if (m !== month) return false
    }
    if (q) {
      const hay = norm(`${i.student?.full_name ?? ''} ${i.payer?.name ?? ''}`)
      if (!hay.includes(q)) return false
    }
    return true
  })
}

// ------------------------------------------------------------------ textos

/** "2026-11-01" => "nov/2026" */
export function shortMonth(iso: string): string {
  const [y, m] = iso.split('-')
  const names = [
    'jan',
    'fev',
    'mar',
    'abr',
    'mai',
    'jun',
    'jul',
    'ago',
    'set',
    'out',
    'nov',
    'dez',
  ]
  const name = names[Number(m) - 1]
  return name && y ? `${name}/${y}` : iso
}

export function invoiceTitle(
  i: Pick<Invoice, 'billing_model' | 'reference_month' | 'lessons_count'>,
): string {
  if (i.billing_model === 'mensalidade') {
    return i.reference_month
      ? `Mensalidade de ${shortMonth(i.reference_month)}`
      : 'Mensalidade'
  }
  if (i.billing_model === 'pacote') {
    return i.lessons_count
      ? `Pacote de ${i.lessons_count} ${i.lessons_count === 1 ? 'aula' : 'aulas'}`
      : 'Pacote de aulas'
  }
  return 'Avulsa'
}

export function buildPaymentReminder(p: {
  studentName: string
  amountCents: number
  dueDate: string
  referenceMonth?: string | null
  businessName: string
}): string {
  const first = p.studentName.trim().split(/\s+/)[0] ?? ''
  const what = p.referenceMonth
    ? `da mensalidade de ${formatReferenceMonth(p.referenceMonth)}`
    : 'da cobrança'
  return (
    `Olá${first ? `, ${first}` : ''}! Tudo bem? Passando para lembrar do pagamento ${what}, ` +
    `no valor de ${formatBRL(p.amountCents / 100)}, com vencimento em ${formatDateOnly(p.dueDate)}. ` +
    `O Pix está na sua área do aluno. Se você já pagou, é só desconsiderar. Obrigada! ` +
    p.businessName
  )
}
