/**
 * Lógica pura do assistente "Definir horário padrão": estado do formulário, validação,
 * conversão de/para faixas do banco, resumo em texto e simulação para a prévia.
 */
import { formatDateOnly } from '@/features/shared/datetime'
import { addDaysKey, parseDayKey } from '@/features/professora/tz'
import type { Tables } from '@/types/database'

import type { PatternInput, PatternSlotInput } from './api'
import {
  effectiveDay,
  isSlotAvailable,
  minuteToTime,
  normalizeRanges,
  subtractRanges,
  timeToMinute,
  totalMinutes,
  type AvailabilityData,
  type Range,
} from './engine'

export type TimeBlock = { start: string; end: string }

export type WizardState = {
  name: string
  /** 0 = domingo ... 6 = sábado */
  weekdays: number[]
  start: string
  end: string
  breaks: TimeBlock[]
  /** "Horários diferentes por dia": usa `dayBlocks` em vez de start/end/breaks. */
  advanced: boolean
  dayBlocks: Record<number, TimeBlock[]>
  lessonMinutes: number
  startsOn: string
  /** '' = sem data de fim */
  endsOn: string
}

export type WizardErrors = {
  weekdays?: string
  /** Modo simples: mensagens do horário/intervalos. */
  time?: string[]
  /** Modo avançado: mensagens por dia da semana. */
  days?: Record<number, string[]>
  lessonMinutes?: string
  startsOn?: string
  endsOn?: string
}

export const DEFAULT_PATTERN_NAME = 'Horário padrão'
export const LESSON_DURATION_PRESETS = [30, 45, 50, 60, 90] as const
export const MIN_LESSON_MINUTES = 10
export const MAX_LESSON_MINUTES = 480

/** Ordem de exibição: segunda a domingo (valores 0 = domingo ... 6 = sábado). */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0] as const
export const WEEKDAY_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'] as const
export const WEEKDAYS_MON_FRI = [1, 2, 3, 4, 5]
export const WEEKDAYS_MON_SAT = [1, 2, 3, 4, 5, 6]

export function defaultWizardState(todayKey: string): WizardState {
  return {
    name: DEFAULT_PATTERN_NAME,
    weekdays: [...WEEKDAYS_MON_FRI],
    start: '09:00',
    end: '17:00',
    breaks: [],
    advanced: false,
    dayBlocks: {},
    lessonMinutes: 60,
    startsOn: todayKey,
    endsOn: '',
  }
}

// ------------------------------------------------------------------ faixas de um dia

function sortedWeekdays(days: readonly number[]): number[] {
  return WEEK_ORDER.filter((d) => days.includes(d))
}

function blockRange(b: TimeBlock): Range {
  return [timeToMinute(b.start), timeToMinute(b.end)]
}

/** Mensagens de erro de um horário com intervalos (vazio = válido). */
export function validateDayInput(
  start: string,
  end: string,
  breaks: readonly TimeBlock[],
): string[] {
  const s = timeToMinute(start)
  const e = timeToMinute(end)
  if (Number.isNaN(s) || Number.isNaN(e)) return ['Informe o horário de início e de fim.']
  if (e <= s) return ['O horário de fim precisa ser depois do início.']
  const errors: string[] = []
  const valid: { r: Range; label: string }[] = []
  breaks.forEach((b, i) => {
    const label = `Intervalo ${i + 1}`
    const [bs, be] = blockRange(b)
    if (bs === undefined || be === undefined || Number.isNaN(bs) || Number.isNaN(be)) {
      errors.push(`${label}: informe o início e o fim.`)
    } else if (be <= bs) {
      errors.push(`${label}: o fim precisa ser depois do início.`)
    } else if (bs < s || be > e) {
      errors.push(
        `${label}: precisa ficar dentro do horário (${minuteToTime(s)}–${minuteToTime(e)}).`,
      )
    } else {
      valid.push({ r: [bs, be], label })
    }
  })
  const byStart = [...valid].sort((a, b) => a.r[0] - b.r[0])
  for (let i = 1; i < byStart.length; i++) {
    const prev = byStart[i - 1]
    const cur = byStart[i]
    if (prev && cur && cur.r[0] < prev.r[1]) {
      errors.push(`${prev.label} e ${cur.label} se sobrepõem.`)
    }
  }
  if (
    errors.length === 0 &&
    totalMinutes(subtractRanges([[s, e]], toRanges(breaks))) <= 0
  ) {
    errors.push('Os intervalos ocupam todo o horário.')
  }
  return errors
}

