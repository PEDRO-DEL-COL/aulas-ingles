import type { Tables } from '@/types/database'

import type { Tone } from './lessons'

export type InvoiceStatus = Tables<'invoices'>['status']

/** Cobrança com o status efetivo (atrasado derivado pela view) e campos não nulos. */
export type Invoice = Tables<'invoices'> & { effective_status: InvoiceStatus }

const STATUS: Record<InvoiceStatus, { label: string; tone: Tone }> = {
  em_aberto: { label: 'Em aberto', tone: 'warning' },
  pago: { label: 'Pago', tone: 'success' },
  atrasado: { label: 'Atrasado', tone: 'destructive' },
  cancelado: { label: 'Cancelado', tone: 'muted' },
}

export function invoiceStatusInfo(status: InvoiceStatus): { label: string; tone: Tone } {
  return STATUS[status]
}

export function isPayable(status: InvoiceStatus): boolean {
  return status === 'em_aberto' || status === 'atrasado'
}

/** Cobrança a destacar: atrasadas primeiro, depois a de vencimento mais próximo. */
export function pickNextInvoice<T extends Pick<Invoice, 'effective_status' | 'due_date'>>(
  invoices: readonly T[],
): T | null {
  const payable = invoices.filter((i) => isPayable(i.effective_status))
  payable.sort((a, b) => {
    const wa = a.effective_status === 'atrasado' ? 0 : 1
    const wb = b.effective_status === 'atrasado' ? 0 : 1
    return wa - wb || a.due_date.localeCompare(b.due_date)
  })
  return payable[0] ?? null
}
