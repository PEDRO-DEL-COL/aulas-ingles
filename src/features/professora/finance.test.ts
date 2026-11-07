import { describe, expect, it } from 'vitest'

import {
  batchActionLabel,
  buildPaymentReminder,
  defaultBatchMonth,
  summarizeBatch,
  validateBatchForm,
  type BatchRow,
  filterInvoices,
  groupInvoices,
  invoiceDefaultsFromPlan,
  invoiceTitle,
  parseBRLToCents,
  validateInvoiceForm,
  type InvoiceFormValues,
} from './finance'

const base: InvoiceFormValues = {
  student_id: 's1',
  payer_id: '',
  plan_id: '',
  billing_model: 'mensalidade',
  amount: '280,00',
  reference_month: '2026-11',
  lessons_count: '',
  description: '',
  due_date: '2026-11-10',
  status: 'em_aberto',
}

describe('parseBRLToCents', () => {
  it('interpreta formatos brasileiros', () => {
    expect(parseBRLToCents('150,00')).toBe(15000)
    expect(parseBRLToCents('1.234,56')).toBe(123456)
    expect(parseBRLToCents('R$ 85')).toBe(8500)
    expect(parseBRLToCents('150.5')).toBe(15050)
    expect(parseBRLToCents('1.234')).toBe(123400)
  })
  it('rejeita inválidos', () => {
    for (const v of ['', '0', '0,00', '-5', 'abc', '1,234', '10,5,5'])
      expect(parseBRLToCents(v)).toBeNull()
  })
})

function dataOf(v: InvoiceFormValues) {
  const r = validateInvoiceForm(v)
  if ('errors' in r) throw new Error(JSON.stringify(r.errors))
  return r.data
}

describe('validateInvoiceForm', () => {
  it('mensalidade válida', () => {
    expect(dataOf(base)).toMatchObject({
      amount_cents: 28000,
      reference_month: '2026-11-01',
      lessons_count: null,
      payer_id: null,
      status: 'em_aberto',
    })
  })
  it('exige mês na mensalidade, vencimento e aluno', () => {
    const r = validateInvoiceForm({
      ...base,
      reference_month: '',
      due_date: '',
      student_id: '',
    })
    expect('errors' in r && Object.keys(r.errors).sort()).toEqual([
      'due_date',
      'reference_month',
      'student_id',
    ])
  })
  it('data inexistente é inválida', () => {
    expect(validateInvoiceForm({ ...base, due_date: '2026-02-30' })).toHaveProperty(
      'errors',
    )
  })
  it('pacote exige aulas', () => {
    expect(
      validateInvoiceForm({ ...base, billing_model: 'pacote', reference_month: '' }),
    ).toHaveProperty('errors.lessons_count')
    expect(
      dataOf({
        ...base,
        billing_model: 'pacote',
        reference_month: '',
        lessons_count: '8',
      }),
    ).toMatchObject({ lessons_count: 8, reference_month: null })
  })
  it('avulsa: descrição e aulas opcionais', () => {
    expect(
      dataOf({
        ...base,
        billing_model: 'avulsa',
        reference_month: '',
        description: '  Aula extra ',
      }),
    ).toMatchObject({
      description: 'Aula extra',
      lessons_count: null,
      reference_month: null,
    })
  })
})

describe('invoiceDefaultsFromPlan', () => {
  it('pacote', () => {
    expect(
      invoiceDefaultsFromPlan(
        {
          id: 'p',
          name: 'Pacote',
          billing_model: 'pacote',
          lessons_per_month: null,
          lessons_in_package: 10,
          price_cents: 65000,
        },
        new Date('2026-11-07T15:00:00Z'),
      ),
    ).toMatchObject({ billing_model: 'pacote', amount: '650,00', lessons_count: '10' })
  })
  it('mensalidade traz o mês atual', () => {
    expect(
      invoiceDefaultsFromPlan(
        {
          id: 'p',
          name: 'Mensal',
          billing_model: 'mensalidade',
          lessons_per_month: 4,
          lessons_in_package: null,
          price_cents: 28000,
        },
        new Date('2026-11-07T15:00:00Z'),
      ),
    ).toMatchObject({ reference_month: '2026-11', lessons_count: '' })
  })
})

