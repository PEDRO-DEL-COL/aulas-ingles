import { describe, expect, it } from 'vitest'

import type { Tables } from '@/types/database'

import { effectiveDay, previewChanges, type AvailabilityData } from './engine'
import {
  buildDayRanges,
  countAvailableDays,
  defaultWizardState,
  formatWeekdays,
  hasWizardErrors,
  lessonsOutsideAfterChange,
  previewWindow,
  simulateData,
  simulateDelete,
  slotsFromWizard,
  summarizePattern,
  toAdvanced,
  untilYearEnd,
  validateDayInput,
  validateWizard,
  wholeYearPeriod,
  wizardFromPattern,
  type WizardState,
} from './wizard'

const SP = 'America/Sao_Paulo'
const EMPTY: AvailabilityData = { patterns: [], slots: [], exceptions: [], blocked: [] }

function state(over: Partial<WizardState> = {}): WizardState {
  return {
    ...defaultWizardState('2026-11-09'),
    breaks: [{ start: '12:00', end: '13:00' }],
    endsOn: '2026-12-31',
    ...over,
  }
}

describe('buildDayRanges', () => {
  it('desconta intervalos', () => {
    expect(buildDayRanges('09:00', '17:00', [{ start: '12:00', end: '13:00' }])).toEqual([
      [540, 720],
      [780, 1020],
    ])
  })

  it('sem intervalos devolve uma faixa', () => {
    expect(buildDayRanges('09:00', '12:00', [])).toEqual([[540, 720]])
  })

  it('fim antes do início é inválido', () => {
    expect(buildDayRanges('17:00', '09:00', [])).toEqual([])
    expect(validateDayInput('17:00', '09:00', [])[0]).toMatch(/depois do início/)
  })

  it('intervalo fora do horário é inválido', () => {
    const bad = [{ start: '08:00', end: '10:00' }]
    expect(validateDayInput('09:00', '17:00', bad)[0]).toMatch(/dentro do horário/)
    expect(buildDayRanges('09:00', '17:00', bad)).toEqual([])
  })

  it('intervalos sobrepostos são inválidos', () => {
    const errs = validateDayInput('09:00', '17:00', [
      { start: '12:00', end: '13:30' },
      { start: '13:00', end: '14:00' },
    ])
    expect(errs.join(' ')).toMatch(/se sobrepõem/)
  })

  it('intervalo invertido, vazio ou cobrindo tudo é inválido', () => {
    expect(
      validateDayInput('09:00', '17:00', [{ start: '13:00', end: '12:00' }]),
    ).toHaveLength(1)
    expect(validateDayInput('09:00', '17:00', [{ start: '', end: '12:00' }])[0]).toMatch(
      /informe/,
    )
    expect(
      validateDayInput('09:00', '17:00', [{ start: '09:00', end: '17:00' }])[0],
    ).toMatch(/todo o horário/)
  })

  it('intervalo colado na borda não cria faixa vazia', () => {
    expect(buildDayRanges('09:00', '12:00', [{ start: '11:00', end: '12:00' }])).toEqual([
      [540, 660],
    ])
  })
})

describe('slotsFromWizard', () => {
  it('gera uma faixa por bloco e por dia, em ordem', () => {
    const slots = slotsFromWizard(state({ weekdays: [3, 1] }))
    expect(slots).toEqual([
      { weekday: 1, start_time: '09:00', end_time: '12:00' },
      { weekday: 1, start_time: '13:00', end_time: '17:00' },
      { weekday: 3, start_time: '09:00', end_time: '12:00' },
      { weekday: 3, start_time: '13:00', end_time: '17:00' },
    ])
  })

  it('modo por dia usa blocos de cada dia', () => {
    const s = state({
      advanced: true,
      weekdays: [1, 6],
      dayBlocks: {
        1: [
          { start: '08:00', end: '10:00' },
          { start: '14:00', end: '16:00' },
        ],
        6: [{ start: '09:00', end: '12:00' }],
      },
    })
    expect(slotsFromWizard(s)).toEqual([
      { weekday: 1, start_time: '08:00', end_time: '10:00' },
      { weekday: 1, start_time: '14:00', end_time: '16:00' },
      { weekday: 6, start_time: '09:00', end_time: '12:00' },
    ])
  })

  it('estado inválido não gera faixas', () => {
    expect(slotsFromWizard(state({ start: '18:00' }))).toEqual([])
  })
})

