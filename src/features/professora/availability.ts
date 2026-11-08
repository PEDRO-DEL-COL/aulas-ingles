/** Lógica pura da disponibilidade da professora (faixas semanais para reposições). */
import { parseDayKey, weekdayOfKey } from './tz'

export type SlotLike = {
  weekday: number
  /** "HH:MM" ou "HH:MM:SS" no fuso da professora. */
  start_time: string
  end_time: string
  active: boolean
}

export type SlotFormValues = {
  weekday: string
  start_time: string
  end_time: string
  notes: string
}

export type SlotFormErrors = Partial<Record<keyof SlotFormValues, string>>

export const WEEKDAY_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'] as const

const TIME_RE = /^(\d{2}):(\d{2})(?::\d{2})?$/

/** "08:30" ou "08:30:00" => minutos desde 00:00, ou null se inválido. */
export function timeToMinutes(time: string): number | null {
  const m = TIME_RE.exec(time)
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (h > 23 || min > 59) return null
  return h * 60 + min
}

/** "08:30:00" => "08:30". */
export function trimTime(time: string): string {
  return time.slice(0, 5)
}

export function validateSlotForm(v: SlotFormValues): SlotFormErrors {
  const errors: SlotFormErrors = {}
  const wd = Number(v.weekday)
  if (v.weekday === '' || !Number.isInteger(wd) || wd < 0 || wd > 6)
    errors.weekday = 'Escolha o dia da semana.'
  const start = timeToMinutes(v.start_time)
  const end = timeToMinutes(v.end_time)
  if (v.start_time === '') errors.start_time = 'Informe a hora de início.'
  else if (start === null) errors.start_time = 'Hora de início inválida (use HH:MM).'
  if (v.end_time === '') errors.end_time = 'Informe a hora de fim.'
  else if (end === null) errors.end_time = 'Hora de fim inválida (use HH:MM).'
  if (start !== null && end !== null && start >= end)
    errors.end_time = 'O fim precisa ser depois do início.'
  if (v.notes.trim().length > 200) errors.notes = 'Use até 200 caracteres.'
  return errors
}

function byTime<T extends SlotLike>(a: T, b: T): number {
  return (timeToMinutes(a.start_time) ?? 0) - (timeToMinutes(b.start_time) ?? 0)
}

/** Índice 0..6 (domingo a sábado), faixas ordenadas por início. */
export function groupSlotsByWeekday<T extends SlotLike>(slots: readonly T[]): T[][] {
  const groups: T[][] = Array.from({ length: 7 }, () => [])
  for (const s of slots) groups[s.weekday]?.push(s)
  for (const g of groups) g.sort(byTime)
  return groups
}

/** Pares de faixas ATIVAS do mesmo dia que se sobrepõem (aviso, não erro). */
export function findOverlaps<T extends SlotLike>(slots: readonly T[]): [T, T][] {
  const result: [T, T][] = []
  for (const group of groupSlotsByWeekday(slots.filter((s) => s.active))) {
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const a = group[i]!
        const b = group[j]!
        const aEnd = timeToMinutes(a.end_time) ?? 0
        const bStart = timeToMinutes(b.start_time) ?? 0
        if (bStart < aEnd) result.push([a, b])
      }
    }
  }
  return result
}

/** "08:00–12:00". */
export function formatRange(slot: Pick<SlotLike, 'start_time' | 'end_time'>): string {
  return `${trimTime(slot.start_time)}–${trimTime(slot.end_time)}`
}

/** "Seg 08:00–12:00". */
export function formatSlot(slot: SlotLike): string {
  return `${WEEKDAY_SHORT[slot.weekday] ?? '?'} ${formatRange(slot)}`
}

/** Faixas ativas que valem na data civil (AAAA-MM-DD), ordenadas. */
export function slotsForDate<T extends SlotLike>(
  dateKey: string,
  slots: readonly T[],
): T[] {
  if (!parseDayKey(dateKey)) return []
  const wd = weekdayOfKey(dateKey)
  return slots.filter((s) => s.active && s.weekday === wd).sort(byTime)
}

/**
 * Espelha o banco: a aula inteira (início + duração) cabe numa faixa ativa do dia.
 * Sem nenhuma faixa ativa cadastrada, qualquer horário vale (só férias/feriados restringem).
 */
export function fitsInSlots(
  dateKey: string,
  time: string,
  durationMin: number,
  slots: readonly SlotLike[],
): boolean {
  if (!slots.some((s) => s.active)) return true
  const start = timeToMinutes(time)
  if (start === null) return false
  const end = start + durationMin
  return slotsForDate(dateKey, slots).some((s) => {
    const a = timeToMinutes(s.start_time)
    const b = timeToMinutes(s.end_time)
    return a !== null && b !== null && start >= a && end <= b
  })
}
