import { describe, expect, it } from 'vitest'

import {
  isValidEmail,
  isValidHttpUrl,
  isValidMeetLink,
  validateScheduleForm,
  validateStudentForm,
  whatsappNumber,
  type StudentFormValues,
} from './validation'

const base: StudentFormValues = {
  full_name: 'Ana Souza',
  email: 'ana@gmail.com',
  phone: '',
  birth_date: '',
  is_minor: false,
  guardian_consent_name: '',
  consent_date: '',
  guardian_consent_notes: '',
  level: '',
  goal: '',
  plan_id: '',
  meet_link: '',
  status: 'ativo',
  notes_public: '',
}

describe('isValidEmail', () => {
  it('aceita e rejeita', () => {
    expect(isValidEmail('ana@gmail.com')).toBe(true)
    expect(isValidEmail(' ana@empresa.com.br ')).toBe(true)
    expect(isValidEmail('ana@gmail')).toBe(false)
    expect(isValidEmail('ana gmail.com')).toBe(false)
    expect(isValidEmail('')).toBe(false)
  })
})

describe('isValidMeetLink', () => {
  it('aceita só links do Meet', () => {
    expect(isValidMeetLink('https://meet.google.com/abc-defg-hij')).toBe(true)
    expect(isValidMeetLink('https://meet.google.com/lookup/abc123')).toBe(true)
    expect(isValidMeetLink('http://meet.google.com/abc-defg-hij')).toBe(false)
    expect(isValidMeetLink('https://zoom.us/j/123')).toBe(false)
    expect(isValidMeetLink('https://meet.google.com.evil.com/abc-defg-hij')).toBe(false)
    expect(isValidMeetLink('https://meet.google.com/')).toBe(false)
  })
})

describe('isValidHttpUrl', () => {
  it('só http(s)', () => {
    expect(isValidHttpUrl('https://drive.google.com/x')).toBe(true)
    expect(isValidHttpUrl('javascript:alert(1)')).toBe(false)
    expect(isValidHttpUrl('abc')).toBe(false)
  })
})

describe('whatsappNumber', () => {
  it('prefixa 55 em telefone brasileiro', () => {
    expect(whatsappNumber('(11) 91234-5678')).toBe('5511912345678')
    expect(whatsappNumber('+55 11 91234-5678')).toBe('5511912345678')
  })
  it('null quando inválido ou vazio', () => {
    expect(whatsappNumber('1234')).toBeNull()
    expect(whatsappNumber(null)).toBeNull()
  })
})

describe('validateStudentForm', () => {
  const today = '2026-11-07'
  it('aceita ficha mínima', () => {
    expect(validateStudentForm(base, today)).toEqual({})
  })
  it('exige nome e e-mail válidos', () => {
    const e = validateStudentForm({ ...base, full_name: ' ', email: 'x' }, today)
    expect(e.full_name).toBeDefined()
    expect(e.email).toBeDefined()
  })
  it('valida telefone, Meet e data de nascimento', () => {
    const e = validateStudentForm(
      { ...base, phone: '12', meet_link: 'https://x.com', birth_date: '2030-01-01' },
      today,
    )
    expect(e.phone).toBeDefined()
    expect(e.meet_link).toBeDefined()
    expect(e.birth_date).toBeDefined()
  })
  it('consentimento de menor exige o nome do responsável', () => {
    const e = validateStudentForm(
      { ...base, is_minor: true, consent_date: '2026-11-01' },
      today,
    )
    expect(e.guardian_consent_name).toBeDefined()
  })
})

describe('validateScheduleForm', () => {
  const ok = {
    weekday: '1',
    start_time: '14:00',
    duration_minutes: '60',
    starts_on: '2026-11-09',
    ends_on: '',
    active: true,
  }
  it('aceita e rejeita', () => {
    expect(validateScheduleForm(ok)).toEqual({})
    expect(validateScheduleForm({ ...ok, ends_on: '2026-11-01' }).ends_on).toBeDefined()
    expect(
      validateScheduleForm({ ...ok, duration_minutes: '2' }).duration_minutes,
    ).toBeDefined()
    expect(validateScheduleForm({ ...ok, start_time: '' }).start_time).toBeDefined()
  })
})