describe('groupInvoices', () => {
  it('separa grupos e avisos', () => {
    const mk = (
      id: string,
      s: 'em_aberto' | 'atrasado' | 'pago' | 'cancelado',
      n: string | null = null,
    ) => ({
      id,
      effective_status: s,
      student_notified_paid_at: n,
    })
    const g = groupInvoices([
      mk('a', 'atrasado'),
      mk('b', 'em_aberto'),
      mk('c', 'atrasado', '2026-11-06T10:00:00Z'),
      mk('d', 'pago'),
      mk('e', 'cancelado'),
    ])
    expect(g.atrasadas.map((i) => i.id)).toEqual(['a'])
    expect(g.abertas.map((i) => i.id)).toEqual(['b'])
    expect(g.avisosJaPaguei.map((i) => i.id)).toEqual(['c'])
    expect(g.pagas.map((i) => i.id)).toEqual(['d'])
    expect(g.canceladas.map((i) => i.id)).toEqual(['e'])
  })
})

describe('filterInvoices', () => {
  const list = [
    {
      effective_status: 'atrasado' as const,
      due_date: '2026-10-10',
      reference_month: '2026-10-01',
      student: { full_name: 'João Álvares' },
    },
    {
      effective_status: 'pago' as const,
      due_date: '2026-11-10',
      reference_month: null,
      student: { full_name: 'Maria' },
    },
  ]
  it('busca sem acento', () => {
    expect(filterInvoices(list, { search: 'joao' })).toHaveLength(1)
  })
  it('status e mês', () => {
    expect(filterInvoices(list, { status: 'abertas' })).toHaveLength(1)
    expect(filterInvoices(list, { month: '2026-11' })).toHaveLength(1)
    expect(filterInvoices(list, { status: 'pagas', month: '2026-10' })).toHaveLength(0)
  })
})

describe('textos', () => {
  it('título', () => {
    expect(
      invoiceTitle({
        billing_model: 'mensalidade',
        reference_month: '2026-11-01',
        lessons_count: null,
      }),
    ).toBe('Mensalidade de nov/2026')
    expect(
      invoiceTitle({ billing_model: 'pacote', reference_month: null, lessons_count: 8 }),
    ).toBe('Pacote de 8 aulas')
    expect(
      invoiceTitle({
        billing_model: 'avulsa',
        reference_month: null,
        lessons_count: null,
      }),
    ).toBe('Avulsa')
  })
  it('lembrete', () => {
    const m = buildPaymentReminder({
      studentName: 'Ana Souza',
      amountCents: 28000,
      dueDate: '2026-11-10',
      referenceMonth: '2026-11-01',
      businessName: 'Inglês com Bia',
    })
    expect(m).toContain('Ana')
    expect(m).toContain('10/11/2026')
    expect(m).toContain('área do aluno')
    expect(m).toContain('novembro de 2026')
  })
})

describe('lote mensal', () => {
  const row = (action: BatchRow['action'], cents: number | null): BatchRow => ({
    student_id: 's',
    student_name: 'A',
    plan_id: null,
    plan_name: null,
    amount_cents: cents,
    reference_month: '2026-12-01',
    due_date: '2026-12-10',
    action,
    invoice_id: null,
  })

  it('rotula as ações', () => {
    expect(batchActionLabel('criar')).toBe('Será criada')
    expect(batchActionLabel('nao_mensal')).toBe('Pacote/avulsa: não gera em lote')
  })

  it('resume contagens e total', () => {
    const s = summarizeBatch([
      row('criar', 10000),
      row('criar', 5000),
      row('ja_existe', 9000),
      row('sem_plano', null),
    ])
    expect(s.counts.criar).toBe(2)
    expect(s.counts.ja_existe).toBe(1)
    expect(s.toCreate).toBe(2)
    expect(s.totalCents).toBe(15000)
    expect(summarizeBatch([row('criada', 7000)]).totalCents).toBe(7000)
  })

  it('valida o formulário', () => {
    expect(validateBatchForm({ month: '2026-12', dueDay: 10 })).toEqual({
      data: { month: '2026-12', dueDay: 10 },
    })
    expect(validateBatchForm({ month: '2026-12', dueDay: '5' })).toEqual({
      data: { month: '2026-12', dueDay: 5 },
    })
    expect('errors' in validateBatchForm({ month: '', dueDay: 10 })).toBe(true)
    expect('errors' in validateBatchForm({ month: '2026-12', dueDay: 0 })).toBe(true)
    expect('errors' in validateBatchForm({ month: '2026-12', dueDay: 32 })).toBe(true)
    expect('errors' in validateBatchForm({ month: '2026-12', dueDay: '1.5' })).toBe(true)
  })

  it('sugere o mês seguinte em Brasília', () => {
    expect(defaultBatchMonth(new Date('2026-11-07T12:00:00Z'))).toBe('2026-12')
    expect(defaultBatchMonth(new Date('2026-12-15T12:00:00Z'))).toBe('2027-01')
    // 01/12 00:30 UTC ainda é 30/11 em Brasília
    expect(defaultBatchMonth(new Date('2026-12-01T00:30:00Z'))).toBe('2026-12')
  })
})
