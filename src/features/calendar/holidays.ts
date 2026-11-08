/** Feriados nacionais do Brasil, calculados localmente (sem API). */
import { addDaysKey } from '@/features/professora/tz'

export const HOLIDAY_REASON_PREFIX = 'Feriado: '

export type Holiday = {
  dateKey: string
  name: string
  kind: 'fixo' | 'movel'
  /** Ponto facultativo (não é feriado nacional por lei). */
  optional: boolean
}

export function holidayReason(name: string): string {
  return `${HOLIDAY_REASON_PREFIX}${name}`
}

export function isHolidayReason(reason: string | null | undefined): boolean {
  return typeof reason === 'string' && reason.startsWith(HOLIDAY_REASON_PREFIX)
}

const pad = (n: number): string => String(n).padStart(2, '0')

/** Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher), como "AAAA-MM-DD". */
export function easterSunday(year: number): string {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return `${year}-${pad(month)}-${pad(day)}`
}

export function brazilHolidays(year: number): Holiday[] {
  const easter = easterSunday(year)
  const fixed = (md: string, name: string): Holiday => ({
    dateKey: `${year}-${md}`,
    name,
    kind: 'fixo',
    optional: false,
  })
  const movable = (offset: number, name: string, optional: boolean): Holiday => ({
    dateKey: addDaysKey(easter, offset),
    name,
    kind: 'movel',
    optional,
  })
  const list: Holiday[] = [
    fixed('01-01', 'Confraternização Universal'),
    movable(-48, 'Carnaval (segunda-feira)', true),
    movable(-47, 'Carnaval (terça-feira)', true),
    movable(-2, 'Sexta-feira Santa', false),
    fixed('04-21', 'Tiradentes'),
    fixed('05-01', 'Dia do Trabalho'),
    movable(60, 'Corpus Christi', true),
    fixed('09-07', 'Independência do Brasil'),
    fixed('10-12', 'Nossa Senhora Aparecida'),
    fixed('11-02', 'Finados'),
    fixed('11-15', 'Proclamação da República'),
  ]
  if (year >= 2024)
    list.push(fixed('11-20', 'Dia Nacional de Zumbi e da Consciência Negra'))
  list.push(fixed('12-25', 'Natal'))
  return list.sort((x, y) => x.dateKey.localeCompare(y.dateKey))
}
