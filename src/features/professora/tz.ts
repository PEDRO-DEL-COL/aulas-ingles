/**
 * Conversões de data/hora local <-> UTC e semanas, só com Intl (sem dependências).
 * Nada aqui assume horário de verão: o deslocamento é sempre perguntado ao Intl.
 */
import { dayKey, safeTimezone } from '@/features/shared/datetime'

const DAY_MS = 86_400_000

type YMD = { y: number; m: number; d: number }

/** "2026-11-09" => partes, ou null se o formato/valor for inválido. */
export function parseDayKey(key: string): YMD | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key)
  if (!match) return null
  const y = Number(match[1])
  const m = Number(match[2])
  const d = Number(match[3])
  const check = new Date(Date.UTC(y, m - 1, d))
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== m - 1) return null
  if (check.getUTCDate() !== d) return null
  return { y, m, d }
}

function keyFromUtcMs(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10)
}

/** Soma dias a uma data pura ("2026-11-09" + 7 = "2026-11-16"). */
export function addDaysKey(key: string, days: number): string {
  const p = parseDayKey(key)
  if (!p) return key
  return keyFromUtcMs(Date.UTC(p.y, p.m - 1, p.d) + days * DAY_MS)
}

/** Dia da semana de uma data pura: 0 = domingo ... 6 = sábado. */
export function weekdayOfKey(key: string): number {
  const p = parseDayKey(key)
  if (!p) return 0
  return new Date(Date.UTC(p.y, p.m - 1, p.d)).getUTCDay()
}

/** Diferença (hora de parede - instante real) do fuso em `instantMs`, em ms. */
export function tzOffsetMs(instantMs: number, timezone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: safeTimezone(timezone),
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(instantMs))
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0)
  const asUtc = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour') % 24,
    get('minute'),
    get('second'),
  )
  return asUtc - Math.floor(instantMs / 1000) * 1000
}

/**
 * Converte data ("2026-11-09") e hora ("14:30") locais no fuso para o instante UTC.
 * Devolve null se o texto for inválido ou se a hora não existir no fuso
 * (ex.: salto de horário de verão). Em horário repetido, vale uma das ocorrências.
 */
export function localToUtc(dateKey: string, time: string, timezone: string): Date | null {
  const p = parseDayKey(dateKey)
  const t = /^(\d{2}):(\d{2})(?::\d{2})?$/.exec(time)
  if (!p || !t) return null
  const hh = Number(t[1])
  const mm = Number(t[2])
  if (hh > 23 || mm > 59) return null
  const wall = Date.UTC(p.y, p.m - 1, p.d, hh, mm)
  const offset = tzOffsetMs(wall - tzOffsetMs(wall, timezone), timezone)
  const candidate = wall - offset
  // Se o deslocamento no candidato mudou, a hora de parede não existe (lacuna).
  if (tzOffsetMs(candidate, timezone) !== offset) return null
  return new Date(candidate)
}

/** Início do dia civil no fuso (normalmente 00:00; tenta horas seguintes se não existir). */
export function startOfDayUtc(dateKey: string, timezone: string): Date {
  for (const time of ['00:00', '01:00', '02:00']) {
    const d = localToUtc(dateKey, time, timezone)
    if (d) return d
  }
  const p = parseDayKey(dateKey)
  return new Date(p ? Date.UTC(p.y, p.m - 1, p.d) : Number.NaN)
}

/** Segunda-feira da semana que contém `now` (data civil no fuso). */
export function weekStartKey(now: Date, timezone: string): string {
  const today = dayKey(now, timezone)
  return addDaysKey(today, -((weekdayOfKey(today) + 6) % 7))
}

/** As 7 datas (segunda a domingo) a partir da segunda-feira `startKey`. */
export function weekDayKeys(startKey: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDaysKey(startKey, i))
}

/** Intervalo UTC [início, fim) cobrindo as datas civis de `fromKey` até `toKey` (inclusive). */
export function rangeUtc(
  fromKey: string,
  toKey: string,
  timezone: string,
): { start: Date; end: Date } {
  return {
    start: startOfDayUtc(fromKey, timezone),
    end: startOfDayUtc(addDaysKey(toKey, 1), timezone),
  }
}