describe('wizardFromPattern', () => {
  const pattern: Tables<'availability_patterns'> = {
    id: 'p1',
    name: 'Meu horário',
    starts_on: '2026-01-01',
    ends_on: null,
    default_lesson_minutes: 50,
    active: true,
    created_at: '',
    updated_at: '',
  }
  const slot = (weekday: number, a: string, b: string): Tables<'availability_slots'> => ({
    id: `${weekday}${a}`,
    pattern_id: 'p1',
    weekday,
    start_time: `${a}:00`,
    end_time: `${b}:00`,
    timezone: SP,
    active: true,
    notes: null,
    created_at: '',
    updated_at: '',
  })

  it('ida e volta no modo simples', () => {
    const original = state({ weekdays: [1, 2, 3, 4, 5], lessonMinutes: 50, endsOn: '' })
    const slots = slotsFromWizard(original).map((s) =>
      slot(s.weekday, s.start_time, s.end_time),
    )
    const back = wizardFromPattern(pattern, slots)
    expect(back.advanced).toBe(false)
    expect(back.weekdays).toEqual([1, 2, 3, 4, 5])
    expect(back.start).toBe('09:00')
    expect(back.end).toBe('17:00')
    expect(back.breaks).toEqual([{ start: '12:00', end: '13:00' }])
    expect(back.lessonMinutes).toBe(50)
    expect(back.endsOn).toBe('')
    expect(back.name).toBe('Meu horário')
  })

  it('dias com faixas diferentes viram modo por dia', () => {
    const back = wizardFromPattern(pattern, [
      slot(1, '09:00', '12:00'),
      slot(1, '14:00', '17:00'),
      slot(2, '09:00', '12:00'),
      slot(6, '08:00', '10:00'),
    ])
    expect(back.advanced).toBe(true)
    expect(back.weekdays).toEqual([1, 2, 6])
    expect(back.dayBlocks[1]).toHaveLength(2)
    expect(back.dayBlocks[6]).toEqual([{ start: '08:00', end: '10:00' }])
  })

  it('ignora faixas de outro padrão e inativas', () => {
    const other = { ...slot(1, '09:00', '10:00'), pattern_id: 'x' }
    const off = { ...slot(2, '09:00', '10:00'), active: false }
    expect(wizardFromPattern(pattern, [other, off]).weekdays).toEqual([])
  })
})

describe('validateWizard', () => {
  it('estado padrão é válido', () => {
    expect(hasWizardErrors(validateWizard(state()))).toBe(false)
  })

  it('exige dia da semana', () => {
    expect(validateWizard(state({ weekdays: [] })).weekdays).toMatch(/dia da semana/)
  })

  it('valida horários e intervalos', () => {
    expect(validateWizard(state({ end: '08:00' })).time).toBeDefined()
  })

  it('valida blocos por dia', () => {
    const s = state({
      advanced: true,
      weekdays: [1],
      dayBlocks: {
        1: [
          { start: '09:00', end: '12:00' },
          { start: '11:00', end: '13:00' },
        ],
      },
    })
    expect(validateWizard(s).days?.[1]?.join(' ')).toMatch(/se sobrepõem/)
    expect(validateWizard({ ...s, dayBlocks: { 1: [] } }).days?.[1]?.[0]).toMatch(
      /ao menos uma faixa/,
    )
  })

  it('valida duração e vigência', () => {
    expect(validateWizard(state({ lessonMinutes: 5 })).lessonMinutes).toBeDefined()
    expect(validateWizard(state({ lessonMinutes: 600 })).lessonMinutes).toBeDefined()
    expect(
      validateWizard(
        state({ start: '09:00', end: '09:30', breaks: [], lessonMinutes: 60 }),
      ).lessonMinutes,
    ).toMatch(/comporta/)
    expect(validateWizard(state({ startsOn: '' })).startsOn).toBeDefined()
    expect(validateWizard(state({ startsOn: '2026-02-31' })).startsOn).toMatch(/inválida/)
    expect(validateWizard(state({ endsOn: '2026-11-01' })).endsOn).toMatch(/antes/)
  })

  it('sem data de fim é válido', () => {
    expect(hasWizardErrors(validateWizard(state({ endsOn: '' })))).toBe(false)
  })
})

describe('resumo', () => {
  it('formata dias', () => {
    expect(formatWeekdays([1, 2, 3, 4, 5])).toBe('Seg a Sex')
    expect(formatWeekdays([1, 2, 3, 4, 5, 6])).toBe('Seg a Sáb')
    expect(formatWeekdays([1, 3, 5])).toBe('Seg, Qua e Sex')
    expect(formatWeekdays([1, 2])).toBe('Seg e Ter')
    expect(formatWeekdays([0, 6])).toBe('Sáb e Dom')
    expect(formatWeekdays([1, 2, 3, 5])).toBe('Seg a Qua e Sex')
  })

  it('resume com vigência', () => {
    expect(summarizePattern(state())).toBe(
      'Seg a Sex, 09:00–12:00 e 13:00–17:00, aulas de 60 min, de 09/11/2026 a 31/12/2026',
    )
  })

  it('resume sem fim', () => {
    expect(summarizePattern(state({ endsOn: '', breaks: [] }))).toBe(
      'Seg a Sex, 09:00–17:00, aulas de 60 min, a partir de 09/11/2026, sem data de fim',
    )
  })

  it('agrupa dias com faixas iguais no modo por dia', () => {
    const s = toAdvanced(state({ weekdays: [1, 2, 6], breaks: [] }))
    s.dayBlocks[6] = [{ start: '08:00', end: '12:00' }]
    expect(summarizePattern(s)).toContain('Seg e Ter, 09:00–17:00; Sáb, 08:00–12:00')
  })
})

