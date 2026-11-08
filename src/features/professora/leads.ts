/** Regras puras da tela Interessados (leads). */
import { buildWhatsAppLink } from '@/lib/whatsapp'
import type { Tables } from '@/types/database'

import { whatsappNumber } from './validation'

export type Lead = Tables<'leads'>
export type LeadStatus = Lead['status']
export type LeadFilter = LeadStatus | 'todos'

export const NOTES_MAX = 2000

export const LEAD_FILTERS: readonly { value: LeadFilter; label: string }[] = [
  { value: 'novo', label: 'Novos' },
  { value: 'contatado', label: 'Contatados' },
  { value: 'convertido', label: 'Convertidos' },
  { value: 'descartado', label: 'Descartados' },
  { value: 'todos', label: 'Todos' },
]

export const LEAD_STATUS_LABEL: Record<LeadStatus, string> = {
  novo: 'Novo',
  contatado: 'Contatado',
  convertido: 'Convertido',
  descartado: 'Descartado',
}

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/** Filtro por status + busca por nome/contato/mensagem (sem acento, sem caixa). */
export function filterLeads<
  T extends Pick<Lead, 'name' | 'contact' | 'message' | 'status'>,
>(leads: readonly T[], search: string, status: LeadFilter): T[] {
  const q = norm(search.trim())
  const qDigits = q.replace(/\D/g, '')
  return leads.filter((l) => {
    if (status !== 'todos' && l.status !== status) return false
    if (q === '') return true
    return (
      norm(l.name).includes(q) ||
      norm(l.message ?? '').includes(q) ||
      norm(l.contact).includes(q) ||
      (qDigits !== '' && l.contact.replace(/\D/g, '').includes(qDigits))
    )
  })
}

/** Mensagem pronta de boas-vindas para o primeiro contato. */
export function welcomeMessage(name: string): string {
  const first = name.trim().split(/\s+/)[0] ?? ''
  const hello = first ? `Olá, ${first}!` : 'Olá!'
  return `${hello} Aqui é a professora de inglês. Recebi o seu contato pelo site e vou adorar conversar sobre a aula experimental. Qual é o melhor dia e horário para você?`
}

/** Link wa.me do lead; null se o contato não parece um telefone. */
export function leadWhatsAppLink(lead: Pick<Lead, 'name' | 'contact'>): string | null {
  const number = whatsappNumber(lead.contact)
  return number ? buildWhatsAppLink(number, welcomeMessage(lead.name)) : null
}

/** Valores iniciais da ficha de aluno a partir de um lead. */
export function studentPrefillFromLead(lead: Pick<Lead, 'name' | 'contact'>): {
  full_name: string
  phone: string
} {
  return { full_name: lead.name.trim(), phone: lead.contact.trim() }
}

export function validateLeadNotes(notes: string): string | null {
  return notes.length > NOTES_MAX ? `Use até ${NOTES_MAX} caracteres.` : null
}
