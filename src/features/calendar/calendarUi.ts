/**
 * Lógica PURA da interface do calendário (sem React nem Supabase): URL, seleção por
 * arrasto, resumo acessível do dia, layout de aulas sobrepostas e simulação de mudanças.
 */
import { addDaysKey, parseDayKey } from '@/features/professora/tz'
import type { AvailabilityExceptionKind } from '@/types/database'

import {
  effectiveDay,
  minuteToTime,
  monthGrid,
  subtractRanges,
  weekKeys,
  type AvailabilityData,
  type AvailabilityException,
  type DayStatus,
  type EffectiveDay,
  type Range,
} from './engine'

// ------------------------------------------------------------------ URL

export type CalendarView = 'mes' | 'semana' | 'dia'
export type CalendarPanel = 'horario' | 'feriados'

export const CALENDAR_VIEWS: readonly { value: CalendarView; label: string }[] = [
  { value: 'mes', label: 'Mês' },
  { value: 'semana', label: 'Semana' },
  { value: 'dia', label: 'Dia' },
]

export type CalendarParams = {
  view: CalendarView
  date: string
  panel: CalendarPanel | null
}

export function isCalendarView(value: unknown): value is CalendarView {
  return value === 'mes' || value === 'semana' || value === 'dia'
}

/** Lê ?visao=&data=&painel= com validação; valores inválidos caem nos padrões. */
export function parseCalendarParams(
  search: string | URLSearchParams,
  todayKey: string,
  defaultView: CalendarView = 'mes',
): CalendarParams {
  const p = typeof search === 'string' ? new URLSearchParams(search) : search
  const view = p.get('visao')
  const date = p.get('data')
  const panel = p.get('painel')
  return {
    view: isCalendarView(view) ? view : defaultView,
    date: date && parseDayKey(date) ? date : todayKey,
    panel: panel === 'horario' || panel === 'feriados' ? panel : null,
  }
}

export function serializeCalendarParams(view: CalendarView, date: string): string {
  const p = new URLSearchParams()
  p.set('visao', view)
  p.set('data', date)
  return p.toString()
}

// ------------------------------------------------------------------ datas

export function daysInMonth(year: number, month1to12: number): number {
  return new Date(Date.UTC(year, month1to12, 0)).getUTCDate()
}

