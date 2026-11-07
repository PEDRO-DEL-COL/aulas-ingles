/**
 * Camada de dados da área da professora. A segurança vem do RLS (staff);
 * as regras de cancelamento/reposição são aplicadas pelo banco (RPCs e triggers).
 */
import { friendlyError } from '@/features/shared/errors'
import { getSupabase } from '@/lib/supabase'
import type { Tables, TablesInsert, TablesUpdate } from '@/types/database'

import type { Lesson, LessonStatus, StudentRecord } from '@/features/aluno/lessons'
import type { LessonWithStudent, StudentLite } from './lessons'

export type Plan = Tables<'plans'>
export type Schedule = Tables<'schedules'>
export type PrivateNote = Tables<'private_notes'>
export type Payer = Tables<'payers'>
export type Guardian = Tables<'student_guardians'>
export type Material = Tables<'materials'>
export type LessonNote = Tables<'lesson_notes'>

function fail(error: unknown, fallback: string): never {
  throw new Error(friendlyError(error, fallback))
}

const LITE = 'id, full_name, phone, meet_link'

async function attachStudents(lessons: Lesson[]): Promise<LessonWithStudent[]> {
  const ids = [...new Set(lessons.map((l) => l.student_id))]
  const map = new Map<string, StudentLite>()
  if (ids.length > 0) {
    const { data, error } = await getSupabase()
      .from('students')
      .select(LITE)
      .in('id', ids)
    if (error) fail(error, 'Não foi possível carregar os alunos.')
    for (const s of data) map.set(s.id, s)
  }
  return lessons.map((l) => ({ ...l, student: map.get(l.student_id) ?? null }))
}

// ------------------------------------------------------------------ aulas

/** Aulas com início em [from, to), com o aluno anexado. */
export async function listLessonsBetween(
  from: Date,
  to: Date,
): Promise<LessonWithStudent[]> {
  const { data, error } = await getSupabase()
    .from('lessons')
    .select('*')
    .gte('starts_at', from.toISOString())
    .lt('starts_at', to.toISOString())
    .order('starts_at', { ascending: true })
  if (error) fail(error, 'Não foi possível carregar as aulas.')
  return attachStudents(data)
}

/** Ids (entre `ids`) de aulas que já têm uma reposição agendada. */
export async function listMakeupOrigins(ids: readonly string[]): Promise<Set<string>> {
  const set = new Set<string>()
  if (ids.length === 0) return set
  const { data, error } = await getSupabase()
    .from('lessons')
    .select('rescheduled_from')
    .in('rescheduled_from', [...ids])
  if (error) fail(error, 'Não foi possível verificar as reposições.')
  for (const r of data) if (r.rescheduled_from) set.add(r.rescheduled_from)
  return set
}

/** Cancelamentos do aluno à espera de "dar reposição / sem reposição". */
export async function listPendingDecisions(): Promise<LessonWithStudent[]> {
  const { data, error } = await getSupabase()
    .from('lessons')
    .select('*')
    .eq('status', 'cancelada_aluno')
    .is('makeup_eligible', null)
    .order('starts_at', { ascending: true })
  if (error) fail(error, 'Não foi possível carregar as decisões pendentes.')
  return attachStudents(data)
}

export async function countOverdueInvoices(): Promise<number> {
  const { count, error } = await getSupabase()
    .from('invoices_with_status')
    .select('id', { count: 'exact', head: true })
    .eq('effective_status', 'atrasado')
  if (error) fail(error, 'Não foi possível contar as cobranças atrasadas.')
  return count ?? 0
}

export async function decideMakeup(lessonId: string, eligible: boolean): Promise<Lesson> {
  const { data, error } = await getSupabase().rpc('decide_makeup', {
    p_lesson_id: lessonId,
    p_eligible: eligible,
  })
  if (error) fail(error, 'Não foi possível registrar a decisão. Tente de novo.')
  return data
}

export async function cancelLesson(
  lessonId: string,
  byTeacher: boolean,
  reason: string,
): Promise<Lesson> {
  const { data, error } = await getSupabase().rpc('cancel_lesson', {
    p_lesson_id: lessonId,
    p_reason: reason.trim() === '' ? undefined : reason.trim(),
    p_by_teacher: byTeacher,
  })
  if (error) fail(error, 'Não foi possível cancelar a aula. Tente de novo.')
  return data
}

export async function setLessonStatus(
  lessonId: string,
  status: Extract<LessonStatus, 'realizada' | 'falta_aluno'>,
): Promise<void> {
  const { error } = await getSupabase()
    .from('lessons')
    .update({ status })
    .eq('id', lessonId)
  if (error) fail(error, 'Não foi possível atualizar a aula. Tente de novo.')
}

export async function scheduleMakeup(
  originalLessonId: string,
  startsAtIso: string,
): Promise<Lesson> {
  const { data, error } = await getSupabase().rpc('schedule_makeup', {
    p_original_lesson: originalLessonId,
    p_starts_at: startsAtIso,
  })
  if (error) fail(error, 'Não foi possível agendar a reposição. Tente de novo.')
  return data
}