function toRanges(blocks: readonly TimeBlock[]): Range[] {
  return blocks.map(blockRange)
}

/** Faixas do dia (início–fim menos intervalos). Vazio se algo for inválido. */
export function buildDayRanges(
  start: string,
  end: string,
  breaks: readonly TimeBlock[],
): Range[] {
  if (validateDayInput(start, end, breaks).length > 0) return []
  return subtractRanges([[timeToMinute(start), timeToMinute(end)]], toRanges(breaks))
}

/** Erros de uma lista de blocos livres (modo "por dia"). */
export function validateBlocks(blocks: readonly TimeBlock[]): string[] {
  if (blocks.length === 0) return ['Adicione ao menos uma faixa de horário.']
  const errors: string[] = []
  const valid: { r: Range; label: string }[] = []
  blocks.forEach((b, i) => {
    const label = `Faixa ${i + 1}`
    const [s, e] = blockRange(b)
    if (s === undefined || e === undefined || Number.isNaN(s) || Number.isNaN(e)) {
      errors.push(`${label}: informe o início e o fim.`)
    } else if (e <= s) {
      errors.push(`${label}: o fim precisa ser depois do início.`)
    } else {
      valid.push({ r: [s, e], label })
    }
  })
  const byStart = [...valid].sort((a, b) => a.r[0] - b.r[0])
  for (let i = 1; i < byStart.length; i++) {
    const prev = byStart[i - 1]
    const cur = byStart[i]
    if (prev && cur && cur.r[0] < prev.r[1]) {
      errors.push(`${prev.label} e ${cur.label} se sobrepõem.`)
    }
  }
  return errors
}

/** Faixas de um dia da semana conforme o modo do estado. */
export function rangesOfWeekday(state: WizardState, weekday: number): Range[] {
  if (!state.weekdays.includes(weekday)) return []
  if (!state.advanced) return buildDayRanges(state.start, state.end, state.breaks)
  const blocks = state.dayBlocks[weekday] ?? []
  return validateBlocks(blocks).length > 0 ? [] : normalizeRanges(toRanges(blocks))
}

// ------------------------------------------------------------------ validação

export function validateWizard(state: WizardState): WizardErrors {
  const errors: WizardErrors = {}
  if (state.weekdays.length === 0) errors.weekdays = 'Escolha ao menos um dia da semana.'

  if (state.advanced) {
    const days: Record<number, string[]> = {}
    for (const d of sortedWeekdays(state.weekdays)) {
      const list = validateBlocks(state.dayBlocks[d] ?? [])
      if (list.length > 0) days[d] = list
    }
    if (Object.keys(days).length > 0) errors.days = days
  } else {
    const list = validateDayInput(state.start, state.end, state.breaks)
    if (list.length > 0) errors.time = list
  }

  const minutes = state.lessonMinutes
  if (!Number.isInteger(minutes) || minutes < MIN_LESSON_MINUTES) {
    errors.lessonMinutes = `Informe uma duração de ${MIN_LESSON_MINUTES} a ${MAX_LESSON_MINUTES} minutos.`
  } else if (minutes > MAX_LESSON_MINUTES) {
    errors.lessonMinutes = `A duração máxima é ${MAX_LESSON_MINUTES} minutos.`
  } else if (!errors.time && !errors.days && !errors.weekdays) {
    const longest = Math.max(
      0,
      ...state.weekdays.flatMap((d) => rangesOfWeekday(state, d).map(([s, e]) => e - s)),
    )
    if (longest < minutes) {
      errors.lessonMinutes = `Nenhuma faixa comporta uma aula de ${minutes} min. Aumente o horário ou reduza a duração.`
    }
  }

  if (state.startsOn === '') errors.startsOn = 'Informe a data de início.'
  else if (!parseDayKey(state.startsOn)) errors.startsOn = 'Data de início inválida.'
  if (state.endsOn !== '') {
    if (!parseDayKey(state.endsOn)) errors.endsOn = 'Data de fim inválida.'
    else if (!errors.startsOn && state.endsOn < state.startsOn)
      errors.endsOn = 'O fim não pode ser antes do início.'
  }
  return errors
}

