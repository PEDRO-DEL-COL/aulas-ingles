/** Validações e normalizações puras das telas de admin (planos, políticas, Pix). */
import { normalizePixKey, type PixKeyType } from '@/lib/pix'

export const PIX_KEY_TYPES: readonly PixKeyType[] = [
  'cpf',
  'cnpj',
  'email',
  'telefone',
  'aleatoria',
]

export type BillingModel = 'mensalidade' | 'pacote' | 'avulsa'

// ---------- Dinheiro ----------

/** "150", "150,00", "1.234,56", "R$ 90,5" => centavos. Inválido => null. */
export function parseBRLToCents(text: string): number | null {
  const t = text.replace(/R\$/gi, '').replace(/\s/g, '')
  if (t === '') return null
  // Milhar com ponto + vírgula decimal opcional, ou número simples com vírgula/ponto decimal.
  let normalized: string
  if (/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(t)) {
    normalized = t.replace(/\./g, '').replace(',', '.')
  } else if (/^\d+([,.]\d{1,2})?$/.test(t)) {
    normalized = t.replace(',', '.')
  } else {
    return null
  }
  const cents = Math.round(Number(normalized) * 100)
  return Number.isSafeInteger(cents) && cents >= 0 ? cents : null
}

/** 15000 => "150,00" (sem separador de milhar, para editar). */
export function centsToInput(cents: number): string {
  const abs = Math.abs(Math.trunc(cents))
  const reais = Math.floor(abs / 100)
  const rest = String(abs % 100).padStart(2, '0')
  return `${cents < 0 ? '-' : ''}${reais},${rest}`
}

function parseIntStrict(text: string): number | null {
  const t = text.trim()
  if (!/^\d+$/.test(t)) return null
  const n = Number(t)
  return Number.isSafeInteger(n) ? n : null
}

// ---------- Planos ----------

export type PlanFormValues = {
  name: string
  billing_model: BillingModel
  lessons_per_month: string
  lessons_in_package: string
  lesson_duration_minutes: string
  price: string
  description: string
  active: boolean
}

export type PlanFormErrors = Partial<Record<keyof PlanFormValues, string>>

export type PlanPayload = {
  name: string
  billing_model: BillingModel
  lessons_per_month: number | null
  lessons_in_package: number | null
  lesson_duration_minutes: number
  price_cents: number
  currency: 'BRL'
  description: string | null
  active: boolean
}

export function validatePlanForm(v: PlanFormValues): {
  values: PlanPayload | null
  errors: PlanFormErrors
} {
  const errors: PlanFormErrors = {}

  const name = v.name.trim()
  if (name.length < 1) errors.name = 'Informe o nome do plano.'
  else if (name.length > 120) errors.name = 'O nome pode ter no máximo 120 caracteres.'

  const description = v.description.trim()
  if (description.length > 1000)
    errors.description = 'A descrição pode ter no máximo 1000 caracteres.'

  const price = parseBRLToCents(v.price)
  if (price === null) errors.price = 'Informe um valor válido, como 150,00.'

  const duration = parseIntStrict(v.lesson_duration_minutes)
  if (duration === null || duration < 5 || duration > 480)
    errors.lesson_duration_minutes = 'A duração deve ser de 5 a 480 minutos.'

  let perMonth: number | null = null
  let inPackage: number | null = null
  if (v.billing_model === 'mensalidade') {
    perMonth = parseIntStrict(v.lessons_per_month)
    if (perMonth === null || perMonth <= 0)
      errors.lessons_per_month = 'Informe quantas aulas por mês (maior que zero).'
  } else if (v.billing_model === 'pacote') {
    inPackage = parseIntStrict(v.lessons_in_package)
    if (inPackage === null || inPackage <= 0)
      errors.lessons_in_package = 'Informe quantas aulas tem o pacote (maior que zero).'
  }

  if (Object.keys(errors).length > 0 || price === null || duration === null) {
    return { values: null, errors }
  }
  return {
    values: {
      name,
      billing_model: v.billing_model,
      lessons_per_month: perMonth,
      lessons_in_package: inPackage,
      lesson_duration_minutes: duration,
      price_cents: price,
      currency: 'BRL',
      description: description === '' ? null : description,
      active: v.active,
    },
    errors,
  }
}

// ---------- Políticas ----------

export type PolicyFormValues = {
  cancellation_min_hours: string
  late_cancel_band_enabled: boolean
  late_cancel_band_min_hours: string
  max_makeups_per_month: string
  default_due_day: string
  cancellation_policy_text: string
}

export type PolicyFormErrors = Partial<Record<keyof PolicyFormValues, string>>

export type PolicyPayload = {
  cancellation_min_hours: number
  late_cancel_band_enabled: boolean
  late_cancel_band_min_hours: number
  max_makeups_per_month: number
  default_due_day: number
  cancellation_policy_text: string | null
}

