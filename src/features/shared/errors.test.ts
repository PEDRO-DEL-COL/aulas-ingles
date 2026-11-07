import { describe, expect, it } from 'vitest'

import { friendlyError, GENERIC_ERROR } from './errors'

describe('friendlyError', () => {
  it('traduz mensagens conhecidas do banco', () => {
    expect(
      friendlyError({ message: 'a aula ja comecou: nao pode ser cancelada' }),
    ).toMatch(/já começou/)
  })
  it('permissão e rede', () => {
    expect(friendlyError({ code: '42501', message: 'x' })).toMatch(/permissão/)
    expect(friendlyError(new TypeError('Failed to fetch'))).toMatch(/conexão/)
  })
  it('fallback', () => {
    expect(friendlyError(null)).toBe(GENERIC_ERROR)
    expect(friendlyError({ message: 'boom' }, 'Falhou')).toBe('Falhou')
  })
})
