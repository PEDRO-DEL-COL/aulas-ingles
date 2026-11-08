/** Dados de importação e exportação de planilhas. A segurança vem do RLS (staff). */
import { friendlyError } from '@/features/shared/errors'
import { formatDateOnly, formatDateTime } from '@/features/shared/datetime'
import { getSupabase } from '@/lib/supabase'
import type { Tables, TablesInsert } from '@/types/database'

function fail(error: unknown, fallback: string): never {
  throw new Error(friendlyError(error, fallback))
}

const PAGE = 1000
const BATCH = 200

type Row = Record<string, unknown>

/** Lê todas as páginas de uma consulta (o PostgREST limita a 1000 linhas por vez). */
async function fetchAll<T extends Row>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
  message: string,
): Promise<T[]> {
  const all: T[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1)
    if (error) fail(error, message)
    const chunk = data ?? []
    all.push(...chunk)
    if (chunk.length < PAGE) return all
  }
}

export async function listStudentEmails(): Promise<string[]> {
  const rows = await fetchAll(
    (a, b) => getSupabase().from('students').select('email').order('email').range(a, b),
    'Não foi possível carregar os alunos.',
  )
  return rows.map((r) => r.email)
}

export async function countStudents(): Promise<number> {
  const { count, error } = await getSupabase()
    .from('students')
    .select('id', { count: 'exact', head: true })
  if (error) fail(error, 'Não foi possível contar os alunos.')
  return count ?? 0
}

/**
 * Insere em lotes; e-mails já cadastrados são ignorados (índice único em email),
 * então repetir a importação não duplica. Devolve quantos foram realmente criados.
 */
export async function importStudents(
  students: readonly TablesInsert<'students'>[],
): Promise<number> {
  let created = 0
  for (let i = 0; i < students.length; i += BATCH) {
    const { data, error } = await getSupabase()
      .from('students')
      .upsert(students.slice(i, i + BATCH), {
        onConflict: 'email',
        ignoreDuplicates: true,
      })
      .select('id')
    if (error) fail(error, 'Não foi possível importar os alunos. Tente de novo.')
    created += data.length
  }
  return created
}

// ------------------------------------------------------------- exportação

type Names = Map<string, string>

async function studentNames(): Promise<Names> {
  const rows = await fetchAll(
    (a, b) =>
      getSupabase().from('students').select('id, full_name').order('id').range(a, b),
    'Não foi possível carregar os alunos.',
  )
  return new Map(rows.map((r) => [r.id, r.full_name]))
}

async function planNames(): Promise<Names> {
  const { data, error } = await getSupabase().from('plans').select('id, name')
  if (error) fail(error, 'Não foi possível carregar os planos.')
  return new Map(data.map((p) => [p.id, p.name]))
}

const STUDENT_STATUS = { ativo: 'Ativo', pausado: 'Pausado', saiu: 'Saiu' } as const

export async function buildStudentsExport(): Promise<string[][]> {
  const [students, plans] = await Promise.all([
    fetchAll(
      (a, b) => getSupabase().from('students').select('*').order('full_name').range(a, b),
      'Não foi possível carregar os alunos.',
    ),
    planNames(),
  ])
  return [
    [
      'Nome',
      'E-mail',
      'Telefone',
      'Nível',
      'Objetivo',
      'Plano',
      'Link do Meet',
      'Menor de idade',
      'Situação',
    ],
    ...students.map((s: Tables<'students'>) => [
      s.full_name,
      s.email,
      s.phone ?? '',
      s.level ?? '',
      s.goal ?? '',
      s.plan_id ? (plans.get(s.plan_id) ?? '') : '',
      s.meet_link ?? '',
      s.is_minor ? 'Sim' : 'Não',
      STUDENT_STATUS[s.status],
    ]),
  ]
}

const LESSON_STATUS: Record<Tables<'lessons'>['status'], string> = {
  agendada: 'Agendada',
  realizada: 'Realizada',
  falta_aluno: 'Falta do aluno',
  cancelada_aluno: 'Cancelada pelo aluno',
  cancelada_professora: 'Cancelada pela professora',
  reposicao: 'Reposição',
}

export async function buildLessonsExport(timezone: string): Promise<string[][]> {
  const [lessons, names] = await Promise.all([
    fetchAll(
      (a, b) =>
        getSupabase()
          .from('lessons')
          .select('*')
          .order('starts_at', { ascending: false })
          .order('id')
          .range(a, b),
      'Não foi possível carregar as aulas.',
    ),
    studentNames(),
  ])
  return [
    ['Aluno', 'Data e hora', 'Duração (min)', 'Situação', 'Motivo'],
    ...lessons.map((l: Tables<'lessons'>) => [
      names.get(l.student_id) ?? '',
      formatDateTime(l.starts_at, timezone),
      String(l.duration_minutes),
      LESSON_STATUS[l.status],
      l.cancel_reason ?? '',
    ]),
  ]
}

const BILLING_MODEL = { mensalidade: 'Mensalidade', pacote: 'Pacote', avulsa: 'Avulsa' }
const INVOICE_STATUS = {
  em_aberto: 'Em aberto',
  pago: 'Pago',
  atrasado: 'Atrasado',
  cancelado: 'Cancelado',
}

function money(cents: number): string {
  return `R$ ${(cents / 100).toFixed(2).replace('.', ',')}`
}

export async function buildInvoicesExport(timezone: string): Promise<string[][]> {
  const [invoices, names] = await Promise.all([
    fetchAll(
      (a, b) =>
        getSupabase()
          .from('invoices_with_status')
          .select('*')
          .order('due_date', { ascending: false })
          .order('id')
          .range(a, b),
      'Não foi possível carregar os pagamentos.',
    ),
    studentNames(),
  ])
  return [
    [
      'Aluno',
      'Modelo',
      'Mês de referência',
      'Valor',
      'Vencimento',
      'Situação',
      'Pago em',
    ],
    ...invoices.map((i) => {
      const status = i.effective_status ?? i.status ?? 'em_aberto'
      return [
        i.student_id ? (names.get(i.student_id) ?? '') : '',
        BILLING_MODEL[i.billing_model ?? 'mensalidade'],
        i.reference_month
          ? i.reference_month.slice(0, 7).split('-').reverse().join('/')
          : '',
        money(i.amount_cents ?? 0),
        i.due_date ? formatDateOnly(i.due_date) : '',
        INVOICE_STATUS[status],
        i.paid_at ? formatDateTime(i.paid_at, timezone) : '',
      ]
    }),
  ]
}
