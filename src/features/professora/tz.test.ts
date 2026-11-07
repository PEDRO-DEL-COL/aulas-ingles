import { describe, expect, it } from 'vitest'

import {
  addDaysKey,
  localToUtc,
  parseDayKey,
  rangeUtc,
  weekDayKeys,
  weekStartKey,
  weekdayOfKey,
} from './tz'

const SP = 'America/Sao_Paulo'

describe('localToUtc', () => {
  it('converte horário de Brasília (UTC-3)', () => {
    expect(localToUtc('2026-11-09', '14:30', SP)?.toISOString()).toBe(
      '2026-11-09T17:30:00.000Z',
    )
  })

  it('vira o dia quando a hora local passa da meia-noite em UTC', () => {
    expect(localToUtc('2026-11-09', '22:00', SP)?.toISOString()).toBe(
      '2026-11-10T01:00:00.000Z',
    )
  })

  it('respeita outros fusos e horário de verão quando o fuso tem', () => {
    expect(localToUtc('2026-07-01', '09:00', 'America/New_York')?.toISOString()).toBe(
      '2026-07-01T13:00:00.000Z',
    )
    expect(localToUtc('2026-01-15', '09:00', 'America/New_York')?.toISOString()).toBe(
      '2026-01-15T14:00:00.000Z',
    )
    expect(localToUtc('2026-06-01', '12:00', 'Europe/Lisbon')?.toISOString()).toBe(
      '2026-06-01T11:00:00.000Z',
    )
  })

  it('devolve null para hora inexistente (salto do horário de verão)', () => {
    expect(localToUtc('2026-03-08', '02:30', 'America/New_York')).toBeNull()
  })

  it('aceita uma das ocorrências em horário repetido', () => {
    const d = localToUtc('2026-11-01', '01:30', 'America/New_York')?.toISOString()
    expect(['2026-11-01T05:30:00.000Z', '2026-11-01T06:30:00.000Z']).toContain(d)
  })

  it('rejeita entradas inválidas', () => {
    expect(localToUtc('2026-02-30', '10:00', SP)).toBeNull()
    expect(localToUtc('2026-11-09', '25:00', SP)).toBeNull()
    expect(localToUtc('09/11/2026', '10:00', SP)).toBeNull()
    expect(localToUtc('2026-11-09', '10h', SP)).toBeNull()
  })
})

describe('datas puras', () => {
  it('parseDayKey valida', () => {
    expect(parseDayKey('2026-11-09')).toEqual({ y: 2026, m: 11, d: 9 })
    expect(parseDayKey('2026-13-01')).toBeNull()
  })
  it('soma dias atravessando mês e ano', () => {
    expect(addDaysKey('2026-12-30', 3)).toBe('2027-01-02')
    expect(addDaysKey('2026-03-01', -1)).toBe('2026-02-28')
  })
  it('weekdayOfKey: 0 = domingo', () => {
    expect(weekdayOfKey('2026-11-08')).toBe(0)
    expect(weekdayOfKey('2026-11-09')).toBe(1)
  })
})

describe('semana', () => {
  it('começa na segunda-feira e usa a data local, não a UTC', () => {
    // 08/11 01:00Z ainda é sábado 07/11 22:00 em Brasília.
    expect(weekStartKey(new Date('2026-11-08T01:00:00Z'), SP)).toBe('2026-11-02')
    // Domingo 08/11 pertence à semana que começou em 02/11.
    expect(weekStartKey(new Date('2026-11-08T15:00:00Z'), SP)).toBe('2026-11-02')
    // Segunda 09/11 inicia nova semana.
    expect(weekStartKey(new Date('2026-11-09T15:00:00Z'), SP)).toBe('2026-11-09')
  })

  it('lista 7 dias', () => {
    const days = weekDayKeys('2026-11-02')
    expect(days).toHaveLength(7)
    expect(days[0]).toBe('2026-11-02')
    expect(days[6]).toBe('2026-11-08')
  })

  it('rangeUtc cobre a semana inteira no fuso', () => {
    const { start, end } = rangeUtc('2026-11-02', '2026-11-08', SP)
    expect(start.toISOString()).toBe('2026-11-02T03:00:00.000Z')
    expect(end.toISOString()).toBe('2026-11-09T03:00:00.000Z')
  })
})
