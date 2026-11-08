/**
 * Espelho PURO da regra de disponibilidade do banco (availability_minutes /
 * is_slot_available, migration 20261118000001). Sem React nem Supabase.
 * Minutos são locais ao fuso da professora: 0..1440, fim exclusivo ("24:00" = 1440).
 */
import {
  addDaysKey,
  parseDayKey,
  tzOffsetMs,
  weekdayOfKey,
} from '@/features/professora/tz'
import type { Tables } from '@/types/database'

import { HOLIDAY_REASON_PREFIX } from './holidays'

export type Range = readonly [start: number, end: number]

export type BlockedDate = Tables<'blocked_dates'>
export type AvailabilityException = Tables<'availability_exceptions'>

export type AvailabilityData = {
  patterns: Tables<'availability_patterns'>[]
  slots: Tables<'availability_slots'>[]
  exceptions: Tables<'availability_exceptions'>[]
  blocked: Tables<'blocked_dates'>[]
}

export type DayStatus =
  | 'disponivel'
  | 'parcial'
  | 'sem_horario'
  | 'fechado'
  | 'feriado'
  | 'ferias'
  | 'nao_configurado'

export type EffectiveDay = {
  ranges: Range[]
  status: DayStatus
  blocked: BlockedDate | null
  exceptions: AvailabilityException[]
  baseRanges: Range[]
}

export type SlotCheck = 'ok' | 'bloqueado' | 'fora_disponibilidade'

const DAY_MS = 86_400_000
const DAY_MINUTES = 1440

// ------------------------------------------------------------------ faixas

/** "HH:MM" ou "HH:MM:SS" => minutos ("24:00" = 1440); NaN se inválido. */
export function timeToMinute(time: string): number {
  const m = /^(\d{2}):(\d{2})(?::\d{2})?$/.exec(time)
  if (!m) return Number.NaN
  const h = Number(m[1])
  const min = Number(m[2])
  if (min > 59 || h > 24 || (h === 24 && min > 0)) return Number.NaN
  return h * 60 + min
}

/** Minutos => "HH:MM" (1440 => "24:00"). */
export function minuteToTime(n: number): string {
  const v = Math.max(0, Math.min(DAY_MINUTES, Math.round(n)))
  return `${String(Math.floor(v / 60)).padStart(2, '0')}:${String(v % 60).padStart(2, '0')}`
}

/** Ordena e funde faixas sobrepostas ou encostadas; descarta vazias/inválidas. */
export function normalizeRanges(ranges: readonly Range[]): Range[] {
  const valid = ranges
    .filter(([s, e]) => Number.isFinite(s) && Number.isFinite(e) && e > s)
    .map(([s, e]) => [s, e] as [number, number])
    .sort((a, b) => a[0] - b[0] || a[1] - b[1])
  const out: [number, number][] = []
  for (const [s, e] of valid) {
    const last = out[out.length - 1]
    if (last && s <= last[1]) last[1] = Math.max(last[1], e)
    else out.push([s, e])
  }
  return out
}

export function unionRanges(a: readonly Range[], b: readonly Range[]): Range[] {
  return normalizeRanges([...a, ...b])
}

/** a - b. */
export function subtractRanges(a: readonly Range[], b: readonly Range[]): Range[] {
  const cut = normalizeRanges(b)
  const out: Range[] = []
  for (const [s, e] of normalizeRanges(a)) {
    let cur = s
    for (const [cs, ce] of cut) {
      if (ce <= cur) continue
      if (cs >= e) break
      if (cs > cur) out.push([cur, cs])
      cur = Math.max(cur, ce)
      if (cur >= e) break
    }
    if (cur < e) out.push([cur, e])
  }
  return out
}

/** `inner` cabe inteira em uma das faixas. */
export function rangesContain(ranges: readonly Range[], inner: Range): boolean {
  const [s, e] = inner
  if (!(e > s)) return false
  return normalizeRanges(ranges).some(([rs, re]) => rs <= s && e <= re)
}

export function totalMinutes(ranges: readonly Range[]): number {
  return normalizeRanges(ranges).reduce((sum, [s, e]) => sum + (e - s), 0)
}

function rangesEqual(a: readonly Range[], b: readonly Range[]): boolean {
  const x = normalizeRanges(a)
  const y = normalizeRanges(b)
  return (
    x.length === y.length && x.every((r, i) => r[0] === y[i]?.[0] && r[1] === y[i]?.[1])
  )
}

function overlaps(a: Range, b: Range): boolean {
  return a[0] < b[1] && b[0] < a[1]
}

// ------------------------------------------------------------------ regra efetiva

function exceptionRanges(list: readonly AvailabilityException[]): Range[] {
  return normalizeRanges(
    list.flatMap((e): Range[] =>
      e.start_time === null || e.end_time === null
        ? []
        : [[timeToMinute(e.start_time), timeToMinute(e.end_time)]],
    ),
  )
}

function blockedOn(dateKey: string, data: AvailabilityData): BlockedDate | null {
  return data.blocked.find((b) => b.starts_on <= dateKey && dateKey <= b.ends_on) ?? null
}

