/** Lógica pura dos formulários de aula avulsa / remarcação / reposição. */
import { localToUtc } from '@/features/professora/tz'

import { effectiveDay, isSlotAvailable, type AvailabilityData } from './engine'

export const DEFAULT_LESSON_MINUTES = 60
export const MIN_LESSON_MINUTES = 5
export const MAX_LESSON_MINUTES = 480

/** Duração padrão: a do padrão ativo vigente na data, senão 60. */
export function defaultLessonMinutes(
  dateKey: string,
  data: Pick<AvailabilityData, 'patterns'> | undefined,
): number {
  const p = data?.patterns.find(
    (x) =>
      x.active && x.starts_on <= dateKey && (x.ends_on === null || dateKey <= x.ends_on),
  )
  return p && p.default_lesson_minutes > 0
    ? p.default_lesson_minutes
    : DEFAULT_LESSON_MINUTES
}

/** Duração em minutos a partir do texto do campo; null se inválida. */
export function parseDuration(text: string): number | null {
  if (!/^\d+$/.test(text.trim())) return null
  const n = Number(text)
  return n >= MIN_LESSON_MINUTES && n <= MAX_LESSON_MINUTES ? n : null
}

export type SlotChoice = { ok: true; startsAt: string } | { ok: false; error: string }

export const SLOT_MESSAGES = {
  invalid: 'Data ou hora inválida para o fuso configurado.',
  duration: `A duração deve ser de ${MIN_LESSON_MINUTES} a ${MAX_LESSON_MINUTES} minutos.`,
  past: 'A aula precisa ser em uma data e hora futuras.',
  blocked: 'Essa data cai em férias, feriado ou dia fechado. Escolha outro dia.',
  outside:
    'Esse horário está fora da sua disponibilidade. Escolha um dos horários sugeridos ou ajuste o horário do dia.',
} as const

/**
 * Valida data/hora/duração escolhidas. `data` indefinida (não carregou) pula só a checagem
 * de disponibilidade: o banco valida de novo de qualquer forma.
 */
export function validateSlotChoice(input: {
  dateKey: string
  time: string
  durationMin: number | null
  data: AvailabilityData | undefined
  timezone: string
  now?: Date
}): SlotChoice {
  const { dateKey, time, durationMin, data, timezone } = input
  if (durationMin === null) return { ok: false, error: SLOT_MESSAGES.duration }
  const utc = time ? localToUtc(dateKey, time, timezone) : null
  if (!utc) return { ok: false, error: SLOT_MESSAGES.invalid }
  if (utc.getTime() <= (input.now ?? new Date()).getTime()) {
    return { ok: false, error: SLOT_MESSAGES.past }
  }
  const startsAt = utc.toISOString()
  if (data) {
    const res = isSlotAvailable(startsAt, durationMin, data, timezone)
    if (res === 'bloqueado') return { ok: false, error: SLOT_MESSAGES.blocked }
    if (res === 'fora_disponibilidade') return { ok: false, error: SLOT_MESSAGES.outside }
  }
  return { ok: true, startsAt }
}

/** O dia está fechado por férias/feriado/fechamento? */
export function dayIsClosed(dateKey: string, data: AvailabilityData): boolean {
  const s = effectiveDay(dateKey, data).status
  return s === 'fechado' || s === 'feriado' || s === 'ferias'
}
