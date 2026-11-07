import { describe, expect, it } from 'vitest'

import { invoiceStatusInfo, isPayable, pickNextInvoice } from './invoices'

describe('invoices', () => {
  it('rótulos e tons', () => {
    expect(invoiceStatusInfo('em_aberto')).toEqual({
      label: 'Em aberto',
      tone: 'warning',
    })
    expect(invoiceStatusInfo('pago').tone).toBe('success')
    expect(invoiceStatusInfo('atrasado').tone).toBe('destructive')
    expect(invoiceStatusInfo('cancelado').tone).toBe('muted')
  })
  it('isPayable', () => {
    expect(isPayable('em_aberto')).toBe(true)
    expect(isPayable('atrasado')).toBe(true)
    expect(isPayable('pago')).toBe(false)
  })
  it('pickNextInvoice prioriza atrasadas e depois o vencimento', () => {
    const paid = { effective_status: 'pago' as const, due_date: '2026-10-10' }
    const list = [
      { effective_status: 'em_aberto' as const, due_date: '2026-12-10' },
      paid,
      { effective_status: 'em_aberto' as const, due_date: '2026-11-20' },
    ]
    expect(pickNextInvoice(list)?.due_date).toBe('2026-11-20')
    const late = [
      ...list,
      { effective_status: 'atrasado' as const, due_date: '2026-11-05' },
    ]
    expect(pickNextInvoice(late)?.due_date).toBe('2026-11-05')
    expect(pickNextInvoice([paid])).toBeNull()
  })
})
