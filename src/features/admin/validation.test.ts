import { describe, expect, it } from 'vitest'

import {
  centsToInput,
  normalizeWhatsApp,
  parseBRLToCents,
  validatePixForm,
  validatePlanForm,
  validatePolicyForm,
  type PixFormValues,
  type PlanFormValues,
  type PolicyFormValues,
} from './validation'

describe('parseBRLToCents', () => {
  it.each([
    ['150', 15000],
    ['150,00', 15000],
    ['1.234,56', 123456],
    ['R$ 90,5', 9050],
    ['0', 0],
    ['89.90', 8990],
  ])('aceita %s', (text, cents) => {
    expect(parseBRLToCents(text)).toBe(cents)
  })

  it.each(['', 'abc', '-5', '1,234', '12,3,4'])('rejeita "%s"', (text) => {
    expect(parseBRLToCents(text)).toBeNull()
  })
})

describe('centsToInput', () => {
  it('formata', () => {
    expect(centsToInput(15000)).toBe('150,00')
    expect(centsToInput(9050)).toBe('90,50')
    expect(centsToInput(5)).toBe('0,05')
  })
})

const plan: PlanFormValues = {
  name: ' Mensal ',
  billing_model: 'mensalidade',
  lessons_per_month: '8',
  lessons_in_package: '',
  lesson_duration_minutes: '50',
  price: '480,00',
  description: '',
  active: true,
}

describe('validatePlanForm', () => {
  it('normaliza mensalidade', () => {
    const r = validatePlanForm(plan)
    expect(r.errors).toEqual({})
    expect(r.values).toMatchObject({
      name: 'Mensal',
      lessons_per_month: 8,
      lessons_in_package: null,
      price_cents: 48000,
      description: null,
      currency: 'BRL',
    })
  })

  it('mensalidade exige aulas por mês', () => {
    expect(validatePlanForm({ ...plan, lessons_per_month: '0' }).errors.lessons_per_month).toBeTruthy()
  })

  it('pacote exige aulas no pacote e zera aulas por mês', () => {
    const base = { ...plan, billing_model: 'pacote' as const }
    expect(validatePlanForm(base).errors.lessons_in_package).toBeTruthy()
    const ok = validatePlanForm({ ...base, lessons_in_package: '10' })
    expect(ok.values).toMatchObject({ lessons_per_month: null, lessons_in_package: 10 })
  })

  it('avulsa deixa ambos null', () => {
    const r = validatePlanForm({ ...plan, billing_model: 'avulsa' })
    expect(r.values).toMatchObject({ lessons_per_month: null, lessons_in_package: null })
  })

  it('valida nome, duração e preço', () => {
    const r = validatePlanForm({
      ...plan,
      name: ' ',
      lesson_duration_minutes: '4',
      price: 'x',
    })
    expect(r.values).toBeNull()
    expect(r.errors.name).toBeTruthy()
    expect(r.errors.lesson_duration_minutes).toBeTruthy()
    expect(r.errors.price).toBeTruthy()
    expect(validatePlanForm({ ...plan, lesson_duration_minutes: '481' }).errors.lesson_duration_minutes).toBeTruthy()
  })
})

const policy: PolicyFormValues = {
  cancellation_min_hours: '24',
  late_cancel_band_enabled: true,
  late_cancel_band_min_hours: '12',
  max_makeups_per_month: '2',
  cancellation_policy_text: '',
}

describe('validatePolicyForm', () => {
  it('aceita política válida', () => {
    const r = validatePolicyForm(policy)
    expect(r.errors).toEqual({})
    expect(r.values).toMatchObject({ cancellation_min_hours: 24, cancellation_policy_text: null })
  })

  it('faixa >= prazo é inválida quando ativada', () => {
    expect(
      validatePolicyForm({ ...policy, late_cancel_band_min_hours: '24' }).errors
        .late_cancel_band_min_hours,
    ).toBeTruthy()
  })

  it('faixa desativada não é comparada com o prazo', () => {
    const r = validatePolicyForm({
      ...policy,
      late_cancel_band_enabled: false,
      late_cancel_band_min_hours: '30',
    })
    expect(r.errors).toEqual({})
  })

  it('valida limites', () => {
    const r = validatePolicyForm({
      ...policy,
      cancellation_min_hours: '721',
      max_makeups_per_month: '32',
      cancellation_policy_text: 'a'.repeat(4001),
    })
    expect(r.errors.cancellation_min_hours).toBeTruthy()
    expect(r.errors.max_makeups_per_month).toBeTruthy()
    expect(r.errors.cancellation_policy_text).toBeTruthy()
  })
})

describe('normalizeWhatsApp', () => {
  it('normaliza para dígitos', () => {
    expect(normalizeWhatsApp('+55 (11) 99999-8888').value).toBe('5511999998888')
  })
  it('vazio vira null sem erro', () => {
    expect(normalizeWhatsApp('  ')).toEqual({ value: null })
  })
  it('rejeita tamanho fora de 10–15', () => {
    expect(normalizeWhatsApp('12345').error).toBeTruthy()
    expect(normalizeWhatsApp('1'.repeat(16)).error).toBeTruthy()
  })
})

const emptyPix: PixFormValues = {
  pix_key_type: '',
  pix_key: '',
  receiver_name: '',
  receiver_city: '',
  whatsapp_number: '',
}

describe('validatePixForm', () => {
  it('Pix totalmente vazio é válido e vira null', () => {
    const r = validatePixForm(emptyPix)
    expect(r.errors).toEqual({})
    expect(r.values).toEqual({
      pix_key: null,
      pix_key_type: null,
      receiver_name: null,
      receiver_city: null,
      whatsapp_number: null,
    })
  })

  it('chave sem nome/cidade é inválida', () => {
    const r = validatePixForm({ ...emptyPix, pix_key_type: 'cpf', pix_key: '123.456.789-09' })
    expect(r.values).toBeNull()
    expect(r.errors.receiver_name).toBeTruthy()
    expect(r.errors.receiver_city).toBeTruthy()
  })

  it('chave sem tipo é inválida', () => {
    const r = validatePixForm({
      ...emptyPix,
      pix_key: 'a@b.com',
      receiver_name: 'Ana',
      receiver_city: 'SP',
    })
    expect(r.errors.pix_key_type).toBeTruthy()
  })

  it('valida a chave conforme o tipo e normaliza', () => {
    const base = { ...emptyPix, receiver_name: 'Ana', receiver_city: 'Sao Paulo' }
    expect(validatePixForm({ ...base, pix_key_type: 'cpf', pix_key: '123' }).errors.pix_key).toBeTruthy()
    const ok = validatePixForm({ ...base, pix_key_type: 'email', pix_key: ' Ana@Mail.com ' })
    expect(ok.errors).toEqual({})
    expect(ok.values?.pix_key).toBe('ana@mail.com')
  })

  it('valida tamanhos e WhatsApp', () => {
    const r = validatePixForm({
      ...emptyPix,
      receiver_name: 'x'.repeat(26),
      receiver_city: 'y'.repeat(16),
      whatsapp_number: '123',
    })
    expect(r.errors.receiver_name).toBeTruthy()
    expect(r.errors.receiver_city).toBeTruthy()
    expect(r.errors.whatsapp_number).toBeTruthy()
  })
})
