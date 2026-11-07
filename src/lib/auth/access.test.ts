import { describe, expect, it } from 'vitest'

import { CURRENT_TERMS_VERSION } from '@/config/legal'

import { homePathForRole, resolveAccess, safeReturnPath, type UserRole } from './access'

const base = {
  active: true,
  role: 'aluno' as UserRole,
  terms_accepted_at: '2026-11-07T10:00:00Z' as string | null,
  terms_version: CURRENT_TERMS_VERSION as string | null,
}

describe('homePathForRole', () => {
  it('mapeia papéis para a área', () => {
    expect(homePathForRole('aluno')).toBe('/app/aluno')
    expect(homePathForRole('professora')).toBe('/app/professora')
    expect(homePathForRole('admin')).toBe('/app/admin')
  })
  it('responsavel e ausente não têm área', () => {
    expect(homePathForRole('responsavel')).toBeNull()
    expect(homePathForRole(null)).toBeNull()
    expect(homePathForRole(undefined)).toBeNull()
  })
})

describe('resolveAccess', () => {
  it('sem perfil, inativo ou responsavel => not_released', () => {
    expect(resolveAccess(null)).toBe('not_released')
    expect(resolveAccess({ ...base, active: false })).toBe('not_released')
    expect(resolveAccess({ ...base, role: 'responsavel' })).toBe('not_released')
  })
  it('termos pendentes => needs_terms', () => {
    expect(resolveAccess({ ...base, terms_accepted_at: null })).toBe('needs_terms')
    expect(resolveAccess({ ...base, terms_version: null })).toBe('needs_terms')
    expect(resolveAccess({ ...base, terms_version: '2020-01-01' })).toBe('needs_terms')
  })
  it('termos pendentes têm prioridade sobre papel errado', () => {
    expect(resolveAccess({ ...base, terms_accepted_at: null }, ['admin'])).toBe(
      'needs_terms',
    )
  })
  it('papel errado => forbidden', () => {
    expect(resolveAccess(base, ['professora', 'admin'])).toBe('forbidden')
    expect(resolveAccess({ ...base, role: 'professora' }, ['admin'])).toBe('forbidden')
  })
  it('papel permitido => allowed (admin acessa área da professora)', () => {
    expect(resolveAccess(base, ['aluno'])).toBe('allowed')
    expect(resolveAccess({ ...base, role: 'admin' }, ['professora', 'admin'])).toBe(
      'allowed',
    )
    expect(resolveAccess(base)).toBe('allowed')
  })
})

describe('safeReturnPath', () => {
  it('aceita caminhos internos', () => {
    expect(safeReturnPath('/app/aluno')).toBe('/app/aluno')
    expect(safeReturnPath('/app/aluno?x=1#a')).toBe('/app/aluno?x=1#a')
  })
  it('rejeita externos e malformados', () => {
    const ruins = [
      '//evil.com',
      '/\\evil.com',
      'https://evil.com',
      'app',
      '',
      '/a\nb',
      null,
      42,
    ]
    for (const v of ruins) {
      expect(safeReturnPath(v)).toBe('/app')
    }
  })
  it('usa o fallback informado', () => {
    expect(safeReturnPath('//x', '/login')).toBe('/login')
  })
})
