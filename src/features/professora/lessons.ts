import {
  isActiveStatus,
  type Lesson,
  type LessonStatus,
  type StudentRecord,
  type Tone,
} from '@/features/aluno/lessons'
import { dayKey, formatTime } from '@/features/shared/datetime'
import { buildWhatsAppLink } from '@/lib/whatsapp'

import { whatsappNumber } from './validation'

export type StudentLite = Pick<StudentRecord, 'id' | 'full_name' | 'phone' | 'meet_link'>
export type LessonWithStudent = Lesson & { student: StudentLite | null }

const STATUS: Record<LessonStatus, { label: string; tone: Tone }> = {
  agendada: { label: 'Agendada', tone: 'info' },
  reposicao: { label: 'Reposição', tone: 'info' },
  realizada: { label: 'Realizada', tone: 'success' },
  falta_aluno: { label: 'Falta do aluno', tone: 'destructive' },
  cancelada_aluno: { label: 'Cancelada pelo aluno', tone: 'muted' },
  cancelada_professora: { label: 'Cancelada por mim', tone: 'warning' },
}

export function teacherStatusInfo(status: LessonStatus): { label: string; tone: Tone } {
  return STATUS[status]
}

/** Agrupa por dia civil no fuso, em ordem cronológica (dias e itens). */
export function groupByDay<T extends { starts_at: string }>(
  items: readonly T[],
  timezone: string,
): { key: string; items: T[] }[] {
  const sorted = [...items].sort(
    (a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime(),
  )
  const groups: { key: string; items: T[] }[] = []
  for (const item of sorted) {
    const key = dayKey(item.starts_at, timezone)
    const last = groups[groups.length - 1]
    if (last && last.key === key) last.items.push(item)
    else groups.push({ key, items: [item] })
  }
  return groups
}

/** Presença pode ser registrada (ou corrigida) em aulas ativas, realizadas ou com falta. */
export function canMarkAttendance(l: Pick<Lesson, 'status'>): boolean {
  return (
    isActiveStatus(l.status) || l.status === 'realizada' || l.status === 'falta_aluno'
  )
}

/** Cancelar: só aula ativa que ainda não começou (o banco confere de novo). */
export function canCancel(l: Pick<Lesson, 'status' | 'starts_at'>, now: Date): boolean {
  return isActiveStatus(l.status) && new Date(l.starts_at).getTime() > now.getTime()
}

/** Reposição: cancelada com direito a ela e que ainda não tem reposição agendada. */
export function canScheduleMakeup(
  l: Pick<Lesson, 'status' | 'makeup_eligible'>,
  hasMakeup: boolean,
): boolean {
  if (hasMakeup) return false
  if (l.status === 'cancelada_professora') return true
  return l.status === 'cancelada_aluno' && l.makeup_eligible === true
}

/** Cancelamento do aluno à espera da decisão "a critério". */
export function needsMakeupDecision(
  l: Pick<Lesson, 'status' | 'makeup_eligible'>,
): boolean {
  return l.status === 'cancelada_aluno' && l.makeup_eligible === null
}

export function reminderMessage(input: {
  name: string
  time: string
  meetLink: string | null
}): string {
  const first = input.name.trim().split(/\s+/)[0] || 'tudo bem'
  const base = `Oi, ${first}! Lembrete da nossa aula de inglês hoje às ${input.time}.`
  return input.meetLink ? `${base} Link: ${input.meetLink}` : base
}

/** Link do WhatsApp com o lembrete; null se o aluno não tem telefone válido. */
export function reminderLink(
  student: Pick<StudentLite, 'full_name' | 'phone'> | null,
  lesson: Pick<Lesson, 'starts_at'>,
  meetLink: string | null,
  timezone: string,
): string | null {
  if (!student) return null
  const number = whatsappNumber(student.phone)
  if (!number) return null
  return buildWhatsAppLink(
    number,
    reminderMessage({
      name: student.full_name,
      time: formatTime(lesson.starts_at, timezone),
      meetLink,
    }),
  )
}
