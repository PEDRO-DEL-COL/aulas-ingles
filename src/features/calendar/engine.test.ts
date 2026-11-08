import { describe, expect, it } from 'vitest'

import type { Tables } from '@/types/database'

import {
  affectedLessons,
  effectiveDay,
  isSlotAvailable,
  lessonLocalRange,
  localParts,
  minuteToTime,
  monthGrid,
  normalizeRanges,
  previewChanges,
  rangesContain,
  subtractRanges,
  timeToMinute,
  totalMinutes,
  unionRanges,
  weekKeys,
  type AvailabilityData,
} from './engine'

const SP = 'America/Sao_Paulo'
const PID = 'p1'

function pattern(over: Partial<Tables<'availability_patterns'>> = {}) {
  return {
    id: PID,
    name: 'Padrao',
    starts_on: '2027-01-01',
    ends_on: '2027-12-31',
    default_lesson_minutes: 60,
    active: true,
    created_at: '',
    updated_at: '',
    ...over,
  } satisfies Tables<'availability_patterns'>
}
function slot(
  weekday: number,
  s: string,
  e: string,
  over: Partial<Tables<'availability_slots'>> = {},
) {
  return {
    id: `s${weekday}${s}${over.pattern_id ?? ''}`,
    pattern_id: PID,
    weekday,
    start_time: s,
    end_time: e,
    timezone: SP,
    active: true,
    notes: null,
    created_at: '',
    updated_at: '',
    ...over,
  } satisfies Tables<'availability_slots'>
}
let n = 0
function exc(
  on_date: string,
  kind: Tables<'availability_exceptions'>['kind'],
  start_time: string | null = null,
  end_time: string | null = null,
) {
  return {
    id: `e${n++}`,
    on_date,
    kind,
    start_time,
    end_time,
    reason: null,
    created_at: '',
    updated_at: '',
  } satisfies Tables<'availability_exceptions'>
}
function block(starts_on: string, ends_on: string, reason: string | null) {
  return { id: `b${n++}`, starts_on, ends_on, reason, created_at: '', updated_at: '' }
}

/** Mesmo cenário do pgTAP: seg-sex 09-12 e 13-17, vigente em 2027. */
function base(): AvailabilityData {
  const slots = [1, 2, 3, 4, 5].flatMap((d) => [
    slot(d, '09:00:00', '12:00:00'),
    slot(d, '13:00:00', '17:00:00'),
  ])
  return { patterns: [pattern()], slots, exceptions: [], blocked: [] }
}
const withExc = (...e: ReturnType<typeof exc>[]): AvailabilityData => ({
  ...base(),
  exceptions: e,
})

describe('faixas', () => {
  it('timeToMinute / minuteToTime', () => {
    expect(timeToMinute('09:30')).toBe(570)
    expect(timeToMinute('09:30:00')).toBe(570)
    expect(timeToMinute('24:00')).toBe(1440)
    expect(timeToMinute('24:00:00')).toBe(1440)
    expect(timeToMinute('25:00')).toBeNaN()
    expect(timeToMinute('abc')).toBeNaN()
    expect(minuteToTime(570)).toBe('09:30')
    expect(minuteToTime(1440)).toBe('24:00')
    expect(minuteToTime(0)).toBe('00:00')
  })
  it('normalizeRanges funde sobrepostas e encostadas', () => {
    expect(
      normalizeRanges([
        [600, 700],
        [0, 60],
        [60, 120],
        [650, 800],
        [5, 5],
      ]),
    ).toEqual([
      [0, 120],
      [600, 800],
    ])
  })
  it('union, subtract, contain, total', () => {
    expect(unionRanges([[0, 10]], [[10, 20]])).toEqual([[0, 20]])
    expect(
      subtractRanges(
        [[0, 100]],
        [
          [10, 20],
          [50, 150],
        ],
      ),
    ).toEqual([
      [0, 10],
      [20, 50],
    ])
    expect(subtractRanges([[0, 100]], [[0, 100]])).toEqual([])
    expect(subtractRanges([[0, 100]], [])).toEqual([[0, 100]])
    expect(rangesContain([[540, 720]], [540, 600])).toBe(true)
    expect(rangesContain([[540, 720]], [690, 750])).toBe(false)
    expect(
      rangesContain(
        [
          [540, 720],
          [720, 800],
        ],
        [700, 760],
      ),
    ).toBe(true)
    expect(
      totalMinutes([
        [0, 60],
        [30, 90],
      ]),
    ).toBe(90)
  })
})