export function hasWizardErrors(errors: WizardErrors): boolean {
  return Object.keys(errors).length > 0
}

/** Passos: 0 dias, 1 horário, 2 duração e vigência. */
export function stepHasErrors(errors: WizardErrors, step: number): boolean {
  if (step === 0) return errors.weekdays !== undefined
  if (step === 1) return errors.time !== undefined || errors.days !== undefined
  if (step === 2)
    return (
      errors.lessonMinutes !== undefined ||
      errors.startsOn !== undefined ||
      errors.endsOn !== undefined
    )
  return false
}

// ------------------------------------------------------------------ estado <-> banco

export function slotsFromWizard(state: WizardState): PatternSlotInput[] {
  const out: PatternSlotInput[] = []
  for (const weekday of sortedWeekdays(state.weekdays)) {
    for (const [s, e] of rangesOfWeekday(state, weekday)) {
      out.push({ weekday, start_time: minuteToTime(s), end_time: minuteToTime(e) })
    }
  }
  return out
}

export function patternInputFromWizard(state: WizardState): PatternInput {
  return {
    name: state.name.trim() || DEFAULT_PATTERN_NAME,
    starts_on: state.startsOn,
    ends_on: state.endsOn === '' ? null : state.endsOn,
    default_lesson_minutes: state.lessonMinutes,
    active: true,
  }
}

function rangesKey(ranges: readonly Range[]): string {
  return ranges.map(([s, e]) => `${s}-${e}`).join(',')
}

export type DayGroup = { weekdays: number[]; ranges: Range[] }

/** Agrupa os dias selecionados que têm exatamente as mesmas faixas. */
export function groupDaysByRanges(state: WizardState): DayGroup[] {
  const map = new Map<string, DayGroup>()
  for (const d of sortedWeekdays(state.weekdays)) {
    const ranges = rangesOfWeekday(state, d)
    const key = rangesKey(ranges)
    const group = map.get(key)
    if (group) group.weekdays.push(d)
    else map.set(key, { weekdays: [d], ranges })
  }
  return [...map.values()]
}

function blockFromRange([s, e]: Range): TimeBlock {
  return { start: minuteToTime(s), end: minuteToTime(e) }
}

/** Reconstrói o estado do assistente a partir de um padrão salvo e de suas faixas. */
export function wizardFromPattern(
  pattern: Tables<'availability_patterns'>,
  slots: readonly Tables<'availability_slots'>[],
): WizardState {
  const base = defaultWizardState(pattern.starts_on)
  const byDay = new Map<number, Range[]>()
  for (const s of slots) {
    if (s.pattern_id !== pattern.id || !s.active) continue
    const list = byDay.get(s.weekday) ?? []
    list.push([timeToMinute(s.start_time), timeToMinute(s.end_time)])
    byDay.set(s.weekday, list)
  }
  const days = new Map<number, Range[]>()
  for (const [d, list] of byDay) days.set(d, normalizeRanges(list))

  const groups = new Map<string, { weekdays: number[]; ranges: Range[] }>()
  for (const d of WEEK_ORDER) {
    const ranges = days.get(d)
    if (!ranges || ranges.length === 0) continue
    const key = rangesKey(ranges)
    const g = groups.get(key)
    if (g) g.weekdays.push(d)
    else groups.set(key, { weekdays: [d], ranges })
  }

  const common = {
    ...base,
    name: pattern.name,
    lessonMinutes: pattern.default_lesson_minutes,
    startsOn: pattern.starts_on,
    endsOn: pattern.ends_on ?? '',
  }
  const list = [...groups.values()]
  const first = list[0]
  if (!first) return { ...common, weekdays: [] }
  const weekdays = list.flatMap((g) => g.weekdays)

  if (list.length === 1) {
    const ranges = first.ranges
    const head = ranges[0]
    const tail = ranges[ranges.length - 1]
    const breaks: TimeBlock[] = []
    for (let i = 1; i < ranges.length; i++) {
      const prev = ranges[i - 1]
      const cur = ranges[i]
      if (prev && cur) breaks.push(blockFromRange([prev[1], cur[0]]))
    }
    return {
      ...common,
      weekdays,
      start: head ? minuteToTime(head[0]) : base.start,
      end: tail ? minuteToTime(tail[1]) : base.end,
      breaks,
    }
  }

  const dayBlocks: Record<number, TimeBlock[]> = {}
  for (const g of list)
    for (const d of g.weekdays) dayBlocks[d] = g.ranges.map(blockFromRange)
  return { ...common, weekdays, advanced: true, dayBlocks }
}

