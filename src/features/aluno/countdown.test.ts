import { describe, expect, it } from 'vitest'

import { formatCountdown, getCountdown, tickIntervalMs } from './countdown'

const now = new Date('2026-11-07T12:00:00Z')

describe('countdown', () => {
  it('calcula dias, horas e minutos', () => {
    const c = getCountdown('2026-11-09T15:10:00Z', now)
    expect(c).toMatchObject({ days: 2, hours: 3, minutes: 10, started: false })
    expect(formatCountdown(c)).toBe('2 dias, 3 h e 10 min')
  })
  it('singular e omissão de zeros', () => {
    expect(formatCountdown(getCountdown('2026-11-08T12:00:00Z', now))).toBe('1 dia')
    expect(formatCountdown(getCountdown('2026-11-07T13:10:00Z', now))).toBe(
      '1 h e 10 min',
    )
    expect(formatCountdown(getCountdown('2026-11-07T12:10:00Z', now))).toBe('10 min')
  })
  it('arredonda segundos para cima', () => {
    expect(formatCountdown(getCountdown('2026-11-07T12:00:30Z', now))).toBe('1 min')
  })
  it('já começou', () => {
    const c = getCountdown('2026-11-07T11:59:00Z', now)
    expect(c.started).toBe(true)
    expect(formatCountdown(c)).toBe('Agora')
  })
  it('intervalo de atualização', () => {
    expect(tickIntervalMs(getCountdown('2026-11-07T12:03:00Z', now))).toBe(1000)
    expect(tickIntervalMs(getCountdown('2026-11-07T14:00:00Z', now))).toBe(30_000)
  })
})
