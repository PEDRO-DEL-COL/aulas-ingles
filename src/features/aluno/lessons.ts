import { addMinutes, subMinutes } from 'date-fns'

import type { Tables } from '@/types/database'

export type Lesson = Tables<'lessons'>
export type LessonStatus = Lesson['status']
export type Settings = Tables<'settings'>
export type StudentRecord = Tables<'students'>
export type Tone = 'success' | 'warning' | 'destructive' | 'info' | 'muted'

/** Antecedência em que o botão "Entrar na aula" é liberado. */
export const JOIN_EARLY_MINUTES = 15

export function lessonEnd(lesson: Pick<Lesson, 'starts_at' | 'duration_minutes'>): Date {
  return addMinutes(new Date(lesson.starts_at), lesson.duration_minutes)
}

/** Aula ativa: pode acontecer (agendada ou reposição). */
export function isActiveStatus(status: LessonStatus): boolean {
  return status === 'agendada' || status === 'reposicao'
}

/** Aula que ainda pode ser cancelada pelo aluno (ativa e ainda não começou). */
export function canStudentCancel(
  lesson: Pick<Lesson, 'status' | 'starts_at'>,
  now: Date,
): boolean {
  return (
    isActiveStatus(lesson.status) && new Date(lesson.starts_at).getTime() > now.getTime()
  )
}

export type JoinState = 'before' | 'open' | 'ended'

/** before = antes dos 15 min; open = de 15 min antes até o fim; ended = depois do fim. */
export function joinWindowState(
  lesson: Pick<Lesson, 'starts_at' | 'duration_minutes'>,
  now: Date,
): JoinState {
  const opens = subMinutes(new Date(lesson.starts_at), JOIN_EARLY_MINUTES)
  if (now.getTime() < opens.getTime()) return 'before'
  if (now.getTime() < lessonEnd(lesson).getTime()) return 'open'
  return 'ended'
}

/** Link da aula; cai para o link fixo da ficha. Vazio vira null. */
export function resolveMeetLink(
  lesson: Pick<Lesson, 'meet_link'>,
  student: Pick<StudentRecord, 'meet_link'> | null | undefined,
): string | null {
  const link = lesson.meet_link?.trim() || student?.meet_link?.trim() || ''
  return link === '' ? null : link
}

/** Só permite http(s) ao abrir links vindos do banco. */
export function safeExternalUrl(url: string | null | undefined): string | null {
  if (!url) return null
  try {
    const u = new URL(url.trim())
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : null
  } catch {
    return null
  }
}

export type CancelPreview = 'com_reposicao' | 'a_criterio' | 'sem_reposicao'

/**
 * Prévia (APENAS para exibir o aviso): a regra real é calculada pelo banco.
 * Espelha lessons_cancellation_rules: antecedência >= mínimo => com reposição;
 * faixa intermediária ligada e antecedência >= mínimo da faixa => a critério;
 * senão sem reposição.
 */
export function previewCancellation(
  now: Date,
  startsAt: string | Date,
  settings: Pick<
    Settings,
    'cancellation_min_hours' | 'late_cancel_band_enabled' | 'late_cancel_band_min_hours'
  >,
): CancelPreview {
  const start = typeof startsAt === 'string' ? new Date(startsAt) : startsAt
  const advanceMs = start.getTime() - now.getTime()
  const HOUR = 3_600_000
  if (advanceMs >= settings.cancellation_min_hours * HOUR) return 'com_reposicao'
  if (
    settings.late_cancel_band_enabled &&
    advanceMs >= settings.late_cancel_band_min_hours * HOUR
  ) {
    return 'a_criterio'
  }
  return 'sem_reposicao'
}

/** Primeira aula ativa (agendada/reposição) cujo fim é depois de `now`. */
export function pickNextLesson<T extends Lesson>(
  lessons: readonly T[],
  now: Date,
): T | null {
  let best: T | null = null
  for (const l of lessons) {
    if (!isActiveStatus(l.status)) continue
    if (lessonEnd(l).getTime() <= now.getTime()) continue
    if (!best || new Date(l.starts_at).getTime() < new Date(best.starts_at).getTime()) {
      best = l
    }
  }
  return best
}

const LESSON_STATUS: Record<LessonStatus, { label: string; tone: Tone }> = {
  agendada: { label: 'Agendada', tone: 'info' },
  reposicao: { label: 'Reposição', tone: 'info' },
  realizada: { label: 'Realizada', tone: 'success' },
  falta_aluno: { label: 'Falta', tone: 'destructive' },
  cancelada_aluno: { label: 'Cancelada por você', tone: 'muted' },
  cancelada_professora: { label: 'Cancelada pela professora', tone: 'warning' },
}

export function lessonStatusInfo(status: LessonStatus): { label: string; tone: Tone } {
  return LESSON_STATUS[status]
}

/** Texto sobre reposição de uma aula cancelada; null quando não se aplica. */
export function makeupText(
  lesson: Pick<Lesson, 'status' | 'makeup_eligible'>,
): string | null {
  if (lesson.status === 'cancelada_professora') return 'Você tem direito a reposição.'
  if (lesson.status === 'cancelada_aluno') {
    if (lesson.makeup_eligible === true) return 'Você tem direito a reposição.'
    if (lesson.makeup_eligible === false) return 'Sem direito a reposição.'
    return 'Reposição a critério da professora.'
  }
  return null
}

/** Aviso da prévia, mostrado antes de confirmar o cancelamento. */
export function previewMessage(preview: CancelPreview, minHours: number): string {
  switch (preview) {
    case 'com_reposicao':
      return 'Cancelando agora você TERÁ direito a reposição.'
    case 'a_criterio':
      return `Faltam menos de ${minHours} h para a aula: a reposição ficará a critério da professora.`
    case 'sem_reposicao':
      return `Faltam menos de ${minHours} h para a aula: você NÃO terá direito a reposição.`
  }
}
