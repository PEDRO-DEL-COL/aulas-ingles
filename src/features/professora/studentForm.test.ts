import { describe, expect, it } from 'vitest'

import { emptyStudentValues, filterStudents, payloadFromValues } from './studentForm'

const SP = 'America/Sao_Paulo'

describe('payloadFromValues', () => {
  it('normaliza e-mail e transforma vazios em null', () => {
    const p = payloadFromValues(
      { ...emptyStudentValues(), full_name: ' Ana ', email: ' ANA@Gmail.com ' },
      null,
      SP,
    )
    expect(p.full_name).toBe('Ana')
    expect(p.email).toBe('ana@gmail.com')
    expect(p.phone).toBeNull()
    expect(p.meet_link).toBeNull()
    expect(p.consent_by_guardian_at).toBeNull()
  })

  it('converte a data do consentimento no fuso e preserva a original se o dia não mudou', () => {
    const v = {
      ...emptyStudentValues(),
      full_name: 'A',
      email: 'a@b.co',
      consent_date: '2026-11-03',
    }
    expect(payloadFromValues(v, null, SP).consent_by_guardian_at).toBe(
      '2026-11-03T15:00:00.000Z',
    )
    const kept = payloadFromValues(
      v,
      { consent_by_guardian_at: '2026-11-03T20:10:00Z' },
      SP,
    )
    expect(kept.consent_by_guardian_at).toBe('2026-11-03T20:10:00Z')
  })
})

describe('filterStudents', () => {
  const list = [
    { full_name: 'João Álvares', email: 'joao@x.com', status: 'ativo' as const },
    { full_name: 'Maria', email: 'maria@x.com', status: 'pausado' as const },
  ]
  it('ignora acento e caixa, busca no e-mail e filtra por situação', () => {
    expect(filterStudents(list, 'joao alvares', 'todos')).toHaveLength(1)
    expect(filterStudents(list, 'MARIA@', 'todos')).toHaveLength(1)
    expect(filterStudents(list, '', 'pausado')).toHaveLength(1)
    expect(filterStudents(list, 'zzz', 'todos')).toHaveLength(0)
  })
})
