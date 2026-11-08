import { describe, expect, it } from 'vitest'

import { isHoneypotTriggered, normalizeContact, validateLead } from './leads'

const ok = { name: 'Ana', contact: '(11) 91234-5678', message: '', consent: true }

describe('normalizeContact', () => {
  it('mantém só dígitos', () => {
    expect(normalizeContact('+55 (11) 91234-5678')).toBe('5511912345678')
  })
})

describe('validateLead', () => {
  it('aceita dados válidos', () => {
    expect(validateLead(ok)).toEqual({})
  })
  it('exige nome', () => {
    expect(validateLead({ ...ok, name: '  ' }).name).toBeDefined()
    expect(validateLead({ ...ok, name: 'a'.repeat(121) }).name).toBeDefined()
  })
  it('valida 10 a 13 dígitos', () => {
    expect(validateLead({ ...ok, contact: '123456789' }).contact).toBeDefined()
    expect(validateLead({ ...ok, contact: '1234567890' }).contact).toBeUndefined()
    expect(validateLead({ ...ok, contact: '1234567890123' }).contact).toBeUndefined()
    expect(validateLead({ ...ok, contact: '12345678901234' }).contact).toBeDefined()
    expect(validateLead({ ...ok, contact: '' }).contact).toBeDefined()
  })
  it('limita a mensagem a 1000', () => {
    expect(validateLead({ ...ok, message: 'x'.repeat(1000) }).message).toBeUndefined()
    expect(validateLead({ ...ok, message: 'x'.repeat(1001) }).message).toBeDefined()
  })
  it('exige consentimento', () => {
    expect(validateLead({ ...ok, consent: false }).consent).toBeDefined()
  })
})

describe('isHoneypotTriggered', () => {
  it('dispara com honeypot preenchido', () => {
    expect(isHoneypotTriggered('http://spam', 0, 60000)).toBe(true)
  })
  it('dispara com envio rápido demais', () => {
    expect(isHoneypotTriggered('', 1000, 2500)).toBe(true)
  })
  it('passa com honeypot vazio e tempo normal', () => {
    expect(isHoneypotTriggered('', 1000, 9000)).toBe(false)
  })
})
