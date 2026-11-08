import { describe, expect, it, vi } from 'vitest'

import {
  canUseViewAs,
  effectiveRole,
  parseViewAs,
  readStored,
  viewAsLabel,
  writeStored,
} from './viewAs'

const admin = { role: 'admin' as const, active: true }

describe('parseViewAs', () => {
  it('aceita os três papéis', () => {
    expect(parseViewAs('aluno')).toBe('aluno')
    expect(parseViewAs('professora')).toBe('professora')
    expect(parseViewAs('admin')).toBe('admin')
  })
  it('valores inválidos viram admin', () => {
    for (const v of [null, undefined, '', 'Aluno', 'responsavel', 1, {}, [], 'aluno ']) {
      expect(parseViewAs(v)).toBe('admin')
    }
  })
})

describe('canUseViewAs / effectiveRole', () => {
  it('só admin ativo', () => {
    expect(canUseViewAs(admin)).toBe(true)
    expect(canUseViewAs({ role: 'admin', active: false })).toBe(false)
    expect(canUseViewAs({ role: 'professora', active: true })).toBe(false)
    expect(canUseViewAs({ role: 'aluno', active: true })).toBe(false)
    expect(canUseViewAs(null)).toBe(false)
    expect(canUseViewAs(undefined)).toBe(false)
  })
  it('admin usa o valor escolhido', () => {
    expect(effectiveRole(admin, 'aluno')).toBe('aluno')
    expect(effectiveRole(admin, 'professora')).toBe('professora')
    expect(effectiveRole(admin, 'admin')).toBe('admin')
  })
  it('professora e aluno ignoram o valor salvo', () => {
    expect(effectiveRole({ role: 'professora', active: true }, 'admin')).toBe(
      'professora',
    )
    expect(effectiveRole({ role: 'aluno', active: true }, 'admin')).toBe('aluno')
    expect(effectiveRole({ role: 'aluno', active: true }, 'professora')).toBe('aluno')
  })
  it('admin inativo mantém o papel real; sem perfil é undefined', () => {
    expect(effectiveRole({ role: 'admin', active: false }, 'aluno')).toBe('admin')
    expect(effectiveRole(null, 'aluno')).toBeUndefined()
  })
})

describe('viewAsLabel', () => {
  it('traduz', () => {
    expect(viewAsLabel('aluno')).toBe('Aluno')
    expect(viewAsLabel('professora')).toBe('Professora')
  })
})

describe('readStored / writeStored', () => {
  const throwing = {
    getItem: vi.fn(() => {
      throw new Error('bloqueado')
    }),
    setItem: vi.fn(() => {
      throw new Error('cheio')
    }),
    removeItem: vi.fn(() => {
      throw new Error('bloqueado')
    }),
  }
  it('não propaga erros do storage', () => {
    expect(readStored('k', throwing)).toBeNull()
    expect(() => writeStored('k', 'v', throwing)).not.toThrow()
    expect(() => writeStored('k', null, throwing)).not.toThrow()
  })
  it('sem storage', () => {
    expect(readStored('k', null)).toBeNull()
    expect(() => writeStored('k', 'v', null)).not.toThrow()
  })
  it('lê, grava e remove', () => {
    const m = new Map<string, string>()
    const s = {
      getItem: (k: string) => m.get(k) ?? null,
      setItem: (k: string, v: string) => void m.set(k, v),
      removeItem: (k: string) => void m.delete(k),
    }
    writeStored('k', 'aluno', s)
    expect(readStored('k', s)).toBe('aluno')
    writeStored('k', null, s)
    expect(readStored('k', s)).toBeNull()
  })
})
