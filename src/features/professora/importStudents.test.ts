import { describe, expect, it } from 'vitest'

import { buildImportPreview, TEMPLATE_HEADERS, TEMPLATE_ROWS } from './importStudents'

const plans = [{ id: 'p1', name: 'Mensal Básico' }]
const H = ['Nome', 'E-mail', 'Telefone', 'Plano', 'Menor', 'Situação']

describe('buildImportPreview', () => {
  it('aceita o modelo', () => {
    const p = buildImportPreview([TEMPLATE_HEADERS, ...TEMPLATE_ROWS], [], plans)
    expect(p.fatal).toBeNull()
    expect(p.counts).toEqual({ importar: 1, ja_existe: 0, erro: 0 })
    expect(p.rows[0]?.student?.email).toBe('maria.exemplo@gmail.com')
  })

  it('falha sem colunas obrigatórias', () => {
    expect(buildImportPreview([['Telefone'], ['1']], [], plans).fatal).toMatch(/Nome/)
    expect(buildImportPreview([], [], plans).fatal).toBeTruthy()
  })

  it('valida linha a linha', () => {
    const p = buildImportPreview(
      [
        ['ALUNO', 'e-mail', 'Celular', 'plano', 'menor de idade', 'status'],
        ['Ana', 'ANA@x.com', '123', 'mensal basico', 'sim', 'pausado'],
        ['', 'b@x.com', '', '', '', ''],
        ['Caio', 'ana@x.com', '', 'Outro', '', ''],
        ['Dani', 'velho@x.com', '', '', '', ''],
        ['Edu', 'sem-arroba', '', '', 'talvez', 'xx'],
      ],
      ['Velho@x.com'],
      plans,
    )
    const [a, b, c, d, e] = p.rows
    expect(a?.status).toBe('importar')
    expect(a?.student).toMatchObject({
      email: 'ana@x.com',
      plan_id: 'p1',
      is_minor: true,
      status: 'pausado',
      phone: null,
    })
    expect(a?.warnings.join()).toMatch(/Telefone/)
    expect(b?.status).toBe('erro')
    expect(c?.status).toBe('erro')
    expect(c?.errors.join()).toMatch(/repetido/)
    expect(d?.status).toBe('ja_existe')
    expect(e?.errors.length).toBe(3)
    expect(p.counts).toEqual({ importar: 1, ja_existe: 1, erro: 3 })
  })

  it('avisa plano inexistente e usa padrões', () => {
    const p = buildImportPreview([H, ['Z', 'z@x.com', '', 'Nada', '', '']], [], plans)
    expect(p.rows[0]?.student).toMatchObject({
      plan_id: null,
      status: 'ativo',
      is_minor: false,
    })
    expect(p.rows[0]?.warnings.join()).toMatch(/Plano/)
  })
})
