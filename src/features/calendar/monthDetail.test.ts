import { describe, expect, it } from 'vitest'

import {
  firstName,
  groupLessonsByDay,
  lessonAriaLabel,
  mobileListDays,
  MONTH_DETAIL_STORAGE_KEY,
  parseMonthDetailMode,
  readMonthDetailMode,
  scrollTargetDay,
  sortLessonsByStart,
  truncateForCell,
  writeMonthDetailMode,
} from './monthDetail'

describe('preferência', () => {
  it('valida o valor salvo', () => {
    expect(parseMonthDetailMode('detalhada')).toBe('detalhada')
    expect(parseMonthDetailMode('minimalista')).toBe('minimalista')
    expect(parseMonthDetailMode('xyz')).toBe('minimalista')
    expect(parseMonthDetailMode(null)).toBe('minimalista')
    expect(parseMonthDetailMode(undefined)).toBe('minimalista')
  })

  it('lê e grava com a chave versionada', () => {
    const data = new Map<string, string>()
    const storage = {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
    }
    expect(readMonthDetailMode(storage)).toBe('minimalista')
    writeMonthDetailMode('detalhada', storage)
    expect(data.get(MONTH_DETAIL_STORAGE_KEY)).toBe('detalhada')
    expect(readMonthDetailMode(storage)).toBe('detalhada')
  })

  it('não quebra quando o armazenamento falha', () => {
    const broken = {
      getItem: () => {
        throw new Error('bloqueado')
      },
      setItem: () => {
        throw new Error('bloqueado')
      },
    }
    expect(readMonthDetailMode(broken)).toBe('minimalista')
    expect(() => writeMonthDetailMode('detalhada', broken)).not.toThrow()
    expect(readMonthDetailMode(null)).toBe('minimalista')
  })
})

describe('aulas por dia', () => {
  const l = (id: string, starts_at: string) => ({ id, starts_at })
  const lessons = [
    l('c', '2026-11-10T15:00:00Z'),
    l('a', '2026-11-09T12:00:00Z'),
    l('b', '2026-11-10T11:00:00Z'),
  ]

  it('ordena por início sem alterar a entrada', () => {
    expect(sortLessonsByStart(lessons).map((x) => x.id)).toEqual(['a', 'b', 'c'])
    expect(lessons[0]?.id).toBe('c')
  })

  it('agrupa por dia com cada dia em ordem', () => {
    const g = groupLessonsByDay(lessons, (x) => x.starts_at.slice(0, 10))
    expect(g.get('2026-11-09')?.map((x) => x.id)).toEqual(['a'])
    expect(g.get('2026-11-10')?.map((x) => x.id)).toEqual(['b', 'c'])
  })

  it('corta em X e conta o restante', () => {
    expect(truncateForCell([1, 2], 3)).toEqual({ visible: [1, 2], hidden: 0 })
    expect(truncateForCell([1, 2, 3], 3)).toEqual({ visible: [1, 2, 3], hidden: 0 })
    expect(truncateForCell([1, 2, 3, 4, 5], 3)).toEqual({ visible: [1, 2, 3], hidden: 2 })
    expect(truncateForCell([1, 2, 3, 4]).hidden).toBe(1)
    expect(truncateForCell([], 3)).toEqual({ visible: [], hidden: 0 })
  })
})

describe('lista do celular', () => {
  const keys = ['2026-10-31', '2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04']
  const status = {
    '2026-10-31': 'ferias',
    '2026-11-01': 'feriado',
    '2026-11-02': 'disponivel',
    '2026-11-03': 'fechado',
    '2026-11-04': 'sem_horario',
  } as const
  const counts: Record<string, number> = { '2026-11-04': 2, '2026-10-31': 1 }

  it('inclui dias do mês com aulas ou estado especial', () => {
    const out = mobileListDays(
      keys,
      '2026-11',
      (k) => status[k as keyof typeof status],
      (k) => counts[k] ?? 0,
    )
    expect(out).toEqual(['2026-11-01', '2026-11-03', '2026-11-04'])
  })

  it('escolhe hoje ou o próximo dia listado', () => {
    const listed = ['2026-11-01', '2026-11-08', '2026-11-20']
    expect(scrollTargetDay(listed, '2026-11-08')).toBe('2026-11-08')
    expect(scrollTargetDay(listed, '2026-11-09')).toBe('2026-11-20')
    expect(scrollTargetDay(listed, '2026-11-21')).toBeNull()
  })
})

describe('textos', () => {
  it('primeiro nome e aria-label', () => {
    expect(firstName('Ana Souza')).toBe('Ana')
    expect(firstName('  ')).toBe('Aluno')
    expect(firstName(null)).toBe('Aluno')
    expect(lessonAriaLabel('09:00', 'Ana Souza', 'Agendada')).toBe(
      '09:00, Ana Souza, agendada',
    )
  })
})
