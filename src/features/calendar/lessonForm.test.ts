import { describe, expect, it } from 'vitest'

import type { Tables } from '@/types/database'

import type { AvailabilityData } from './engine'
import {
  dayIsClosed,
  defaultLessonMinutes,
  parseDuration,
  SLOT_MESSAGES,
  validateSlotChoice,
} from './lessonForm'

const SP = 'America/Sao_Paulo'
const NOW = new Date('2027-01-01T12:00:00Z')

function pattern(over: Partial<Tables<'availability_patterns'>> = {}) {
  return {
    id: 'p1',
    name: 'P',
    starts_on: '2027-01-01',
    ends_on: null,
    default_lesson_minutes: 45,
    active: true,
    created_at: '',
    updated_at: '',
    ...over,
  } satisfies Tables<'availability_patterns'>
}
const data: AvailabilityData = {
  patterns: [pattern()],
  slots: [
    {
      id: 's',
      pattern_id: 'p1',
      weekday: 1,
      start_time: '09:00:00',
      end_time: '12:00:00',
      timezone: SP,
      active: true,
      notes: null,
      created_at: '',
      updated_at: '',
    },
  ],
  exceptions: [],
  blocked: [],
}
// 2027-01-04 é segunda-feira.
const pick = (time: string, over: Record<string, unknown> = {}) =>
  validateSlotChoice({
    dateKey: '2027-01-04',
    time,
    durationMin: 60,
    data,
    timezone: SP,
    now: NOW,
    ...over,
  })

describe('defaultLessonMinutes', () => {
  it('usa o padrão vigente, senão 60', () => {
    expect(defaultLessonMinutes('2027-01-04', data)).toBe(45)
    expect(defaultLessonMinutes('2026-12-01', data)).toBe(60)
    expect(
      defaultLessonMinutes('2027-01-04', { patterns: [pattern({ active: false })] }),
    ).toBe(60)
    expect(defaultLessonMinutes('2027-01-04', undefined)).toBe(60)
  })
})

describe('parseDuration', () => {
  it('aceita 5..480 inteiros', () => {
    expect(parseDuration('60')).toBe(60)
    expect(parseDuration('4')).toBeNull()
    expect(parseDuration('481')).toBeNull()
    expect(parseDuration('1.5')).toBeNull()
    expect(parseDuration('')).toBeNull()
  })
})

describe('validateSlotChoice', () => {
  it('horário disponível devolve o instante UTC', () => {
    expect(pick('09:00')).toEqual({ ok: true, startsAt: '2027-01-04T12:00:00.000Z' })
  })
  it('fora da faixa', () => {
    expect(pick('12:00')).toEqual({ ok: false, error: SLOT_MESSAGES.outside })
    expect(pick('11:30')).toEqual({ ok: false, error: SLOT_MESSAGES.outside })
  })
  it('feriado', () => {
    const closed = {
      ...data,
      blocked: [
        {
          id: 'b',
          starts_on: '2027-01-04',
          ends_on: '2027-01-04',
          reason: null,
          created_at: '',
          updated_at: '',
        },
      ],
    }
    expect(pick('09:00', { data: closed })).toEqual({
      ok: false,
      error: SLOT_MESSAGES.blocked,
    })
    expect(dayIsClosed('2027-01-04', closed)).toBe(true)
    expect(dayIsClosed('2027-01-04', data)).toBe(false)
  })
  it('passado, hora inválida e duração inválida', () => {
    expect(pick('09:00', { now: new Date('2027-01-05T00:00:00Z') })).toEqual({
      ok: false,
      error: SLOT_MESSAGES.past,
    })
    expect(pick('')).toEqual({ ok: false, error: SLOT_MESSAGES.invalid })
    expect(pick('09:00', { durationMin: null })).toEqual({
      ok: false,
      error: SLOT_MESSAGES.duration,
    })
  })
  it('sem dados carregados, deixa o banco decidir', () => {
    expect(pick('12:00', { data: undefined }).ok).toBe(true)
  })
})