describe('vigência', () => {
  it('ano todo', () => {
    expect(wholeYearPeriod(2027)).toEqual({
      startsOn: '2027-01-01',
      endsOn: '2027-12-31',
    })
  })
  it('até o fim do ano', () => {
    expect(untilYearEnd('2026-11-09', '2026-11-09')).toBe('2026-12-31')
    expect(untilYearEnd('', '2026-11-09')).toBe('2026-12-31')
  })
})

describe('simulateData e prévia', () => {
  it('padrão novo define a disponibilidade', () => {
    const sim = simulateData(EMPTY, null, state())
    expect(sim.patterns).toHaveLength(1)
    // 2026-11-09 é segunda
    expect(effectiveDay('2026-11-09', sim).ranges).toEqual([
      [540, 720],
      [780, 1020],
    ])
    expect(effectiveDay('2026-11-14', sim).ranges).toEqual([])
    expect(countAvailableDays(sim, '2026-11-09', '2026-11-15')).toBe(5)
  })

  it('editar substitui o padrão e as faixas antigos, sem mutar', () => {
    const first = simulateData(EMPTY, null, state())
    const slotsBefore = first.slots.length
    const id = first.patterns[0]?.id ?? ''
    const edited = simulateData(first, id, state({ weekdays: [1], breaks: [] }))
    expect(first.slots).toHaveLength(slotsBefore)
    expect(edited.patterns).toHaveLength(1)
    expect(edited.slots).toHaveLength(1)
    const changes = previewChanges(first, edited, '2026-11-09', '2026-11-15')
    // segunda perde o almoço-intervalo; ter a sex deixam de ter horário
    expect(changes.map((c) => c.dateKey)).toEqual([
      '2026-11-09',
      '2026-11-10',
      '2026-11-11',
      '2026-11-12',
      '2026-11-13',
    ])
  })

  it('excluir remove padrão e faixas', () => {
    const sim = simulateData(EMPTY, null, state())
    const id = sim.patterns[0]?.id ?? ''
    const del = simulateDelete(sim, id)
    expect(del.patterns).toEqual([])
    expect(del.slots).toEqual([])
  })

  it('aulas fora do novo horário', () => {
    const before = simulateData(EMPTY, null, state())
    const id = before.patterns[0]?.id ?? ''
    const after = simulateData(before, id, state({ end: '11:00', breaks: [] }))
    const mk = (hour: number, status = 'agendada') => ({
      // 2026-11-09 em SP (UTC-3)
      starts_at: `2026-11-09T${String(hour + 3).padStart(2, '0')}:00:00Z`,
      duration_minutes: 60,
      status,
    })
    const lessons = [mk(10), mk(14), mk(15, 'cancelada_aluno'), mk(20)]
    const out = lessonsOutsideAfterChange(lessons, before, after, SP)
    // 10h continua; 14h sai do horário; 15h cancelada é ignorada; 20h já estava fora
    expect(out).toEqual([lessons[1]])
  })
})

describe('previewWindow', () => {
  it('limita a 400 dias quando sem fim', () => {
    const w = previewWindow({ startsOn: '2026-11-09', endsOn: '' }, null, '2026-11-09')
    expect(w?.from).toBe('2026-11-09')
    expect(w?.truncated).toBe(true)
    expect(w?.to).toBe('2027-12-13')
  })
  it('usa o fim da vigência', () => {
    expect(
      previewWindow({ startsOn: '2026-11-09', endsOn: '2026-12-31' }, null, '2026-11-09'),
    ).toEqual({ from: '2026-11-09', to: '2026-12-31', truncated: false })
  })
  it('não começa antes de hoje e devolve null se já passou', () => {
    expect(
      previewWindow({ startsOn: '2026-01-01', endsOn: '2026-12-31' }, null, '2026-11-09')
        ?.from,
    ).toBe('2026-11-09')
    expect(
      previewWindow({ startsOn: '2025-01-01', endsOn: '2025-12-31' }, null, '2026-11-09'),
    ).toBeNull()
  })
  it('considera a vigência antiga ao editar', () => {
    const w = previewWindow(
      { startsOn: '2026-11-09', endsOn: '2026-12-31' },
      { starts_on: '2026-10-01', ends_on: '2027-03-31' },
      '2026-11-09',
    )
    expect(w?.to).toBe('2027-03-31')
  })
})
