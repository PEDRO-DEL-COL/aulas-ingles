/**
 * Pré-visualização da área do aluno por um admin ("Ver como" > Aluno).
 * Lógica pura: decide o modo da área e monta filtros explícitos por aluno.
 */
import type { StudentRecord } from './lessons'

export type AlunoMode = 'aluno' | 'preview-sem-aluno' | 'preview'

export const PREVIEW_UNAVAILABLE = 'Indisponível na pré-visualização'

/**
 * 'aluno': aluno de verdade (ficha pelo próprio perfil).
 * 'preview-sem-aluno': admin vendo como aluno, ainda sem escolher quem.
 * 'preview': admin vendo como aluno com um aluno escolhido (somente leitura).
 */
export function decideAlunoMode(opts: {
  canViewAs: boolean
  role: string | undefined
  previewStudentId: string | null
}): AlunoMode {
  if (!(opts.canViewAs && opts.role === 'aluno')) return 'aluno'
  return opts.previewStudentId ? 'preview' : 'preview-sem-aluno'
}

/**
 * Filtro PostgREST (`.or(...)`) dos materiais que o aluno enxerga:
 * do aluno, de aulas dele ou públicos para todos os alunos.
 * Ids são UUIDs vindos do banco; qualquer outra coisa é descartada.
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function materialsOrFilter(
  studentId: string,
  lessonIds: readonly string[],
): string {
  if (!UUID_RE.test(studentId)) throw new Error('Aluno inválido.')
  const parts = [`student_id.eq.${studentId}`, 'is_public_to_students.eq.true']
  const ids = lessonIds.filter((id) => UUID_RE.test(id))
  if (ids.length > 0) parts.push(`lesson_id.in.(${ids.join(',')})`)
  return parts.join(',')
}

export type StudentOption = Pick<StudentRecord, 'id' | 'full_name' | 'email' | 'status'>

function norm(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

/** Busca simples por nome ou e-mail, sem acento e sem diferenciar maiúsculas. */
export function filterStudents<T extends Pick<StudentOption, 'full_name' | 'email'>>(
  students: readonly T[],
  query: string,
): T[] {
  const q = norm(query.trim())
  if (!q) return [...students]
  return students.filter((s) => norm(`${s.full_name} ${s.email}`).includes(q))
}

export const STATUS_LABEL: Record<StudentOption['status'], string> = {
  ativo: 'Ativo',
  pausado: 'Pausado',
  saiu: 'Saiu',
}
