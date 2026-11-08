import { describe, expect, it } from 'vitest'

import {
  findOverlaps,
  fitsInSlots,
  formatSlot,
  groupSlotsByWeekday,
  slotsForDate,
  validateSlotForm,
  type SlotLike,
} from './availability'

const slot = (weekday: number, s: string, e: string, active = true): SlotLike => ({
  weekday,
  start_time: s,
  end_time: e,
  active,
})

describe('validateSlotForm', () => {
  const ok = { weekday: '1', start_time: '08:00', end_time: '12:00', notes: '' }
  it('aceita faixa válida', () => expect(validateSlotForm(ok)).toEqual({}))
  it('exige dia e horas', () => {
    const e = validateSlotForm({ ...ok, weekday: '', start_time: '', end_time: '' })
    expect(Object.keys(e).sort()).toEqual(['end_time', 'start_time', 'weekday'])
  })
  it('exige início antes do fim', () => {
    expect(validateSlotForm({ ...ok, end_time: '08:00' }).end_time).toBeDefined()
    expect(validateSlotForm({ ...ok, end_time: '07:00' }).end_time).toBeDefined()
  })
  it('rejeita hora inválida', () => {
    expect(validateSlotForm({ ...ok, start_time: '25:00' }).start_time).toBeDefined()
  })
})

describe('agrupamento e formatação', () => {
  it('agrupa por dia e ordena', () => {
    const g = groupSlotsByWeekday([slot(1, '14:00', '18:00'), slot(1, '08:00', '12:00')])
    expect(g).toHaveLength(7)
    expect(g[1]!.map((s) => s.start_time)).toEqual(['08:00', '14:00'])
    expect(g[0]).toEqual([])
  })
  it('formata', () => {
    expect(formatSlot(slot(1, '08:00:00', '12:00:00'))).toBe('Seg 08:00–12:00')
  })
})

describe('findOverlaps', () => {
  it('acha sobreposição ativa no mesmo dia', () => {
    expect(
      findOverlaps([slot(1, '08:00', '12:00'), slot(1, '11:00', '14:00')]),
    ).toHaveLength(1)
  })
  it('ignora encostadas, inativas e dias diferentes', () => {
    expect(findOverlaps([slot(1, '08:00', '12:00'), slot(1, '12:00', '14:00')])).toEqual(
      [],
    )
    expect(
      findOverlaps([slot(1, '08:00', '12:00'), slot(1, '11:00', '14:00', false)]),
    ).toEqual([])
    expect(findOverlaps([slot(1, '08:00', '12:00'), slot(2, '08:00', '12:00')])).toEqual(
      [],
    )
  })
})

describe('slotsForDate / fitsInSlots', () => {
  // 2026-11-09 é segunda-feira (1)
  const slots = [
    slot(1, '08:00:00', '12:00:00'),
    slot(1, '14:00:00', '18:00:00'),
    slot(1, '19:00', '21:00', false),
  ]
  it('lista só ativas do dia', () => {
    expect(slotsForDate('2026-11-09', slots)).toHaveLength(2)
    expect(slotsForDate('2026-11-10', slots)).toEqual([])
  })
  it('a aula inteira precisa caber', () => {
    expect(fitsInSlots('2026-11-09', '08:00', 60, slots)).toBe(true)
    expect(fitsInSlots('2026-11-09', '11:30', 60, slots)).toBe(false)
    expect(fitsInSlots('2026-11-09', '12:00', 30, slots)).toBe(false)
    expect(fitsInSlots('2026-11-09', '19:00', 60, slots)).toBe(false)
    expect(fitsInSlots('2026-11-10', '09:00', 60, slots)).toBe(false)
  })
  it('sem faixas ativas, tudo vale', () => {
    expect(fitsInSlots('2026-11-10', '09:00', 60, [])).toBe(true)
    expect(
      fitsInSlots('2026-11-10', '09:00', 60, [slot(1, '08:00', '09:00', false)]),
    ).toBe(true)
  })
})
