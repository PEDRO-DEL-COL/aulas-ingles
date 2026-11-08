/**
 * Formulário público "Quero uma aula experimental". REST puro com a chave anon,
 * SEM supabase-js (a landing precisa continuar leve). Anon só tem INSERT em leads.
 */
import { friendlyError } from '@/features/shared/errors'

export const LEAD_LIMITS = { name: 120, message: 1000, contactMin: 10, contactMax: 13 }
/** Envios feitos antes disso após a montagem do formulário são tratados como robô. */
export const MIN_FILL_MS = 3000

export type LeadInput = {
  name: string
  contact: string
  message: string
  consent: boolean
}
export type LeadErrors = Partial<
  Record<'name' | 'contact' | 'message' | 'consent', string>
>

/** Só dígitos. */
export function normalizeContact(value: string): string {
  return value.replace(/\D/g, '')
}

export function validateLead(input: LeadInput): LeadErrors {
  const errors: LeadErrors = {}
  const name = input.name.trim()
  if (name === '') errors.name = 'Informe seu nome.'
  else if (name.length > LEAD_LIMITS.name) errors.name = 'Use até 120 caracteres.'

  const digits = normalizeContact(input.contact)
  if (digits === '') errors.contact = 'Informe seu WhatsApp.'
  else if (
    digits.length < LEAD_LIMITS.contactMin ||
    digits.length > LEAD_LIMITS.contactMax
  )
    errors.contact = 'WhatsApp inválido. Use DDD + número, ex.: (11) 91234-5678.'

  if (input.message.length > LEAD_LIMITS.message)
    errors.message = 'Use até 1000 caracteres.'
  if (!input.consent) errors.consent = 'Marque a caixa para autorizarmos o contato.'
  return errors
}

/** true = provável robô: honeypot preenchido ou envio rápido demais. */
export function isHoneypotTriggered(
  honeypot: string,
  mountedAt: number,
  now: number,
): boolean {
  return honeypot.trim() !== '' || now - mountedAt < MIN_FILL_MS
}

export type SubmitResult = { ok: true } | { ok: false; error: string }

const UNAVAILABLE = 'Envio indisponível no momento; use o WhatsApp.'

export async function submitLead(
  input: LeadInput,
  signal?: AbortSignal,
): Promise<SubmitResult> {
  const url = (import.meta.env.VITE_SUPABASE_URL ?? '').trim().replace(/\/+$/, '')
  const key = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? '').trim()
  if (!url || !key) return { ok: false, error: UNAVAILABLE }
  const fallback = 'Não foi possível enviar agora. Tente de novo ou use o WhatsApp.'
  try {
    const message = input.message.trim()
    const res = await fetch(`${url}/rest/v1/leads`, {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        name: input.name.trim(),
        contact: normalizeContact(input.contact),
        message: message === '' ? null : message,
        source: 'landing',
        consent: true,
      }),
      signal,
    })
    if (res.status === 201 || res.status === 204) return { ok: true }
    let body: unknown = null
    try {
      body = await res.json()
    } catch {
      /* corpo vazio ou não-JSON */
    }
    return { ok: false, error: friendlyError(body, fallback) }
  } catch (err) {
    return { ok: false, error: friendlyError(err, fallback) }
  }
}