/** Gera as aulas dos horários fixos entre as datas (AAAA-MM-DD); devolve quantas foram criadas. */
export async function generateLessons(from: string, to: string): Promise<number> {
  const { data, error } = await getSupabase().rpc('generate_lessons', {
    p_from: from,
    p_to: to,
  })
  if (error) fail(error, 'Não foi possível gerar as aulas. Tente de novo.')
  return data
}

export type LessonRecord = {
  lesson: Lesson
  student: StudentRecord | null
  note: LessonNote | null
  materials: Material[]
  privateNotes: PrivateNote[]
}

export async function getLessonRecord(lessonId: string): Promise<LessonRecord | null> {
  const supabase = getSupabase()
  const { data: lesson, error } = await supabase
    .from('lessons')
    .select('*')
    .eq('id', lessonId)
    .maybeSingle()
  if (error) fail(error, 'Não foi possível carregar a aula.')
  if (!lesson) return null
  const [student, note, materials, privateNotes] = await Promise.all([
    supabase.from('students').select('*').eq('id', lesson.student_id).maybeSingle(),
    supabase.from('lesson_notes').select('*').eq('lesson_id', lessonId).maybeSingle(),
    supabase
      .from('materials')
      .select('*')
      .eq('lesson_id', lessonId)
      .order('created_at', { ascending: true }),
    supabase
      .from('private_notes')
      .select('*')
      .eq('lesson_id', lessonId)
      .order('created_at', { ascending: true }),
  ])
  if (student.error) fail(student.error, 'Não foi possível carregar o aluno.')
  if (note.error) fail(note.error, 'Não foi possível carregar o registro da aula.')
  if (materials.error) fail(materials.error, 'Não foi possível carregar os materiais.')
  if (privateNotes.error)
    fail(privateNotes.error, 'Não foi possível carregar as anotações.')
  return {
    lesson,
    student: student.data,
    note: note.data,
    materials: materials.data,
    privateNotes: privateNotes.data,
  }
}

export async function saveLessonNote(
  lessonId: string,
  values: { content: string; summary: string; homework: string },
  profileId: string | null,
): Promise<void> {
  const clean = (v: string) => (v.trim() === '' ? null : v.trim())
  const { error } = await getSupabase()
    .from('lesson_notes')
    .upsert(
      {
        lesson_id: lessonId,
        content: clean(values.content),
        summary: clean(values.summary),
        homework: clean(values.homework),
        created_by: profileId,
      },
      { onConflict: 'lesson_id' },
    )
  if (error) fail(error, 'Não foi possível salvar o registro. Tente de novo.')
}

export async function addMaterial(input: {
  lessonId: string
  studentId: string
  title: string
  type: Material['type']
  url: string
  profileId: string | null
}): Promise<void> {
  const { error } = await getSupabase().from('materials').insert({
    lesson_id: input.lessonId,
    student_id: input.studentId,
    title: input.title.trim(),
    type: input.type,
    url: input.url.trim(),
    created_by: input.profileId,
  })
  if (error) fail(error, 'Não foi possível adicionar o material.')
}

export async function removeMaterial(id: string): Promise<void> {
  const { error } = await getSupabase().from('materials').delete().eq('id', id)
  if (error) fail(error, 'Não foi possível remover o material.')
}

// ----------------------------------------------------------------- alunos

export async function listStudents(): Promise<StudentRecord[]> {
  const { data, error } = await getSupabase()
    .from('students')
    .select('*')
    .order('full_name', { ascending: true })
  if (error) fail(error, 'Não foi possível carregar os alunos.')
  return data
}

export async function getStudent(id: string): Promise<StudentRecord | null> {
  const { data, error } = await getSupabase()
    .from('students')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) fail(error, 'Não foi possível carregar o aluno.')
  return data
}

export async function listActivePlans(): Promise<Plan[]> {
  const { data, error } = await getSupabase()
    .from('plans')
    .select('*')
    .eq('active', true)
    .order('name', { ascending: true })
  if (error) fail(error, 'Não foi possível carregar os planos.')
  return data
}

export async function createStudent(
  values: TablesInsert<'students'>,
): Promise<StudentRecord> {
  const { data, error } = await getSupabase()
    .from('students')
    .insert(values)
    .select('*')
    .single()
  if (error) fail(error, 'Não foi possível cadastrar o aluno.')
  return data
}

export async function updateStudent(
  id: string,
  values: TablesUpdate<'students'>,
): Promise<StudentRecord> {
  const { data, error } = await getSupabase()
    .from('students')
    .update(values)
    .eq('id', id)
    .select('*')
    .single()
  if (error) fail(error, 'Não foi possível salvar a ficha.')
  return data
}