/** Ao ligar "horários diferentes por dia": copia o horário simples para cada dia marcado. */
export function toAdvanced(state: WizardState): WizardState {
  const blocks = blocksOfSimple(state)
  const dayBlocks: Record<number, TimeBlock[]> = { ...state.dayBlocks }
  for (const d of state.weekdays) {
    if (!dayBlocks[d]) dayBlocks[d] = blocks.map((b) => ({ ...b }))
  }
  return { ...state, advanced: true, dayBlocks }
}

function blocksOfSimple(state: WizardState): TimeBlock[] {
  const ranges = buildDayRanges(state.start, state.end, state.breaks)
  return ranges.length > 0
    ? ranges.map(blockFromRange)
    : [{ start: state.start, end: state.end }]
}

// ------------------------------------------------------------------ resumo

function joinList(items: readonly string[]): string {
  if (items.length <= 1) return items.join('')
  return `${items.slice(0, -1).join(', ')} e ${items[items.length - 1] ?? ''}`
}

/** "Seg a Sex", "Seg, Qua e Sex", "Seg e Ter". */
export function formatWeekdays(days: readonly number[]): string {
  const ordered = WEEK_ORDER.filter((d) => days.includes(d))
  const runs: number[][] = []
  let run: number[] = []
  let prevIndex = -2
  for (const d of ordered) {
    const idx = WEEK_ORDER.indexOf(d)
    if (idx === prevIndex + 1) run.push(d)
    else {
      if (run.length > 0) runs.push(run)
      run = [d]
    }
    prevIndex = idx
  }
  if (run.length > 0) runs.push(run)
  const label = (d: number | undefined) => WEEKDAY_SHORT[d ?? 0] ?? ''
  const parts = runs.map((r) => {
    if (r.length >= 3) return `${label(r[0])} a ${label(r[r.length - 1])}`
    return joinList(r.map(label))
  })
  return joinList(parts)
}

export function formatRanges(ranges: readonly Range[]): string {
  return joinList(ranges.map(([s, e]) => `${minuteToTime(s)}–${minuteToTime(e)}`))
}

/** "Seg a Sex, 09:00–12:00 e 13:00–17:00, aulas de 60 min, de 09/11/2026 a 31/12/2026". */
export function summarizePattern(state: WizardState): string {
  if (state.weekdays.length === 0) return 'Nenhum dia selecionado.'
  const groups = groupDaysByRanges(state)
  const hours = groups
    .map((g) => {
      const text = g.ranges.length > 0 ? formatRanges(g.ranges) : 'sem horário'
      return `${formatWeekdays(g.weekdays)}, ${text}`
    })
    .join('; ')
  const period =
    state.endsOn === ''
      ? `a partir de ${formatDateOnly(state.startsOn)}, sem data de fim`
      : `de ${formatDateOnly(state.startsOn)} a ${formatDateOnly(state.endsOn)}`
  return `${hours}, aulas de ${state.lessonMinutes} min, ${period}`
}

// ------------------------------------------------------------------ vigência

/** "O ano todo": 01/01 a 31/12 do ano. */
export function wholeYearPeriod(year: number): { startsOn: string; endsOn: string } {
  return { startsOn: `${year}-01-01`, endsOn: `${year}-12-31` }
}

/** "Até o fim do ano": mantém o início e termina em 31/12 do ano do início (ou de hoje). */
export function untilYearEnd(startsOn: string, todayKey: string): string {
  const year = (parseDayKey(startsOn) ? startsOn : todayKey).slice(0, 4)
  return `${year}-12-31`
}

// ------------------------------------------------------------------ simulação e prévia

const SIM_ID = '__novo__'
const EPOCH = '1970-01-01T00:00:00Z'

