import { describe, expect, it } from 'vitest'

import type { Tables } from '@/types/database'

import {
  hasActivePattern,
  scheduleFit,
  suggestStarts,
  type AvailabilityData,
} from './engine'

const NONE: AvailabilityData = { patterns: [], slots: [], exceptions: [], blocked: [] }

function pattern(active = true): Tables<'availability_patterns'> {
  return {
    id: 'p1',
    name: 'Padrao',
    starts_on: '2027-01-01',
    ends_on: null,
    default_lesson_minutes: 60,
    active,
    created_at: '',
    updated_at: '',
  }
}
function slot(weekday: number, s: string, e: string): Tables<'availability_slots'> {
  return {
    id: `s${weekday}${s}`,
    pattern_id: 'p1',
    weekday,
    start_time: s,
    end_time: e,
    timezone: 'America/Sao_Paulo',
    active: true,
    notes: null,
    created_at: '',
    updated_at: '',
  }
}
function exc(
  on_date: string,
  kind: Tables<'availability_exceptions'>['kind'],
  start_time: string | null = null,
  end_time: string | null = null,
): Tables<'availability_exceptions'> {
  return {
    id: `e${on_date}${kind}`,
    on_date,
    kind,
    start_time,
    end_time,
    reason: null,
    created_at: '',
    updated_at: '',
  }
}

/** Seg-sex 09-12 e 13-17. 2027-01-04 é segunda; 2027-01-09 é sábado. */
function base(): AvailabilityData {
  return {
    patterns: [pattern()],
    slots: [1, 2, 3, 4, 5].flatMap((d) => [
      slot(d, '09:00:00', '12:00:00'),
      slot(d, '13:00:00', '17:00:00'),
    ]),
    exceptions: [],
    blocked: [],
  }
}

describe('hasActivePattern', () => {
  it('só conta padrões ativos', () => {
    expect(hasActivePattern(NONE)).toBe(false)
    expect(hasActivePattern({ patterns: [pattern(false)] })).toBe(false)
    expect(hasActivePattern({ patterns: [pattern(true)] })).toBe(true)
  })
})

