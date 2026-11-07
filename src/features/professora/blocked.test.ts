import { describe, expect, it } from 'vitest'

import {
  classifyBlockedDates,
  formatBlockedRange,
  isDateBlocked,
  validateBlockedDateForm,
  validateMaterialForm,
  type MaterialFormValues,
} from './blocked'

describe('validateBlockedDateForm', () => {
  it('aceita um dia só (fim vazio)', () => {
    expect(
      validateBlockedDateForm({ starts_on: '2026-12-25', ends_on: '', reason: '' }),
    ).toEqual({})
  })
  it('exige data inicial e rejeita fim antes do início', () => {
    expect(
      validateBlockedDateForm({ starts_on: '', ends_on: '', reason: '' }).starts_on,
    ).toBeDefined()
    expect(
      validateBlockedDateForm({
        starts_on: '2026-12-25',
        ends_on: '2026-12-24',
        reason: '',
      }).ends_on,
    ).toBeDefined()
  })
  it('limita o motivo a 200 caracteres', () => {
    const r = 'a'.repeat(201)
    expect(
      validateBlockedDateForm({ starts_on: '2026-12-25', ends_on: '', reason: r }).reason,
    ).toBeDefined()
  })
})

describe('isDateBlocked', () => {
  const list = [{ starts_on: '2026-12-24', ends_on: '2027-01-06' }]
  it('inclui os extremos', () => {
    expect(isDateBlocked('2026-12-24', list)).toBe(true)
    expect(isDateBlocked('2027-01-06', list)).toBe(true)
    expect(isDateBlocked('2026-12-23', list)).toBe(false)
    expect(isDateBlocked('2027-01-07', list)).toBe(false)
  })
})

describe('classifyBlockedDates', () => {
  it('separa atuais, futuras e passadas', () => {
    const a = { starts_on: '2026-11-01', ends_on: '2026-11-10' }
    const b = { starts_on: '2026-12-24', ends_on: '2027-01-06' }
    const c = { starts_on: '2026-10-01', ends_on: '2026-10-02' }
    const d = { starts_on: '2026-09-01', ends_on: '2026-09-02' }
    const r = classifyBlockedDates([d, b, a, c], '2026-11-07')
    expect(r.atuais).toEqual([a])
    expect(r.futuras).toEqual([b])
    expect(r.passadas).toEqual([c, d])
  })
  it('dia de hoje como fim ainda é atual', () => {
    const a = { starts_on: '2026-11-07', ends_on: '2026-11-07' }
    expect(classifyBlockedDates([a], '2026-11-07').atuais).toEqual([a])
  })
})

describe('formatBlockedRange', () => {
  it('formata dia único e intervalo', () => {
    expect(formatBlockedRange('2026-12-24', '2026-12-24')).toBe('24/12/2026')
    expect(formatBlockedRange('2026-12-24', '2027-01-06')).toBe('24/12/2026 a 06/01/2027')
  })
})

describe('validateMaterialForm', () => {
  const ok: MaterialFormValues = {
    title: 'Apostila',
    url: 'https://drive.google.com/file/d/1',
    description: '',
    targetKind: 'geral',
    studentId: '',
    lessonId: '',
  }
  it('aceita material geral válido', () => {
    expect(validateMaterialForm(ok)).toEqual({})
  })
  it('valida título e URL', () => {
    expect(validateMaterialForm({ ...ok, title: ' ' }).title).toBeDefined()
    expect(validateMaterialForm({ ...ok, title: 'a'.repeat(201) }).title).toBeDefined()
    expect(validateMaterialForm({ ...ok, url: 'javascript:alert(1)' }).url).toBeDefined()
    expect(validateMaterialForm({ ...ok, url: '' }).url).toBeDefined()
  })
  it('valida descrição e alvo', () => {
    expect(
      validateMaterialForm({ ...ok, description: 'a'.repeat(2001) }).description,
    ).toBeDefined()
    expect(validateMaterialForm({ ...ok, targetKind: 'aluno' }).studentId).toBeDefined()
    expect(
      validateMaterialForm({ ...ok, targetKind: 'aula', studentId: 's' }).lessonId,
    ).toBeDefined()
    expect(
      validateMaterialForm({ ...ok, targetKind: 'aula', studentId: 's', lessonId: 'l' }),
    ).toEqual({})
    expect(validateMaterialForm({ ...ok, targetKind: '' }).targetKind).toBeDefined()
  })
})
