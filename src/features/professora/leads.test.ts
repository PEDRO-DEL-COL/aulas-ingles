import { describe, expect, it } from 'vitest'

import {
  filterLeads,
  leadWhatsAppLink,
  studentPrefillFromLead,
  validateLeadNotes,
  welcomeMessage,
  type Lead,
} from './leads'

const base = { message: null, status: 'novo' } as const
const leads = [
  { ...base, name: 'Ana Álvares', contact: '11912345678', message: 'Quero viajar' },
  {
    ...base,
    name: 'Bruno',
    contact: '21988887777',
    status: 'contatado' as Lead['status'],
  },
]

describe('filterLeads', () => {
  it('filtra por status', () => {
    expect(filterLeads(leads, '', 'novo').map((l) => l.name)).toEqual(['Ana Álvares'])
    expect(filterLeads(leads, '', 'todos')).toHaveLength(2)
  })
  it('busca sem acento em nome, mensagem e contato', () => {
    expect(filterLeads(leads, 'alvares', 'todos')).toHaveLength(1)
    expect(filterLeads(leads, 'VIAJAR', 'todos')).toHaveLength(1)
    expect(filterLeads(leads, '(21) 98888', 'todos')).toHaveLength(1)
  })
})

describe('welcomeMessage / leadWhatsAppLink', () => {
  it('usa o primeiro nome', () => {
    expect(welcomeMessage('Ana Álvares')).toContain('Olá, Ana!')
  })
  it('monta wa.me com DDI 55 para telefone brasileiro', () => {
    const link = leadWhatsAppLink({ name: 'Ana', contact: '11912345678' })
    expect(link).toMatch(/^https:\/\/wa\.me\/5511912345678\?text=/)
  })
  it('retorna null para contato inválido', () => {
    expect(leadWhatsAppLink({ name: 'Ana', contact: '123' })).toBeNull()
  })
})

describe('studentPrefillFromLead', () => {
  it('copia nome e telefone', () => {
    expect(studentPrefillFromLead({ name: ' Ana ', contact: '11912345678' })).toEqual({
      full_name: 'Ana',
      phone: '11912345678',
    })
  })
})

describe('validateLeadNotes', () => {
  it('limita a 2000', () => {
    expect(validateLeadNotes('x'.repeat(2000))).toBeNull()
    expect(validateLeadNotes('x'.repeat(2001))).not.toBeNull()
  })
})