describe('suggestStarts', () => {
  it('respeita faixas e almoço', () => {
    expect(suggestStarts('2027-01-04', 60, base())).toEqual([
      '09:00',
      '09:30',
      '10:00',
      '10:30',
      '11:00',
      '13:00',
      '13:30',
      '14:00',
      '14:30',
      '15:00',
      '15:30',
      '16:00',
    ])
  })
  it('a aula precisa caber inteira (duração maior reduz opções)', () => {
    expect(suggestStarts('2027-01-04', 180, base())).toEqual([
      '09:00',
      '13:00',
      '13:30',
      '14:00',
    ])
    expect(suggestStarts('2027-01-04', 300, base())).toEqual([])
  })
  it('passo customizado', () => {
    expect(suggestStarts('2027-01-04', 120, base(), 60)).toEqual([
      '09:00',
      '10:00',
      '13:00',
      '14:00',
      '15:00',
    ])
  })
  it('dia sem faixa (sábado) não tem sugestões', () => {
    expect(suggestStarts('2027-01-09', 60, base())).toEqual([])
  })
  it('feriado/férias e dia fechado não têm sugestões', () => {
    const holiday = {
      ...base(),
      blocked: [
        {
          id: 'b',
          starts_on: '2027-01-04',
          ends_on: '2027-01-04',
          reason: 'Feriado: X',
          created_at: '',
          updated_at: '',
        },
      ],
    }
    expect(suggestStarts('2027-01-04', 60, holiday)).toEqual([])
    expect(
      suggestStarts('2027-01-04', 60, {
        ...base(),
        exceptions: [exc('2027-01-04', 'fechado')],
      }),
    ).toEqual([])
  })
  it('exceções: bloqueio, extra e substituir', () => {
    const blocked = {
      ...base(),
      exceptions: [exc('2027-01-04', 'bloqueio', '10:00:00', '11:00:00')],
    }
    expect(suggestStarts('2027-01-04', 60, blocked).slice(0, 3)).toEqual([
      '09:00',
      '11:00',
      '13:00',
    ])
    const extra = {
      ...base(),
      exceptions: [exc('2027-01-09', 'extra', '10:00:00', '11:00:00')],
    }
    expect(suggestStarts('2027-01-09', 60, extra)).toEqual(['10:00'])
    const replace = {
      ...base(),
      exceptions: [exc('2027-01-04', 'substituir', '20:00:00', '22:00:00')],
    }
    expect(suggestStarts('2027-01-04', 60, replace)).toEqual(['20:00', '20:30', '21:00'])
  })
  it('sem padrão ativo é permissivo: dia inteiro, sem passar da meia-noite', () => {
    const all = suggestStarts('2027-01-04', 60, NONE)
    expect(all[0]).toBe('00:00')
    expect(all[all.length - 1]).toBe('23:00')
    expect(all).not.toContain('23:30')
    expect(
      suggestStarts('2027-01-04', 60, { ...NONE, patterns: [pattern(false)] }),
    ).toEqual(all)
  })
  it('sem padrão continua respeitando feriado', () => {
    const data = {
      ...NONE,
      blocked: [
        {
          id: 'b',
          starts_on: '2027-01-04',
          ends_on: '2027-01-05',
          reason: null,
          created_at: '',
          updated_at: '',
        },
      ],
    }
    expect(suggestStarts('2027-01-04', 60, data)).toEqual([])
  })
  it('virada de dia: faixa até 24:00 não deixa começar às 23:30 com 60 min', () => {
    const data: AvailabilityData = { ...base(), slots: [slot(1, '22:00:00', '24:00:00')] }
    expect(suggestStarts('2027-01-04', 60, data)).toEqual(['22:00', '22:30', '23:00'])
  })
  it('entradas inválidas', () => {
    expect(suggestStarts('2027-01-04', 0, base())).toEqual([])
    expect(suggestStarts('2027-01-04', 60, base(), 0)).toEqual([])
  })
})

describe('scheduleFit', () => {
  const fit = (over: Partial<Parameters<typeof scheduleFit>[0]> = {}, data = base()) =>
    scheduleFit(
      {
        weekday: 1,
        startTime: '14:00:00',
        durationMin: 60,
        startsOn: '2027-01-01',
        endsOn: null,
        ...over,
      },
      data,
      '2027-01-04',
    )

  it('horário dentro da disponibilidade: nada fora', () => {
    expect(fit()).toEqual({ total: 8, outside: [] })
  })
  it('horário no almoço: todas fora', () => {
    const r = fit({ startTime: '12:00' })
    expect(r.total).toBe(8)
    expect(r.outside).toHaveLength(8)
    expect(r.outside[0]).toEqual({
      dateKey: '2027-01-04',
      reason: 'fora_disponibilidade',
    })
  })
  it('feriado em uma semana vira bloqueado', () => {
    const data = {
      ...base(),
      blocked: [
        {
          id: 'b',
          starts_on: '2027-01-11',
          ends_on: '2027-01-11',
          reason: 'Feriado: X',
          created_at: '',
          updated_at: '',
        },
      ],
    }
    expect(fit({}, data).outside).toEqual([
      { dateKey: '2027-01-11', reason: 'bloqueado' },
    ])
  })
  it('respeita starts_on / ends_on e o dia da semana', () => {
    expect(fit({ startsOn: '2027-01-18' }).total).toBe(6)
    expect(fit({ endsOn: '2027-01-12' }).total).toBe(2)
    expect(fit({ weekday: 6 }).outside).toHaveLength(8)
  })
  it('termina depois da meia-noite: fora', () => {
    expect(fit({ startTime: '23:30', durationMin: 60 }).outside).toHaveLength(8)
  })
  it('sem padrão: permissivo', () => {
    expect(fit({ startTime: '12:00' }, NONE).outside).toEqual([])
  })
  it('hora inválida não quebra', () => {
    expect(fit({ startTime: 'xx' })).toEqual({ total: 0, outside: [] })
  })
})
