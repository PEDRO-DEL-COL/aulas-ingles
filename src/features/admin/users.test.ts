import { describe, expect, it } from 'vitest'

import { canChangeAccess, filterProfiles, roleLabel, type ProfileRow } from './users'

function p(over: Partial<ProfileRow> & { id: string }): ProfileRow {
  return {
    full_name: 'Fulana',
    email: 'f@x.com',
    role: 'aluno',
    active: true,
    created_at: '2026-01-01T00:00:00Z',
    terms_accepted_at: null,
    ...over,
  }
}

describe('roleLabel', () => {
  it('traduz papéis', () => {
    expect(roleLabel('aluno')).toBe('Aluno')
    expect(roleLabel('professora')).toBe('Professora')
    expect(roleLabel('admin')).toBe('Admin')
    expect(roleLabel('responsavel')).toBe('Sem acesso (responsável)')
  })
})

describe('canChangeAccess', () => {
  const a1 = p({ id: 'a1', role: 'admin' })
  const a2 = p({ id: 'a2', role: 'admin' })
  const s = p({ id: 's1' })

  it('bloqueia alterar a si mesmo', () => {
    expect(canChangeAccess(a1, a1, [a1, a2]).ok).toBe(false)
  })
  it('bloqueia o último admin ativo', () => {
    const r = canChangeAccess(a2, a1, [a1, a2])
    expect(r.ok).toBe(true)
    const inactive = p({ id: 'a1', role: 'admin', active: false })
    const last = canChangeAccess(a2, inactive, [inactive, a2])
    expect(last.ok).toBe(false)
  })
  it('permite alterar aluno', () => {
    expect(canChangeAccess(s, a1, [a1, s])).toEqual({ ok: true })
  })
  it('sem usuário logado, nega', () => {
    expect(canChangeAccess(s, null, [s]).ok).toBe(false)
  })
})

describe('filterProfiles', () => {
  const list = [
    p({ id: '1', full_name: 'José Álvaro', email: 'jose@x.com' }),
    p({ id: '2', full_name: 'Maria', email: 'maria@x.com', role: 'professora' }),
    p({ id: '3', full_name: 'Ana', email: 'ana@x.com', active: false }),
  ]
  it('busca sem acento e maiúsculas', () => {
    expect(filterProfiles(list, 'ALVARO', 'todos').map((x) => x.id)).toEqual(['1'])
    expect(filterProfiles(list, 'MARIA@', 'todos').map((x) => x.id)).toEqual(['2'])
  })
  it('filtra por situação e papel', () => {
    expect(filterProfiles(list, '', 'inativos').map((x) => x.id)).toEqual(['3'])
    expect(filterProfiles(list, '', 'ativos')).toHaveLength(2)
    expect(filterProfiles(list, '', 'professora').map((x) => x.id)).toEqual(['2'])
  })
})
