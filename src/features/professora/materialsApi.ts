/** Materiais (links do Google Drive etc.) de toda a área da professora. */
import { friendlyError } from '@/features/shared/errors'
import { getSupabase } from '@/lib/supabase'

import type { Material } from './api'
import type { MaterialTarget } from './blocked'

export type MaterialWithTarget = Material & {
  student_name: string | null
  lesson_starts_at: string | null
}

export type PickerLesson = {
  id: string
  starts_at: string
  status: string
}

function fail(error: unknown, fallback: string): never {
  throw new Error(friendlyError(error, fallback))
}

export async function listAllMaterials(): Promise<MaterialWithTarget[]> {
  const db = getSupabase()
  const { data, error } = await db
    .from('materials')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) fail(error, 'Não foi possível carregar os materiais.')

  const lessonIds = [...new Set(data.flatMap((m) => (m.lesson_id ? [m.lesson_id] : [])))]
  const lessons = new Map<string, { student_id: string; starts_at: string }>()
  if (lessonIds.length > 0) {
    const res = await db
      .from('lessons')
      .select('id, student_id, starts_at')
      .in('id', lessonIds)
    if (res.error) fail(res.error, 'Não foi possível carregar as aulas dos materiais.')
    for (const l of res.data) lessons.set(l.id, l)
  }

  const studentIds = [
    ...new Set([
      ...data.flatMap((m) => (m.student_id ? [m.student_id] : [])),
      ...[...lessons.values()].map((l) => l.student_id),
    ]),
  ]
  const names = new Map<string, string>()
  if (studentIds.length > 0) {
    const res = await db.from('students').select('id, full_name').in('id', studentIds)
    if (res.error) fail(res.error, 'Não foi possível carregar os alunos.')
    for (const s of res.data) names.set(s.id, s.full_name)
  }

  return data.map((m) => {
    const lesson = m.lesson_id ? lessons.get(m.lesson_id) : undefined
    const studentId = m.student_id ?? lesson?.student_id ?? null
    return {
      ...m,
      student_name: studentId ? (names.get(studentId) ?? null) : null,
      lesson_starts_at: lesson?.starts_at ?? null,
    }
  })
}

export type MaterialInput = {
  title: string
  type: Material['type']
  url: string
  description: string
}

export async function createMaterial(
  input: MaterialInput & { target: MaterialTarget },
  profileId: string | null = null,
): Promise<void> {
  const t = input.target
  const { error } = await getSupabase()
    .from('materials')
    .insert({
      title: input.title.trim(),
      type: input.type,
      url: input.url.trim(),
      description: input.description.trim() === '' ? null : input.description.trim(),
      student_id: t.kind === 'aluno' ? t.studentId : null,
      lesson_id: t.kind === 'aula' ? t.lessonId : null,
      is_public_to_students: t.kind === 'geral',
      created_by: profileId,
    })
  if (error) fail(error, 'Não foi possível salvar o material.')
}

/** Edita só os dados do material; o alvo não muda (exclua e crie de novo para mudar). */
export async function updateMaterial(id: string, input: MaterialInput): Promise<void> {
  const { error } = await getSupabase()
    .from('materials')
    .update({
      title: input.title.trim(),
      type: input.type,
      url: input.url.trim(),
      description: input.description.trim() === '' ? null : input.description.trim(),
    })
    .eq('id', id)
  if (error) fail(error, 'Não foi possível salvar o material.')
}

export async function deleteMaterial(id: string): Promise<void> {
  const { error } = await getSupabase().from('materials').delete().eq('id', id)
  if (error) fail(error, 'Não foi possível excluir o material.')
}

/** Últimas ~20 aulas e as próximas do aluno, da mais recente para a mais antiga. */
export async function listStudentLessonsForPicker(
  studentId: string,
): Promise<PickerLesson[]> {
  const db = getSupabase()
  const now = new Date().toISOString()
  const [past, future] = await Promise.all([
    db
      .from('lessons')
      .select('id, starts_at, status')
      .eq('student_id', studentId)
      .lt('starts_at', now)
      .order('starts_at', { ascending: false })
      .limit(20),
    db
      .from('lessons')
      .select('id, starts_at, status')
      .eq('student_id', studentId)
      .gte('starts_at', now)
      .order('starts_at', { ascending: true })
      .limit(20),
  ])
  if (past.error) fail(past.error, 'Não foi possível carregar as aulas do aluno.')
  if (future.error) fail(future.error, 'Não foi possível carregar as aulas do aluno.')
  return [...future.data.slice().reverse(), ...past.data]
}
