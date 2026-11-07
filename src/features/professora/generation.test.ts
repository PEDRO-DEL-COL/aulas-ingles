import { describe, expect, it } from 'vitest'

import { generationMessage, generationRange } from './generation'

describe('generationRange', () => {
  it('semana exibida: do início da semana até 6 dias depois', () => {
    expect(generationRange('semana', '2026-11-08', '2026-11-10')).toEqual({
      from: '2026-11-08',
      to: '2026-11-14',
    })
  })

  it('próximas 4 semanas a partir de hoje (28 dias, inclusivo)', () => {
    expect(generationRange('4', '2026-11-08', '2026-11-10')).toEqual({
      from: '2026-11-10',
      to: '2026-12-07',
    })
  })

  it('próximas 8 semanas atravessando o ano', () => {
    expect(generationRange('8', '2026-12-06', '2026-12-10')).toEqual({
      from: '2026-12-10',
      to: '2027-02-03',
    })
  })
})

describe('generationMessage', () => {
  it('fala do intervalo escolhido', () => {
    expect(generationMessage('semana', 0)).toContain('para esta semana')
    expect(generationMessage('4', 1)).toBe('1 aula criada nas próximas 4 semanas.')
    expect(generationMessage('8', 12)).toBe('12 aulas criadas nas próximas 8 semanas.')
  })
})