describe('regra efetiva (espelho do pgTAP)', () => {
  it('segunda: 09-12 e 13-17; sábado vazio; fora da vigência vazio', () => {
    const d = base()
    const mon = effectiveDay('2027-05-03', d)
    expect(mon.ranges).toEqual([
      [540, 720],
      [780, 1020],
    ])
    expect(mon.status).toBe('disponivel')
    expect(effectiveDay('2027-05-01', d)).toMatchObject({
      ranges: [],
      status: 'sem_horario',
    })
    expect(effectiveDay('2028-01-03', d).ranges).toEqual([])
  })

  it('almoço, início de faixa, fim de faixa e meia-noite (UTC-3)', () => {
    const d = base()
    expect(isSlotAvailable('2027-05-03T12:00:00Z', 60, d, SP)).toBe('ok')
    expect(isSlotAvailable('2027-05-03T14:30:00Z', 60, d, SP)).toBe(
      'fora_disponibilidade',
    )
    expect(isSlotAvailable('2027-05-03T16:00:00Z', 60, d, SP)).toBe('ok')
    expect(isSlotAvailable('2027-05-03T19:30:00Z', 60, d, SP)).toBe(
      'fora_disponibilidade',
    )
    expect(isSlotAvailable('2027-05-04T02:30:00Z', 60, d, SP)).toBe(
      'fora_disponibilidade',
    )
  })

  it('bloqueio 10-11 na segunda', () => {
    const d = withExc(exc('2027-05-03', 'bloqueio', '10:00', '11:00'))
    expect(isSlotAvailable('2027-05-03T13:00:00Z', 60, d, SP)).toBe(
      'fora_disponibilidade',
    )
    expect(isSlotAvailable('2027-05-03T14:00:00Z', 60, d, SP)).toBe('ok')
    const day = effectiveDay('2027-05-03', d)
    expect(day.status).toBe('parcial')
    expect(day.ranges).toEqual([
      [540, 600],
      [660, 720],
      [780, 1020],
    ])
    expect(day.baseRanges).toEqual([
      [540, 720],
      [780, 1020],
    ])
  })

  it('extra no sábado e extra até 24:00', () => {
    const d = withExc(
      exc('2027-05-01', 'extra', '10:00', '12:00'),
      exc('2027-05-07', 'extra', '20:00:00', '24:00:00'),
    )
    expect(isSlotAvailable('2027-05-01T13:00:00Z', 60, d, SP)).toBe('ok')
    expect(effectiveDay('2027-05-01', d)).toMatchObject({
      ranges: [[600, 720]],
      status: 'disponivel',
    })
    expect(isSlotAvailable('2027-05-08T02:00:00Z', 60, d, SP)).toBe('ok')
    expect(isSlotAvailable('2027-05-08T02:30:00Z', 60, d, SP)).toBe(
      'fora_disponibilidade',
    )
  })

  it('substituir troca o horário do dia', () => {
    const d = withExc(exc('2027-05-04', 'substituir', '18:00', '21:00'))
    const day = effectiveDay('2027-05-04', d)
    expect(day.ranges).toEqual([[1080, 1260]])
    expect(day.status).toBe('parcial')
    expect(isSlotAvailable('2027-05-04T12:00:00Z', 60, d, SP)).toBe(
      'fora_disponibilidade',
    )
    expect(isSlotAvailable('2027-05-04T21:00:00Z', 60, d, SP)).toBe('ok')
  })

  it('fechado => bloqueado', () => {
    const d = withExc(exc('2027-05-05', 'fechado'))
    expect(isSlotAvailable('2027-05-05T12:00:00Z', 60, d, SP)).toBe('bloqueado')
    expect(effectiveDay('2027-05-05', d)).toMatchObject({ ranges: [], status: 'fechado' })
  })

  it('férias e feriado bloqueiam por cima de tudo', () => {
    const d: AvailabilityData = {
      ...withExc(exc('2027-05-11', 'extra', '10:00', '12:00')),
      blocked: [
        block('2027-05-10', '2027-05-14', 'ferias'),
        block('2027-09-07', '2027-09-07', 'Feriado: Independência'),
      ],
    }
    expect(isSlotAvailable('2027-05-10T12:00:00Z', 60, d, SP)).toBe('bloqueado')
    expect(isSlotAvailable('2027-05-11T13:00:00Z', 60, d, SP)).toBe('bloqueado')
    expect(effectiveDay('2027-05-12', d).status).toBe('ferias')
    expect(effectiveDay('2027-09-07', d).status).toBe('feriado')
    expect(effectiveDay('2027-09-07', d).blocked?.reason).toBe('Feriado: Independência')
  })

  it('sem padrão ativo: dia inteiro, nao_configurado; bloqueio de horas continua valendo', () => {
    const d: AvailabilityData = {
      ...withExc(exc('2027-05-03', 'bloqueio', '10:00', '11:00')),
      patterns: [pattern({ active: false })],
    }
    expect(isSlotAvailable('2027-05-15T13:00:00Z', 60, d, SP)).toBe('ok')
    expect(effectiveDay('2027-05-15', d)).toMatchObject({
      ranges: [[0, 1440]],
      status: 'nao_configurado',
    })
    expect(isSlotAvailable('2027-05-03T13:00:00Z', 60, d, SP)).toBe(
      'fora_disponibilidade',
    )
    expect(effectiveDay('2027-05-03', d).status).toBe('parcial')
    // 23:00 local por 60 min cabe até 24:00
    expect(isSlotAvailable('2027-05-16T02:00:00Z', 60, d, SP)).toBe('ok')
  })

  it('faixa inativa e múltiplos padrões com vigência', () => {
    const d = base()
    d.slots.push(slot(1, '07:00:00', '08:00:00', { active: false }))
    expect(effectiveDay('2027-05-03', d).ranges).toEqual([
      [540, 720],
      [780, 1020],
    ])
    d.patterns.push(pattern({ id: 'p2', starts_on: '2028-01-01', ends_on: null }))
    d.slots.push(slot(1, '14:00:00', '15:00:00', { pattern_id: 'p2' }))
    expect(effectiveDay('2028-01-03', d).ranges).toEqual([[840, 900]])
    expect(effectiveDay('2027-12-31', d).ranges).toEqual([
      [540, 720],
      [780, 1020],
    ])
  })
})

