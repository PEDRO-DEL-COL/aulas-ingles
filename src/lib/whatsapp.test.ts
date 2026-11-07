import { describe, expect, it } from 'vitest'

import { buildWhatsAppLink } from './whatsapp'

describe('buildWhatsAppLink', () => {
  it('mantém apenas os dígitos do número', () => {
    expect(buildWhatsAppLink('+55 (11) 91234-5678', 'oi')).toBe(
      'https://wa.me/5511912345678?text=oi',
    )
  })

  it('codifica a mensagem para URL', () => {
    const msg = 'Olá! Quero uma aula & mais?'
    const link = buildWhatsAppLink('5511912345678', msg)
    expect(link).toBe(`https://wa.me/5511912345678?text=${encodeURIComponent(msg)}`)
    expect(link).toContain('%C3%A1')
    expect(link).toContain('%26')
  })
})
