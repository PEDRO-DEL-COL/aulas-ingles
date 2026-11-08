import { describe, expect, it } from 'vitest'

import {
  isDuplicateLabel,
  moveItem,
  normalizeLabel,
  validateBenefitLabel,
} from './benefits'

describe('normalizeLabel', () => {
  it('apara e colapsa espaços', () => {
    expect(normalizeLabel('  Material   extra ')).toBe('Material extra')
  })
})

describe('isDuplicateLabel', () => {
  it('ignora maiúsculas e espaços', () => {
    expect(isDuplicateLabel(' material EXTRA', ['Material extra'])).toBe(true)
  })
  it('diferentes não duplicam', () => {
    expect(isDuplicateLabel('Outro', ['Material extra'])).toBe(false)
    expect(isDuplicateLabel('x', [])).toBe(false)
  })
})

describe('moveItem', () => {
  it('sobe e desce', () => {
    expect(moveItem(['a', 'b', 'c'], 1, -1)).toEqual(['b', 'a', 'c'])
    expect(moveItem(['a', 'b', 'c'], 1, 1)).toEqual(['a', 'c', 'b'])
  })
  it('limites não mudam a lista e não mutam o original', () => {
    const list = ['a', 'b']
    expect(moveItem(list, 0, -1)).toEqual(['a', 'b'])
    expect(moveItem(list, 1, 1)).toEqual(['a', 'b'])
    expect(moveItem(list, 5, -1)).toEqual(['a', 'b'])
    expect(moveItem(list, 0, 1)).not.toBe(list)
    expect(list).toEqual(['a', 'b'])
  })
})

describe('validateBenefitLabel', () => {
  it('valida vazio, tamanho e duplicidade', () => {
    expect(validateBenefitLabel('  ', []).error).toBeTruthy()
    expect(validateBenefitLabel('a'.repeat(121), []).error).toBeTruthy()
    expect(validateBenefitLabel('Oi', ['oi']).error).toBeTruthy()
    expect(validateBenefitLabel(' Oi ', []).value).toBe('Oi')
  })
})