describe('fusos', () => {
  it('Sao Paulo: horário de verão começou em 2018-11-04 (00:00 virou 01:00)', () => {
    expect(localParts('2018-11-04T02:59:00Z', SP)).toEqual({
      dateKey: '2018-11-03',
      minute: 1439,
    })
    expect(localParts('2018-11-04T03:00:00Z', SP)).toEqual({
      dateKey: '2018-11-04',
      minute: 60,
    })
    expect(localParts('2018-11-04T12:00:00Z', SP)).toEqual({
      dateKey: '2018-11-04',
      minute: 600,
    })
  })
  it('Sao Paulo: horário de verão terminou em 2019-02-17 (00:00 voltou a 23:00)', () => {
    expect(localParts('2019-02-17T01:30:00Z', SP)).toEqual({
      dateKey: '2019-02-16',
      minute: 1410,
    })
    expect(localParts('2019-02-17T02:30:00Z', SP)).toEqual({
      dateKey: '2019-02-16',
      minute: 1410,
    })
    expect(localParts('2019-02-17T03:00:00Z', SP)).toEqual({
      dateKey: '2019-02-17',
      minute: 0,
    })
  })
  it('a regra acompanha o fuso histórico (verão = UTC-2)', () => {
    const d: AvailabilityData = {
      patterns: [pattern({ starts_on: '2018-01-01', ends_on: null })],
      slots: [slot(1, '09:00:00', '10:00:00')], // segunda
      exceptions: [],
      blocked: [],
    }
    // 2018-12-03 é segunda, em horário de verão: 09:00 local = 11:00Z
    expect(isSlotAvailable('2018-12-03T11:00:00Z', 60, d, SP)).toBe('ok')
    expect(isSlotAvailable('2018-12-03T12:00:00Z', 60, d, SP)).toBe(
      'fora_disponibilidade',
    )
    // 2018-06-04 é segunda, sem verão: 09:00 local = 12:00Z
    expect(isSlotAvailable('2018-06-04T12:00:00Z', 60, d, SP)).toBe('ok')
    expect(isSlotAvailable('2018-06-04T11:00:00Z', 60, d, SP)).toBe(
      'fora_disponibilidade',
    )
  })
  it('virada de dia: 23:30 local é o dia seguinte em UTC', () => {
    expect(localParts('2027-05-04T02:30:00Z', SP)).toEqual({
      dateKey: '2027-05-03',
      minute: 1410,
    })
    const lesson = {
      starts_at: '2027-05-04T02:30:00Z',
      duration_minutes: 30,
      status: 'agendada',
    }
    expect(lessonLocalRange(lesson, SP)).toEqual({
      dateKey: '2027-05-03',
      range: [1410, 1440],
    })
    expect(localParts(new Date('2027-05-04T03:30:00Z'), SP)).toEqual({
      dateKey: '2027-05-04',
      minute: 30,
    })
  })
  it('outro fuso (Lisboa)', () => {
    expect(localParts('2027-07-01T23:30:00Z', 'Europe/Lisbon')).toEqual({
      dateKey: '2027-07-02',
      minute: 30,
    })
  })
})

