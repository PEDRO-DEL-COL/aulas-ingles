import { describe, expect, it } from 'vitest'

import { brazilHolidays, easterSunday, holidayReason, isHolidayReason } from './holidays'

describe('easterSunday', () => {
  it.each([
    [2024, '2024-03-31'],
    [2025, '2025-04-20'],
    [2026, '2026-04-05'],
    [2027, '2027-03-28'],
    [2019, '2019-04-21'],
    [2000, '2000-04-23'],
  ])('Páscoa %i', (year, expected) => {
    expect(easterSunday(year)).toBe(expected)
  })
})

describe('brazilHolidays', () => {
  it('2026: móveis derivados da Páscoa (05/04)', () => {
    const by = Object.fromEntries(brazilHolidays(2026).map((h) => [h.name, h]))
    expect(by['Carnaval (segunda-feira)']?.dateKey).toBe('2026-02-16')
    expect(by['Carnaval (terça-feira)']?.dateKey).toBe('2026-02-17')
    expect(by['Sexta-feira Santa']?.dateKey).toBe('2026-04-03')
    expect(by['Corpus Christi']?.dateKey).toBe('2026-06-04')
    expect(by['Corpus Christi']?.optional).toBe(true)
    expect(by['Carnaval (terça-feira)']?.optional).toBe(true)
    expect(by['Sexta-feira Santa']?.optional).toBe(false)
    expect(by['Natal']?.kind).toBe('fixo')
    expect(by['Corpus Christi']?.kind).toBe('movel')
  })

  it('2024: Carnaval em 12-13/02 e Corpus Christi em 30/05', () => {
    const list = brazilHolidays(2024)
    expect(list.find((h) => h.name.startsWith('Carnaval'))?.dateKey).toBe('2024-02-12')
    expect(list.find((h) => h.name === 'Corpus Christi')?.dateKey).toBe('2024-05-30')
  })

  it('está ordenado e não inclui Quarta-feira de Cinzas', () => {
    const keys = brazilHolidays(2027).map((h) => h.dateKey)
    expect(keys).toEqual([...keys].sort())
    expect(brazilHolidays(2027).some((h) => /cinzas/i.test(h.name))).toBe(false)
  })

  it('Consciência Negra só a partir de 2024', () => {
    const has = (y: number) => brazilHolidays(y).some((h) => h.dateKey === `${y}-11-20`)
    expect(has(2023)).toBe(false)
    expect(has(2024)).toBe(true)
    expect(brazilHolidays(2023)).toHaveLength(12)
    expect(brazilHolidays(2026)).toHaveLength(13)
  })
})

describe('motivo de feriado', () => {
  it('prefixa e reconhece', () => {
    expect(holidayReason('Natal')).toBe('Feriado: Natal')
    expect(isHolidayReason('Feriado: Natal')).toBe(true)
    expect(isHolidayReason('Férias')).toBe(false)
    expect(isHolidayReason(null)).toBe(false)
  })
})