/** Anda um período (mês/semana/dia) para frente (+1) ou para trás (-1). */
export function shiftDate(view: CalendarView, date: string, dir: 1 | -1): string {
  if (view === 'dia') return addDaysKey(date, dir)
  if (view === 'semana') return addDaysKey(date, 7 * dir)
  const p = parseDayKey(date)
  if (!p) return date
  const idx = p.y * 12 + (p.m - 1) + dir
  const y = Math.floor(idx / 12)
  const m = (idx % 12) + 1
  const d = Math.min(p.d, daysInMonth(y, m))
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

/** Datas exibidas na visão (mês: grade completa; semana/dia: a semana). */
export function visibleKeys(view: CalendarView, date: string): string[] {
  if (view === 'mes') {
    const p = parseDayKey(date)
    return p ? monthGrid(p.y, p.m).flat() : [date]
  }
  return weekKeys(date)
}

/** Janela de dados a carregar (semana/dia ganham folga de 7 dias para cada lado). */
export function fetchWindow(
  view: CalendarView,
  date: string,
): { from: string; to: string } {
  const keys = visibleKeys(view, date)
  const first = keys[0] ?? date
  const last = keys[keys.length - 1] ?? date
  if (view === 'mes') return { from: first, to: last }
  return { from: addDaysKey(first, -7), to: addDaysKey(last, 7) }
}

function utcNoon(key: string): Date {
  return new Date(`${key}T12:00:00Z`)
}

const fmt = (opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat('pt-BR', { ...opts, timeZone: 'UTC' })

/** "terça-feira, 12 de maio". */
export function longDayLabel(key: string): string {
  return fmt({ weekday: 'long', day: 'numeric', month: 'long' }).format(utcNoon(key))
}

const WEEKDAY_SHORT = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
export const WEEKDAY_INITIALS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']

export function weekdayShort(key: string): string {
  return WEEKDAY_SHORT[utcNoon(key).getUTCDay()] ?? ''
}

export function dayOfMonth(key: string): number {
  return Number(key.slice(8, 10))
}

/** Título do período exibido. */
export function periodTitle(view: CalendarView, date: string): string {
  if (view === 'mes') {
    return fmt({ month: 'long', year: 'numeric' }).format(utcNoon(date))
  }
  if (view === 'dia') return longDayLabel(date)
  const keys = weekKeys(date)
  const first = keys[0] ?? date
  const last = keys[6] ?? date
  const a = fmt({ day: 'numeric', month: 'short' }).format(utcNoon(first))
  const b = fmt({ day: 'numeric', month: 'short', year: 'numeric' }).format(utcNoon(last))
  return `${a} – ${b}`
}

// ------------------------------------------------------------------ estado do dia

export const STATUS_LABEL: Record<DayStatus, { label: string; short: string }> = {
  disponivel: { label: 'Disponível', short: 'Livre' },
  parcial: { label: 'Parcial', short: 'Parcial' },
  sem_horario: { label: 'Sem horário', short: 'Sem horário' },
  fechado: { label: 'Fechado', short: 'Fechado' },
  feriado: { label: 'Feriado', short: 'Feriado' },
  ferias: { label: 'Férias', short: 'Férias' },
  nao_configurado: { label: 'Não configurado', short: 'Sem padrão' },
}

export function lessonCountLabel(count: number): string {
  return count === 0 ? 'sem aulas' : count === 1 ? '1 aula' : `${count} aulas`
}

/** "terça-feira, 12 de maio: parcial, 2 aulas" (aria-label do dia). */
export function daySummary(key: string, status: DayStatus, lessonCount: number): string {
  return `${longDayLabel(key)}: ${STATUS_LABEL[status].label.toLowerCase()}, ${lessonCountLabel(lessonCount)}`
}

export function rangeLabel(r: Range): string {
  return `${minuteToTime(r[0])}–${minuteToTime(r[1])}`
}

/** Faixas de um dia em texto curto: "09:00–12:00, 14:00–18:00". */
export function rangesLabel(ranges: readonly Range[]): string {
  return ranges.length === 0 ? 'nenhuma faixa' : ranges.map(rangeLabel).join(', ')
}

// ------------------------------------------------------------------ seleção por arrasto

/** Intervalo de dias [from,to] ordenado a partir de dois pontos do arrasto. */
export function selectDayRange(a: string, b: string): { from: string; to: string } {
  return a <= b ? { from: a, to: b } : { from: b, to: a }
}

/** Intervalo de minutos com "snap" (padrão 15 min); mínimo de um passo; limitado a [min,max]. */
export function selectMinutes(
  a: number,
  b: number,
  snap = 15,
  min = 0,
  max = 1440,
): Range {
  const lo = Math.min(a, b)
  const hi = Math.max(a, b)
  let start = Math.floor(lo / snap) * snap
  let end = Math.ceil(hi / snap) * snap
  start = Math.max(min, Math.min(start, max - snap))
  end = Math.min(max, Math.max(end, start + snap))
  return [start, end]
}

/** Minuto (com snap opcional) a partir do deslocamento vertical em px. */
export function minuteFromOffset(
  offsetPx: number,
  pxPerMinute: number,
  startMinute: number,
  snap = 0,
): number {
  const raw = startMinute + offsetPx / pxPerMinute
  const m = snap > 0 ? Math.round(raw / snap) * snap : raw
  return Math.max(0, Math.min(1440, m))
}

// ------------------------------------------------------------------ layout de sobrepostas

export type LayoutItem = { id: string; start: number; end: number }
export type LayoutResult = { id: string; col: number; cols: number }

/** Colunas lado a lado para itens que se sobrepõem (cada grupo conectado usa suas colunas). */
export function layoutOverlaps(items: readonly LayoutItem[]): LayoutResult[] {
  const sorted = [...items].sort((a, b) => a.start - b.start || a.end - b.end)
  const out: LayoutResult[] = []
  let cluster: { id: string; col: number }[] = []
  let clusterEnd = -Infinity
  let colEnds: number[] = []

  const flush = () => {
    const cols = Math.max(1, colEnds.length)
    for (const c of cluster) out.push({ id: c.id, col: c.col, cols })
    cluster = []
    colEnds = []
    clusterEnd = -Infinity
  }

  for (const it of sorted) {
    if (cluster.length > 0 && it.start >= clusterEnd) flush()
    let col = colEnds.findIndex((e) => e <= it.start)
    if (col === -1) {
      col = colEnds.length
      colEnds.push(it.end)
    } else {
      colEnds[col] = it.end
    }
    cluster.push({ id: it.id, col })
    clusterEnd = Math.max(clusterEnd, it.end)
  }
  flush()
  return out
}

// ------------------------------------------------------------------ simulação de mudanças

export type ExceptionDraft = {
  kind: AvailabilityExceptionKind
  start_time?: string | null
  end_time?: string | null
  reason?: string | null
}

/** Dados como ficariam após remover exceções (por id) e adicionar rascunhos num dia. */
export function simulateChange(
  data: AvailabilityData,
  dateKey: string,
  add: readonly ExceptionDraft[],
  removeIds: readonly string[],
): AvailabilityData {
  const drop = new Set(removeIds)
  const fake: AvailabilityException[] = add.map((d, i) => ({
    id: `sim-${i}`,
    on_date: dateKey,
    kind: d.kind,
    start_time: d.kind === 'fechado' ? null : (d.start_time ?? null),
    end_time: d.kind === 'fechado' ? null : (d.end_time ?? null),
    reason: d.reason ?? null,
    created_at: '',
    updated_at: '',
  }))
  return {
    ...data,
    exceptions: [...data.exceptions.filter((e) => !drop.has(e.id)), ...fake],
  }
}

/** Faixas de horário que a mudança remove ('all' quando o dia fecha). */
export function removedByChange(
  data: AvailabilityData,
  dateKey: string,
  add: readonly ExceptionDraft[],
  removeIds: readonly string[],
): Range[] | 'all' {
  const before = effectiveDay(dateKey, data)
  const after = effectiveDay(dateKey, simulateChange(data, dateKey, add, removeIds))
  if (after.ranges.length === 0 && before.ranges.length > 0) return 'all'
  return subtractRanges(before.ranges, after.ranges)
}

// ------------------------------------------------------------------ linha do dia

export type DayEntry =
  | { kind: 'livre'; start: number; end: number }
  | { kind: 'bloqueio'; start: number; end: number; reason: string | null }
  | { kind: 'aula'; start: number; end: number; lessonId: string }

function toMin(t: string): number {
  const m = /^(\d{2}):(\d{2})/.exec(t)
  return m ? Number(m[1]) * 60 + Number(m[2]) : Number.NaN
}

/** Faixas livres, bloqueios e aulas do dia em ordem cronológica. */
export function dayEntries(
  day: EffectiveDay,
  lessons: readonly { id: string; start: number; end: number }[],
): DayEntry[] {
  const out: DayEntry[] = []
  for (const [s, e] of day.ranges) out.push({ kind: 'livre', start: s, end: e })
  for (const x of day.exceptions) {
    if (x.kind !== 'bloqueio' || x.start_time === null || x.end_time === null) continue
    const s = toMin(x.start_time)
    const e = toMin(x.end_time)
    if (Number.isFinite(s) && Number.isFinite(e))
      out.push({ kind: 'bloqueio', start: s, end: e, reason: x.reason })
  }
  for (const l of lessons)
    out.push({ kind: 'aula', start: l.start, end: l.end, lessonId: l.id })
  const order = { livre: 0, bloqueio: 1, aula: 2 }
  return out.sort((a, b) => a.start - b.start || order[a.kind] - order[b.kind])
}

// ------------------------------------------------------------------ pedido de mudança

/** Mudança de exceções num dia, a ser confirmada (conflitos) e aplicada pela página. */
export type DayChangeRequest = {
  dateKey: string
  add: ExceptionDraft[]
  removeIds: string[]
  /** Título do aviso de conflito: "Fechar o dia 12 de maio". */
  title: string
  /** Mensagem do aviso após aplicar: "Dia fechado." */
  done: string
}

export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/** Texto "HH:MM" de um input time <-> faixa (23:59 vale como fim do dia). */
export function toInputTime(minute: number): string {
  return minute >= 1440 ? '23:59' : minuteToTime(minute)
}

export function fromInputTime(value: string): string {
  return value === '23:59' ? '24:00' : value
}
