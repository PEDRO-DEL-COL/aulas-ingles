import { describe, expect, it } from 'vitest'

import {
  daySummary,
  fetchWindow,
  layoutOverlaps,
  minuteFromOffset,
  parseCalendarParams,
  periodTitle,
  removedByChange,
  selectDayRange,
  selectMinutes,
  serializeCalendarParams,
  shiftDate,
  visibleKeys,
} from './calendarUi'
import type { AvailabilityData } from './engine'

const TODAY = '2026-11-08'
const empty: AvailabilityData = { patterns: [], slots: [], exceptions: [], blocked: [] }

describe('URL', () => {
  it('lê visão e data válidas', () => {
    expect(parseCalendarParams('?visao=semana&data=2026-05-12', TODAY)).toEqual({
      view: 'semana',
      date: '2026-05-12',
      panel: null,
    })
  })
  it('usa padrões quando inválido', () => {
    const r = parseCalendarParams('?visao=ano&data=2026-02-31&painel=x', TODAY, 'dia')
    expect(r).toEqual({ view: 'dia', date: TODAY, panel: null })
  })
  it('lê painel e faz ida e volta', () => {
    expect(parseCalendarParams('painel=feriados', TODAY).panel).toBe('feriados')
    const s = serializeCalendarParams('mes', '2026-05-12')
    expect(s).toBe('visao=mes&data=2026-05-12')
    expect(parseCalendarParams(s, TODAY)).toMatchObject({
      view: 'mes',
      date: '2026-05-12',
    })
  })
})

describe('datas', () => {
  it('shiftDate limita o dia ao fim do mês', () => {
    expect(shiftDate('mes', '2026-01-31', 1)).toBe('2026-02-28')
    expect(shiftDate('mes', '2026-01-15', -1)).toBe('2025-12-15')
    expect(shiftDate('semana', '2026-11-08', 1)).toBe('2026-11-15')
    expect(shiftDate('dia', '2026-11-01', -1)).toBe('2026-10-31')
  })
  it('visibleKeys e fetchWindow', () => {
    const keys = visibleKeys('mes', '2026-11-08')
    expect(keys.length % 7).toBe(0)
    expect(keys[0]).toBe('2026-11-01')
    expect(fetchWindow('mes', '2026-11-08').from).toBe('2026-11-01')
    expect(fetchWindow('semana', '2026-11-08')).toEqual({
      from: '2026-11-01',
      to: '2026-11-21',
    })
  })
  it('títulos', () => {
    expect(periodTitle('mes', '2026-11-08')).toBe('novembro de 2026')
    expect(periodTitle('dia', '2026-05-12')).toContain('12 de maio')
  })
})

describe('resumo do dia', () => {
  it('monta o aria-label', () => {
    expect(daySummary('2026-05-12', 'parcial', 2)).toBe(
      'terça-feira, 12 de maio: parcial, 2 aulas',
    )
    expect(daySummary('2026-05-12', 'feriado', 0)).toContain('sem aulas')
  })
})

describe('seleção por arrasto', () => {
  it('ordena dias', () => {
    expect(selectDayRange('2026-05-14', '2026-05-12')).toEqual({
      from: '2026-05-12',
      to: '2026-05-14',
    })
  })
  it('minutos com snap', () => {
    expect(selectMinutes(603, 650)).toEqual([600, 660])
    expect(selectMinutes(650, 603, 30)).toEqual([600, 660])
    expect(selectMinutes(600, 600)).toEqual([600, 615])
    expect(selectMinutes(1435, 1440)).toEqual([1425, 1440])
  })
  it('minuteFromOffset', () => {
    expect(minuteFromOffset(72, 1.2, 360)).toBe(420)
    expect(minuteFromOffset(80, 1.2, 360, 15)).toBe(420)
    expect(minuteFromOffset(-500, 1.2, 360)).toBe(0)
  })
})

describe('layoutOverlaps', () => {
  it('um item ocupa tudo', () => {
    expect(layoutOverlaps([{ id: 'a', start: 0, end: 60 }])).toEqual([
      { id: 'a', col: 0, cols: 1 },
    ])
  })
  it('sobrepostos ficam lado a lado e grupos independentes não se afetam', () => {
    const r = layoutOverlaps([
      { id: 'a', start: 60, end: 120 },
      { id: 'b', start: 90, end: 150 },
      { id: 'c', start: 100, end: 110 },
      { id: 'd', start: 300, end: 360 },
    ])
    const by = Object.fromEntries(r.map((x) => [x.id, x]))
    expect(by.a).toEqual({ id: 'a', col: 0, cols: 3 })
    expect(by.b?.col).toBe(1)
    expect(by.c?.col).toBe(2)
    expect(by.d).toEqual({ id: 'd', col: 0, cols: 1 })
  })
  it('reaproveita coluna livre', () => {
    const r = layoutOverlaps([
      { id: 'a', start: 0, end: 60 },
      { id: 'b', start: 30, end: 90 },
      { id: 'c', start: 60, end: 120 },
    ])
    expect(r.find((x) => x.id === 'c')).toEqual({ id: 'c', col: 0, cols: 2 })
  })
})

describe('removedByChange', () => {
  it('fechar o dia remove tudo; bloquear remove só a faixa', () => {
    expect(removedByChange(empty, '2026-05-12', [{ kind: 'fechado' }], [])).toBe('all')
    expect(
      removedByChange(
        empty,
        '2026-05-12',
        [{ kind: 'bloqueio', start_time: '10:00', end_time: '11:00' }],
        [],
      ),
    ).toEqual([[600, 660]])
    expect(
      removedByChange(
        empty,
        '2026-05-12',
        [{ kind: 'extra', start_time: '10:00', end_time: '11:00' }],
        [],
      ),
    ).toEqual([])
  })
})