export function validatePolicyForm(v: PolicyFormValues): {
  values: PolicyPayload | null
  errors: PolicyFormErrors
} {
  const errors: PolicyFormErrors = {}

  const min = parseIntStrict(v.cancellation_min_hours)
  if (min === null || min > 720)
    errors.cancellation_min_hours = 'Informe um número de horas de 0 a 720.'

  const band = parseIntStrict(v.late_cancel_band_min_hours)
  if (band === null || band > 720) {
    errors.late_cancel_band_min_hours = 'Informe um número de horas de 0 a 720.'
  } else if (v.late_cancel_band_enabled && min !== null && band >= min) {
    errors.late_cancel_band_min_hours =
      'A faixa intermediária precisa ser menor que o prazo mínimo de cancelamento.'
  }

  const makeups = parseIntStrict(v.max_makeups_per_month)
  if (makeups === null || makeups > 31)
    errors.max_makeups_per_month = 'Informe um número de 0 a 31.'

  const dueDay = parseIntStrict(v.default_due_day)
  if (dueDay === null || dueDay < 1 || dueDay > 31)
    errors.default_due_day = 'Informe um dia de 1 a 31.'

  const text = v.cancellation_policy_text.trim()
  if (text.length > 4000)
    errors.cancellation_policy_text = 'O texto pode ter no máximo 4000 caracteres.'

  if (
    Object.keys(errors).length > 0 ||
    min === null ||
    band === null ||
    makeups === null ||
    dueDay === null
  ) {
    return { values: null, errors }
  }
  return {
    values: {
      cancellation_min_hours: min,
      late_cancel_band_enabled: v.late_cancel_band_enabled,
      late_cancel_band_min_hours: band,
      max_makeups_per_month: makeups,
      default_due_day: dueDay,
      cancellation_policy_text: text === '' ? null : text,
    },
    errors,
  }
}

// ---------- WhatsApp ----------

/** Só dígitos (aceita +, espaços, parênteses, hífens). '' => null. Erro se não tiver 10–15 dígitos. */
export function normalizeWhatsApp(text: string): {
  value: string | null
  error?: string
} {
  const digits = text.replace(/\D/g, '')
  if (text.trim() === '' || digits === '') return { value: null }
  if (digits.length < 10 || digits.length > 15) {
    return {
      value: null,
      error:
        'WhatsApp inválido: use DDI + DDD + número (10 a 15 dígitos), ex.: 5511999998888.',
    }
  }
  return { value: digits }
}

// ---------- Pix e contato ----------

export type PixFormValues = {
  pix_key_type: PixKeyType | ''
  pix_key: string
  receiver_name: string
  receiver_city: string
  whatsapp_number: string
}

export type PixFormErrors = Partial<Record<keyof PixFormValues, string>>

export type PixPayload = {
  pix_key: string | null
  pix_key_type: PixKeyType | null
  receiver_name: string | null
  receiver_city: string | null
  whatsapp_number: string | null
}

export function validatePixForm(v: PixFormValues): {
  values: PixPayload | null
  errors: PixFormErrors
} {
  const errors: PixFormErrors = {}

  const rawKey = v.pix_key.trim()
  const name = v.receiver_name.trim()
  const city = v.receiver_city.trim()
  const type = v.pix_key_type === '' ? null : v.pix_key_type

  if (type !== null && !PIX_KEY_TYPES.includes(type))
    errors.pix_key_type = 'Tipo de chave inválido.'

  if (name.length > 25) errors.receiver_name = 'O nome pode ter no máximo 25 caracteres.'
  if (city.length > 15)
    errors.receiver_city = 'A cidade pode ter no máximo 15 caracteres.'

  let key: string | null = null
  if (rawKey !== '') {
    if (rawKey.length > 77) {
      errors.pix_key = 'A chave pode ter no máximo 77 caracteres.'
    } else if (type === null) {
      errors.pix_key_type = 'Escolha o tipo da chave Pix.'
    } else if (!errors.pix_key_type) {
      try {
        key = normalizePixKey(rawKey, type)
      } catch (e) {
        errors.pix_key = e instanceof Error ? e.message : 'Chave Pix inválida.'
      }
    }
    if (name === '')
      errors.receiver_name = 'Informe o nome do recebedor (obrigatório com chave Pix).'
    if (city === '')
      errors.receiver_city = 'Informe a cidade do recebedor (obrigatório com chave Pix).'
  }

  const wa = normalizeWhatsApp(v.whatsapp_number)
  if (wa.error) errors.whatsapp_number = wa.error

  if (Object.keys(errors).length > 0) return { values: null, errors }
  const hasKey = key !== null
  return {
    values: {
      pix_key: key,
      pix_key_type: hasKey ? type : (type ?? null),
      receiver_name: name === '' ? null : name,
      receiver_city: city === '' ? null : city,
      whatsapp_number: wa.value,
    },
    errors,
  }
}