describe('aulas afetadas e prévia', () => {
  const l = (id: string, iso: string, status = 'agendada', dur = 60) => ({
    id,
    starts_at: iso,
    duration_minutes: dur,
    status,
  })
  const lessons = [
    l('a', '2027-05-03T12:00:00Z'), // 09:00-10:00
    l('b', '2027-05-03T14:30:00Z'), // 11:30-12:30
    l('c', '2027-05-03T16:00:00Z', 'reposicao'), // 13:00
    l('d', '2027-05-03T12:00:00Z', 'cancelada_aluno'),
    l('e', '2027-05-04T02:30:00Z'), // 23:30 do dia 3
    l('f', '2027-05-04T12:00:00Z'),
  ]
  it('sobreposição e dia local', () => {
    const ids = (r: Parameters<typeof affectedLessons>[2], day = '2027-05-03') =>
      affectedLessons(lessons, day, r, SP).map((x) => x.id)
    expect(ids([[570, 700]])).toEqual(['a', 'b'])
    expect(ids([[720, 780]])).toEqual(['b'])
    expect(ids('all')).toEqual(['a', 'b', 'c', 'e'])
    expect(ids('all', '2027-05-04')).toEqual(['f'])
  })
  it('previewChanges lista só dias que mudam', () => {
    const before = base()
    const after: AvailabilityData = {
      ...before,
      exceptions: [
        exc('2027-05-03', 'bloqueio', '10:00', '11:00'),
        exc('2027-05-05', 'fechado'),
      ],
    }
    const diff = previewChanges(before, after, '2027-05-01', '2027-05-10')
    expect(diff.map((x) => x.dateKey)).toEqual(['2027-05-03', '2027-05-05'])
    expect(diff[0]?.after).toEqual([
      [540, 600],
      [660, 720],
      [780, 1020],
    ])
    expect(diff[1]?.after).toEqual([])
    expect(previewChanges(before, before, '2027-01-01', '2027-12-31')).toEqual([])
  })
  it('limita a 400 dias', () => {
    const before = base()
    const after: AvailabilityData = { ...before, patterns: [] }
    expect(
      previewChanges(before, after, '2027-01-01', '2030-12-31').length,
    ).toBeLessThanOrEqual(400)
  })
})

describe('grade', () => {
  it('weekKeys: domingo a sábado', () => {
    expect(weekKeys('2027-05-05')).toEqual([
      '2027-05-02',
      '2027-05-03',
      '2027-05-04',
      '2027-05-05',
      '2027-05-06',
      '2027-05-07',
      '2027-05-08',
    ])
    expect(weekKeys('2027-05-02')[0]).toBe('2027-05-02')
  })
  it('monthGrid fevereiro bissexto de 2028 (começa na terça)', () => {
    const g = monthGrid(2028, 2)
    expect(g).toHaveLength(5)
    expect(g.every((w) => w.length === 7)).toBe(true)
    expect(g[0]?.[0]).toBe('2028-01-30')
    expect(g[0]?.[2]).toBe('2028-02-01')
    expect(g[4]?.[6]).toBe('2028-03-04')
    expect(g.flat()).toContain('2028-02-29')
  })
  it('monthGrid fevereiro de 2026 (começa no domingo, 28 dias) tem 4 semanas', () => {
    const g = monthGrid(2026, 2)
    expect(g).toHaveLength(4)
    expect(g[0]?.[0]).toBe('2026-02-01')
    expect(g[3]?.[6]).toBe('2026-02-28')
  })
})
