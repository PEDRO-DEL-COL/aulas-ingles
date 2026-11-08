import { describe, expect, it } from 'vitest'

import { decideAlunoMode, filterStudents, materialsOrFilter } from './preview'

const A = '11111111-1111-4111-8111-111111111111'
const L1 = '22222222-2222-4222-8222-222222222222'

describe('decideAlunoMode', () => {
  it('aluno de verdade', () => {
    expect(
      decideAlunoMode({ canViewAs: false, role: 'aluno', previewStudentId: A }),
    ).toBe('aluno')
  })
  it('admin vendo como professora não é pré-visualização de aluno', () => {
    expect(
      decideAlunoMode({ canViewAs: true, role: 'professora', previewStudentId: A }),
    ).toBe('aluno')
  })
  it('admin como aluno sem escolha', () => {
    expect(
      decideAlunoMode({ canViewAs: true, role: 'aluno', previewStudentId: null }),
    ).toBe('preview-sem-aluno')
  })
  it('admin como aluno com escolha', () => {
    expect(decideAlunoMode({ canViewAs: true, role: 'aluno', previewStudentId: A })).toBe(
      'preview',
    )
  })
})

describe('materialsOrFilter', () => {
  it('inclui aluno, públicos e aulas', () => {
    expect(materialsOrFilter(A, [L1])).toBe(
      `student_id.eq.${A},is_public_to_students.eq.true,lesson_id.in.(${L1})`,
    )
  })
  it('sem aulas omite lesson_id', () => {
    expect(materialsOrFilter(A, [])).toBe(
      `student_id.eq.${A},is_public_to_students.eq.true`,
    )
  })
  it('descarta ids inválidos e rejeita aluno inválido', () => {
    expect(materialsOrFilter(A, ['x),a.eq.1'])).not.toContain('lesson_id')
    expect(() => materialsOrFilter('x', [])).toThrow()
  })
})

describe('filterStudents', () => {
  const list = [
    { full_name: 'José Ávila', email: 'jose@x.com' },
    { full_name: 'Maria', email: 'maria@y.com' },
  ]
  it('ignora acento e caixa', () => {
    expect(filterStudents(list, 'jose')).toHaveLength(1)
    expect(filterStudents(list, 'Y.COM')).toHaveLength(1)
  })
  it('busca vazia devolve todos', () => {
    expect(filterStudents(list, '  ')).toHaveLength(2)
  })
})