export async function listRecentLessons(
  studentId: string,
  limit = 10,
): Promise<Lesson[]> {
  const { data, error } = await getSupabase()
    .from('lessons')
    .select('*')
    .eq('student_id', studentId)
    .order('starts_at', { ascending: false })
    .limit(limit)
  if (error) fail(error, 'Não foi possível carregar as aulas.')
  return data
}

// -------------------------------------------------------------- horários

export async function listSchedules(studentId: string): Promise<Schedule[]> {
  const { data, error } = await getSupabase()
    .from('schedules')
    .select('*')
    .eq('student_id', studentId)
    .order('weekday', { ascending: true })
    .order('start_time', { ascending: true })
  if (error) fail(error, 'Não foi possível carregar os horários.')
  return data
}

export async function saveSchedule(
  id: string | null,
  values: TablesInsert<'schedules'>,
): Promise<void> {
  const supabase = getSupabase()
  const { error } = id
    ? await supabase.from('schedules').update(values).eq('id', id)
    : await supabase.from('schedules').insert(values)
  if (error) fail(error, 'Não foi possível salvar o horário.')
}

export async function deleteSchedule(id: string): Promise<void> {
  const { error } = await getSupabase().from('schedules').delete().eq('id', id)
  if (error) fail(error, 'Não foi possível excluir o horário.')
}

// ------------------------------------------------ responsáveis e pagador

export async function listGuardians(studentId: string): Promise<Guardian[]> {
  const { data, error } = await getSupabase()
    .from('student_guardians')
    .select('*')
    .eq('student_id', studentId)
    .order('created_at', { ascending: true })
  if (error) fail(error, 'Não foi possível carregar os responsáveis.')
  return data
}

export async function saveGuardian(
  id: string | null,
  values: TablesInsert<'student_guardians'>,
): Promise<void> {
  const supabase = getSupabase()
  const { error } = id
    ? await supabase.from('student_guardians').update(values).eq('id', id)
    : await supabase.from('student_guardians').insert(values)
  if (error) fail(error, 'Não foi possível salvar o responsável.')
}

export async function deleteGuardian(id: string): Promise<void> {
  const { error } = await getSupabase().from('student_guardians').delete().eq('id', id)
  if (error) fail(error, 'Não foi possível excluir o responsável.')
}

export async function getPayer(id: string): Promise<Payer | null> {
  const { data, error } = await getSupabase()
    .from('payers')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) fail(error, 'Não foi possível carregar o pagador.')
  return data
}

/** Cria ou atualiza o pagador padrão do aluno (vínculo em students.default_payer_id). */
export async function savePayer(
  studentId: string,
  payerId: string | null,
  values: {
    name: string
    email: string | null
    phone: string | null
    document: string | null
  },
): Promise<void> {
  const supabase = getSupabase()
  if (payerId) {
    const { error } = await supabase.from('payers').update(values).eq('id', payerId)
    if (error) fail(error, 'Não foi possível salvar o pagador.')
    return
  }
  const { data, error } = await supabase
    .from('payers')
    .insert(values)
    .select('id')
    .single()
  if (error) fail(error, 'Não foi possível salvar o pagador.')
  const link = await supabase
    .from('students')
    .update({ default_payer_id: data.id })
    .eq('id', studentId)
  if (link.error) fail(link.error, 'Não foi possível vincular o pagador ao aluno.')
}

/** Desvincula e apaga o pagador (cobranças antigas ficam sem pagador). */
export async function removePayer(studentId: string, payerId: string): Promise<void> {
  const supabase = getSupabase()
  const unlink = await supabase
    .from('students')
    .update({ default_payer_id: null })
    .eq('id', studentId)
  if (unlink.error) fail(unlink.error, 'Não foi possível remover o pagador.')
  const { error } = await supabase.from('payers').delete().eq('id', payerId)
  if (error) fail(error, 'Não foi possível remover o pagador.')
}

// -------------------------------------------------- anotações privadas

export async function listPrivateNotes(studentId: string): Promise<PrivateNote[]> {
  const { data, error } = await getSupabase()
    .from('private_notes')
    .select('*')
    .eq('student_id', studentId)
    .order('created_at', { ascending: false })
  if (error) fail(error, 'Não foi possível carregar as anotações.')
  return data
}

export async function savePrivateNote(
  id: string | null,
  input: {
    studentId: string
    lessonId?: string | null
    body: string
    profileId: string | null
  },
): Promise<void> {
  const supabase = getSupabase()
  const body = input.body.trim()
  const { error } = id
    ? await supabase.from('private_notes').update({ body }).eq('id', id)
    : await supabase.from('private_notes').insert({
        student_id: input.studentId,
        lesson_id: input.lessonId ?? null,
        body,
        created_by: input.profileId,
      })
  if (error) fail(error, 'Não foi possível salvar a anotação.')
}

export async function deletePrivateNote(id: string): Promise<void> {
  const { error } = await getSupabase().from('private_notes').delete().eq('id', id)
  if (error) fail(error, 'Não foi possível excluir a anotação.')
}