export function effectiveDay(dateKey: string, data: AvailabilityData): EffectiveDay {
  const exceptions = data.exceptions.filter((e) => e.on_date === dateKey)
  const blocked = blockedOn(dateKey, data)
  const closed = exceptions.some((e) => e.kind === 'fechado')

  if (blocked || closed) {
    const holiday = blocked?.reason?.startsWith(HOLIDAY_REASON_PREFIX) ?? false
    const status: DayStatus = blocked ? (holiday ? 'feriado' : 'ferias') : 'fechado'
    return { ranges: [], status, blocked, exceptions, baseRanges: [] }
  }

  const replace = exceptions.filter((e) => e.kind === 'substituir')
  const extra = exceptions.filter((e) => e.kind === 'extra')
  const block = exceptions.filter((e) => e.kind === 'bloqueio')
  const activePatterns = data.patterns.filter((p) => p.active)
  const unconfigured = replace.length === 0 && activePatterns.length === 0

  let base: Range[]
  if (replace.length > 0) {
    base = exceptionRanges(replace)
  } else if (activePatterns.length === 0) {
    base = [[0, DAY_MINUTES]]
  } else {
    const weekday = weekdayOfKey(dateKey)
    const valid = new Set(
      activePatterns
        .filter(
          (p) => p.starts_on <= dateKey && (p.ends_on === null || dateKey <= p.ends_on),
        )
        .map((p) => p.id),
    )
    base = normalizeRanges(
      data.slots
        .filter((s) => s.active && s.weekday === weekday && valid.has(s.pattern_id))
        .map((s): Range => [timeToMinute(s.start_time), timeToMinute(s.end_time)]),
    )
  }

  const ranges = subtractRanges(
    unionRanges(base, exceptionRanges(extra)),
    exceptionRanges(block),
  )

  let status: DayStatus
  if (ranges.length === 0) status = 'sem_horario'
  else if (unconfigured && block.length === 0) status = 'nao_configurado'
  else if (replace.length > 0 || block.length > 0) status = 'parcial'
  else status = 'disponivel'

  return { ranges, status, blocked: null, exceptions, baseRanges: base }
}

// ------------------------------------------------------------------ fuso

/** Data e minuto locais de um instante no fuso. */
export function localParts(
  instant: Date | string,
  tz: string,
): { dateKey: string; minute: number } {
  const ms = (typeof instant === 'string' ? new Date(instant) : instant).getTime()
  const wall = ms + tzOffsetMs(ms, tz)
  const dayStart = Math.floor(wall / DAY_MS) * DAY_MS
  return {
    dateKey: new Date(dayStart).toISOString().slice(0, 10),
    minute: Math.floor((wall - dayStart) / 60_000),
  }
}

export function isSlotAvailable(
  startsAtIso: string,
  durationMin: number,
  data: AvailabilityData,
  tz: string,
): SlotCheck {
  const { dateKey, minute } = localParts(startsAtIso, tz)
  if (
    blockedOn(dateKey, data) ||
    data.exceptions.some((e) => e.on_date === dateKey && e.kind === 'fechado')
  ) {
    return 'bloqueado'
  }
  if (!(durationMin > 0) || minute + durationMin > DAY_MINUTES)
    return 'fora_disponibilidade'
  return rangesContain(effectiveDay(dateKey, data).ranges, [minute, minute + durationMin])
    ? 'ok'
    : 'fora_disponibilidade'
}

// ------------------------------------------------------------------ aulas afetadas

type LessonLike = { starts_at: string; duration_minutes: number; status: string }

/** Data local e faixa de minutos da aula (o fim pode passar de 1440 se atravessar a meia-noite). */
export function lessonLocalRange(
  lesson: Pick<LessonLike, 'starts_at' | 'duration_minutes'>,
  tz: string,
): { dateKey: string; range: Range } {
  const { dateKey, minute } = localParts(lesson.starts_at, tz)
  return { dateKey, range: [minute, minute + lesson.duration_minutes] }
}

/** Aulas agendadas/reposição do dia local que se sobrepõem ao horário removido. */
export function affectedLessons<T extends LessonLike>(
  lessons: readonly T[],
  dateKey: string,
  removed: readonly Range[] | 'all',
  tz: string,
): T[] {
  return lessons.filter((l) => {
    if (l.status !== 'agendada' && l.status !== 'reposicao') return false
    const local = lessonLocalRange(l, tz)
    if (local.dateKey !== dateKey) return false
    return removed === 'all' || removed.some((r) => overlaps(r, local.range))
  })
}

// ------------------------------------------------------------------ prévia

export const MAX_PREVIEW_DAYS = 400

export type DayChange = { dateKey: string; before: Range[]; after: Range[] }

/** Dias entre fromKey e toKey (inclusive, até 400) cuja disponibilidade muda. */
export function previewChanges(
  before: AvailabilityData,
  after: AvailabilityData,
  fromKey: string,
  toKey: string,
): DayChange[] {
  const out: DayChange[] = []
  if (!parseDayKey(fromKey) || !parseDayKey(toKey)) return out
  let key = fromKey
  for (let i = 0; i < MAX_PREVIEW_DAYS && key <= toKey; i++) {
    const b = effectiveDay(key, before).ranges
    const a = effectiveDay(key, after).ranges
    if (!rangesEqual(b, a)) out.push({ dateKey: key, before: b, after: a })
    key = addDaysKey(key, 1)
  }
  return out
}

// ------------------------------------------------------------------ grade

/** Domingo..sábado da semana de `anyKey`. */
export function weekKeys(anyKey: string): string[] {
  const sunday = addDaysKey(anyKey, -weekdayOfKey(anyKey))
  return Array.from({ length: 7 }, (_, i) => addDaysKey(sunday, i))
}

/** Semanas (domingo..sábado) que cobrem o mês, com dias dos meses vizinhos. */
export function monthGrid(year: number, month1to12: number): string[][] {
  const first = `${String(year).padStart(4, '0')}-${String(month1to12).padStart(2, '0')}-01`
  const lastDay = new Date(Date.UTC(year, month1to12, 0)).getUTCDate()
  const last = addDaysKey(first, lastDay - 1)
  const weeks: string[][] = []
  let week = weekKeys(first)
  for (;;) {
    weeks.push(week)
    const end = week[6] ?? last
    if (end >= last) break
    week = weekKeys(addDaysKey(end, 1))
  }
  return weeks
}
