import { describe, expect, it } from 'vitest'
import { cn } from './utils'

describe('cn', () => {
  it('junta classes e ignora valores falsos', () => {
    expect(cn('a', false, undefined, 'b')).toBe('a b')
  })

  it('resolve conflitos do Tailwind mantendo a última classe', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4')
  })
})
