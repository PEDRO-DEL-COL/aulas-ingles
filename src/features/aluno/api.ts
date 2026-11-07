/**
 * Camada de dados da área do aluno. A segurança vem do RLS; aqui só consultamos.
 * NUNCA consulta `private_notes`.
 */
import { getSupabase } from '@/lib/supabase'
import type { Tables } from '@/types/database'

import { friendlyError } from '@/features/shared/errors'
import type { Invoice } from './invoices'
import { findMakeup, type Lesson, type Settings, type StudentRecord } from './lessons'

export type Plan = Tables<'plans'>
export type Material = Tables<'materials'>
export type LessonNote = Pick<
  Tables<'lesson_notes'>,
  'id' | 'lesson_id' | 'content' | 'summary' | 'homework'
>
export type LessonDetail = {
  lesson: Lesson
  note: LessonNote | null
  materials: Material[]
  /** Reposição já agendada a partir desta aula (se houver). */
  makeup: Lesson | null
}

function fail(error: unknown, fallback: string): never {
  throw new Error(friendlyError(error, fallback))
}

export async function getMyStudent(profileId: string): Promise<StudentRecord | null> {
  const { data, error } = await getSupabase()
    .from('students')
    .select('*')
    .eq('profile_id', profileId)
    .limit(1)
    .maybeSingle()
  if (error) fail(error, 'Não foi possível carregar a sua ficha.')
  return data
}

export async function getPlan(planId: string): Promise<Plan | null> {
  const { data, error } = await getSupabase()
    .from('plans')
    .select('*')
    .eq('id', planId)
    .maybeSingle()
  if (error) fail(error, 'Não foi possível carregar o seu plano.')
  return data
}

/** Todas as aulas do aluno, da mais antiga para a mais nova. */
export async function listLessons(studentId: string): Promise<Lesson[]> {
  const { data, error } = await getSupabase()
    .from('lessons')
    .select('*')
    .eq('student_id', studentId)
    .order('starts_at', { ascending: true })
  if (error) fail(error, 'Não foi possível carregar as aulas.')
  return data
}

export async function getLesson(lessonId: string): Promise<LessonDetail | null> {
  const supabase = getSupabase()
  const { data: lesson, error } = await supabase
    .from('lessons')
    .select('*')
    .eq('id', lessonId)
    .maybeSingle()
  if (error) fail(error, 'Não foi possível carregar a aula.')
  if (!lesson) return null

  const [notes, materials, makeups] = await Promise.all([
    supabase
      .from('lesson_notes')
      .select('id, lesson_id, content, summary, homework')
      .eq('lesson_id', lessonId)
      .maybeSingle(),
    supabase
      .from('materials')
      .select('*')
      .eq('lesson_id', lessonId)
      .order('created_at', { ascending: true }),
    supabase.from('lessons').select('*').eq('rescheduled_from', lessonId),
  ])
  if (notes.error) fail(notes.error, 'Não foi possível carregar o registro da aula.')
  if (materials.error) fail(materials.error, 'Não foi possível carregar os materiais.')
  if (makeups.error) fail(makeups.error, 'Não foi possível carregar a reposição.')
  return {
    lesson,
    note: notes.data,
    materials: materials.data,
    makeup: findMakeup(lessonId, makeups.data),
  }
}

/** Registros visíveis (resumo/tarefa) de várias aulas, indexados pelo id da aula. */
export async function listLessonNotes(
  lessonIds: readonly string[],
): Promise<Map<string, LessonNote>> {
  const map = new Map<string, LessonNote>()
  if (lessonIds.length === 0) return map
  const { data, error } = await getSupabase()
    .from('lesson_notes')
    .select('id, lesson_id, content, summary, homework')
    .in('lesson_id', [...lessonIds])
  if (error) fail(error, 'Não foi possível carregar os registros das aulas.')
  for (const n of data) map.set(n.lesson_id, n)
  return map
}

export async function listMaterials(): Promise<Material[]> {
  const { data, error } = await getSupabase()
    .from('materials')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) fail(error, 'Não foi possível carregar os materiais.')
  return data
}

/** Cobranças do aluno (a view já aplica o RLS). Usa o status efetivo. */
export async function listInvoices(studentId: string): Promise<Invoice[]> {
  const { data, error } = await getSupabase()
    .from('invoices_with_status')
    .select('*')
    .eq('student_id', studentId)
    .order('due_date', { ascending: false })
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
  return invoices
}

export async function getSettings(): Promise<Settings> {
  const { data, error } = await getSupabase().from('settings').select('*').maybeSingle()
  if (error) fail(error, 'Não foi possível carregar as configurações.')
  if (!data)
    throw new Error('As configurações ainda não foram criadas. Fale com a professora.')
  return data
}

/** Cancela pelo banco (RPC) e devolve a aula com o makeup_eligible REAL. */
export async function cancelLesson(lessonId: string, reason: string): Promise<Lesson> {
  const { data, error } = await getSupabase().rpc('cancel_lesson', {
    p_lesson_id: lessonId,
    p_reason: reason.trim() === '' ? undefined : reason.trim(),
  })
  if (error) fail(error, 'Não foi possível cancelar a aula. Tente de novo.')
  return data
}

/** "Já paguei": apenas avisa a professora; não altera o status da cobrança. */
export async function notifyPaid(invoiceId: string): Promise<void> {
  const { error } = await getSupabase().rpc('mark_invoice_as_paid_notice', {
    p_invoice_id: invoiceId,
  })
  if (error) fail(error, 'Não foi possível enviar o aviso. Tente de novo.')
}

/** Reposições usadas no mês civil (America/Sao_Paulo) de `month` ("AAAA-MM-01"). */
export async function makeupsUsed(studentId: string, month: string): Promise<number> {
  const { data, error } = await getSupabase().rpc('makeups_used_in_month', {
    p_student: studentId,
    p_month: month,
  })
  if (error) fail(error, 'Não foi possível carregar as reposições do mês.')
  return data
}

export async function updateMyProfile(
  profileId: string,
  values: { phone: string | null; timezone: string },
): Promise<void> {
  const { error } = await getSupabase()
    .from('profiles')
    .update(values)
    .eq('id', profileId)
  if (error) fail(error, 'Não foi possível salvar o perfil. Tente de novo.')
}
