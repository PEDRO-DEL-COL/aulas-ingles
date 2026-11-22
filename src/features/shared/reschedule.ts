import { formatDateTime, formatDateTimeLong } from './datetime'

interface RescheduleInfo {
  original_starts_at: string | null
  starts_at: string
}

/** Nota para a professora quando a aula foi remarcada; null se nunca foi. */
export function rescheduleNote(lesson: RescheduleInfo, tz: string): string | null {
  if (!lesson.original_starts_at) return null
  const original = formatDateTimeLong(lesson.original_starts_at, tz)
  if (!original) return null
  return `Remarcada — horário original: ${original}`
}

/** Nota curta para o aluno; null se a aula nunca foi remarcada. */
export function rescheduleNoteForStudent(
  lesson: RescheduleInfo,
  tz: string,
): string | null {
  if (!lesson.original_starts_at) return null
  const original = formatDateTime(lesson.original_starts_at, tz)
  if (!original) return null
  return `Remarcada (era ${original})`
}