/**
 * Dados como ficariam depois de gravar `state` no lugar do padrão `patternId`
 * (null = padrão novo). Não altera `data`.
 */
export function simulateData(
  data: AvailabilityData,
  patternId: string | null,
  state: WizardState,
  timezone = 'America/Sao_Paulo',
): AvailabilityData {
  const id = patternId ?? SIM_ID
  const pattern: Tables<'availability_patterns'> = {
    id,
    name: state.name || DEFAULT_PATTERN_NAME,
    starts_on: state.startsOn,
    ends_on: state.endsOn === '' ? null : state.endsOn,
    default_lesson_minutes: state.lessonMinutes,
    active: true,
    created_at: EPOCH,
    updated_at: EPOCH,
  }
  const slots: Tables<'availability_slots'>[] = slotsFromWizard(state).map((s, i) => ({
    id: `${id}-sim-${i}`,
    pattern_id: id,
    weekday: s.weekday,
    start_time: s.start_time,
    end_time: s.end_time,
    timezone,
    active: true,
    notes: null,
    created_at: EPOCH,
    updated_at: EPOCH,
  }))
  return {
    ...data,
    patterns: [...data.patterns.filter((p) => p.id !== id), pattern],
    slots: [...data.slots.filter((s) => s.pattern_id !== id), ...slots],
  }
}

/** Dados como ficariam sem o padrão. */
export function simulateDelete(
  data: AvailabilityData,
  patternId: string,
): AvailabilityData {
  return {
    ...data,
    patterns: data.patterns.filter((p) => p.id !== patternId),
    slots: data.slots.filter((s) => s.pattern_id !== patternId),
  }
}

export const PREVIEW_MAX_DAYS = 400

export type PreviewWindow = { from: string; to: string; truncated: boolean }

/**
 * Janela de datas da prévia: do que for mais cedo entre a vigência nova e a antiga,
 * mas nunca antes de hoje, com no máximo 400 dias. null se tudo já passou.
 */
export function previewWindow(
  next: { startsOn: string; endsOn: string },
  previous: { starts_on: string; ends_on: string | null } | null,
  todayKey: string,
): PreviewWindow | null {
  if (!parseDayKey(next.startsOn)) return null
  const earliest = previous
    ? [next.startsOn, previous.starts_on].sort()[0]
    : next.startsOn
  const from = [todayKey, earliest ?? next.startsOn].sort().reverse()[0] ?? todayKey
  const ends = [next.endsOn || null, previous ? previous.ends_on : undefined]
  const open = ends.some((e) => e === null)
  const finite = ends.filter((e): e is string => typeof e === 'string').sort()
  const lastEnd = finite[finite.length - 1]
  const cap = addDaysKey(from, PREVIEW_MAX_DAYS - 1)
  let to = open || !lastEnd ? cap : lastEnd
  let truncated = open
  if (to > cap) {
    to = cap
    truncated = true
  }
  if (to < from) return null
  return { from, to, truncated }
}

/** Quantos dias do intervalo têm alguma faixa de atendimento. */
export function countAvailableDays(
  data: AvailabilityData,
  fromKey: string,
  toKey: string,
): number {
  let count = 0
  let key = fromKey
  for (let i = 0; i < PREVIEW_MAX_DAYS && key <= toKey; i++) {
    if (effectiveDay(key, data).ranges.length > 0) count++
    key = addDaysKey(key, 1)
  }
  return count
}

type LessonLike = { starts_at: string; duration_minutes: number; status: string }

/** Aulas ativas que cabiam no horário antes da mudança e ficam fora dele depois. */
export function lessonsOutsideAfterChange<T extends LessonLike>(
  lessons: readonly T[],
  before: AvailabilityData,
  after: AvailabilityData,
  timezone: string,
): T[] {
  return lessons.filter((l) => {
    if (l.status !== 'agendada' && l.status !== 'reposicao') return false
    return (
      isSlotAvailable(l.starts_at, l.duration_minutes, before, timezone) === 'ok' &&
      isSlotAvailable(l.starts_at, l.duration_minutes, after, timezone) !== 'ok'
    )
  })
}

export function pluralize(n: number, one: string, many: string): string {
  return n === 1 ? `1 ${one}` : `${n} ${many}`
}
