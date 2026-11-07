/** Validações e normalizações puras da ficha do aluno. */

export const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

export function isValidEmail(value: string): boolean {
  const v = value.trim()
  return v.length <= 320 && EMAIL_RE.test(v)
}

const MEET_RE = /^https:\/\/meet\.google\.com\/[A-Za-z0-9_\-/]{3,}(\?\S*)?$/

/** Aceita só links https://meet.google.com/... (ex.: abc-defg-hij). */
export function isValidMeetLink(value: string): boolean {
  const v = value.trim()
  return v.length <= 500 && MEET_RE.test(v)
}

/** Só http(s) para materiais e outros links. */
export function isValidHttpUrl(value: string): boolean {
  const v = value.trim()
  if (v.length === 0 || v.length > 2000) return false
  try {
    const u = new URL(v)
    return u.protocol === 'https:' || u.protocol === 'http:'
  } catch {
    return false
  }
}

/**
 * Número para o wa.me: só dígitos, com DDI. Telefone brasileiro (10 ou 11 dígitos)
 * ganha 55; com 12 a 15 dígitos assume que o DDI já está incluído. Senão, null.
 */
export function whatsappNumber(phone: string | null | undefined): string | null {
  const digits = (phone ?? '').replace(/\D/g, '')
  if (digits.length === 10 || digits.length === 11) return `55${digits}`
  if (digits.length >= 12 && digits.length <= 15) return digits
  return null
}

export type StudentFormValues = {
  full_name: string
  email: string
  phone: string
  birth_date: string
  is_minor: boolean
  guardian_consent_name: string
  /** Data (AAAA-MM-DD) do consentimento; vazio = ainda não registrado. */
  consent_date: string
  guardian_consent_notes: string
  level: string
  goal: string
  plan_id: string
  meet_link: string
  status: 'ativo' | 'pausado' | 'saiu'
  notes_public: string
}

export type StudentFormErrors = Partial<Record<keyof StudentFormValues, string>>

/** `today` = data civil de hoje ("AAAA-MM-DD") para validar datas no futuro. */
export function validateStudentForm(
  v: StudentFormValues,
  today: string,
): StudentFormErrors {
  const errors: StudentFormErrors = {}
  if (v.full_name.trim() === '') errors.full_name = 'Informe o nome do aluno.'
  else if (v.full_name.trim().length > 200) errors.full_name = 'Use até 200 caracteres.'

  if (v.email.trim() === '') errors.email = 'Informe o e-mail da conta Google do aluno.'
  else if (!isValidEmail(v.email))
    errors.email = 'E-mail inválido. Exemplo: nome@gmail.com.'

  if (v.phone.trim() !== '') {
    if (v.phone.trim().length > 30) errors.phone = 'Use até 30 caracteres.'
    else if (whatsappNumber(v.phone) === null)
      errors.phone = 'Telefone inválido. Use DDD + número, ex.: (11) 91234-5678.'
  }

  if (v.birth_date !== '' && v.birth_date > today)
    errors.birth_date = 'A data de nascimento não pode ser no futuro.'

  if (v.meet_link.trim() !== '' && !isValidMeetLink(v.meet_link))
    errors.meet_link =
      'Use um link do Google Meet, como https://meet.google.com/abc-defg-hij.'

  if (v.consent_date > today)
    errors.consent_date = 'A data do consentimento não pode ser no futuro.'
  if (v.is_minor && v.consent_date !== '' && v.guardian_consent_name.trim() === '')
    errors.guardian_consent_name = 'Informe o nome de quem deu o consentimento.'
  else if (v.guardian_consent_name.length > 200)
    errors.guardian_consent_name = 'Use até 200 caracteres.'
  if (v.guardian_consent_notes.length > 2000)
    errors.guardian_consent_notes = 'Use até 2000 caracteres.'
  if (v.level.length > 40) errors.level = 'Use até 40 caracteres.'
  if (v.goal.length > 1000) errors.goal = 'Use até 1000 caracteres.'
  if (v.notes_public.length > 4000) errors.notes_public = 'Use até 4000 caracteres.'
  return errors
}

export const WEEKDAY_LABELS = [
  'Domingo',
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado',
] as const

export type ScheduleFormValues = {
  weekday: string
  start_time: string
  duration_minutes: string
  starts_on: string
  ends_on: string
  active: boolean
}

export function validateScheduleForm(
  v: ScheduleFormValues,
): Partial<Record<keyof ScheduleFormValues, string>> {
  const errors: Partial<Record<keyof ScheduleFormValues, string>> = {}
  const wd = Number(v.weekday)
  if (!Number.isInteger(wd) || wd < 0 || wd > 6)
    errors.weekday = 'Escolha o dia da semana.'
  if (!/^\d{2}:\d{2}/.test(v.start_time)) errors.start_time = 'Informe a hora.'
  const dur = Number(v.duration_minutes)
  if (!Number.isInteger(dur) || dur < 5 || dur > 480)
    errors.duration_minutes = 'A duração deve ficar entre 5 e 480 minutos.'
  if (v.starts_on === '') errors.starts_on = 'Informe a data de início.'
  if (v.ends_on !== '' && v.starts_on !== '' && v.ends_on < v.starts_on)
    errors.ends_on = 'O fim não pode ser antes do início.'
  return errors
}
