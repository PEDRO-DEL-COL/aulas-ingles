import { describe, expect, it } from 'vitest'

import {
  generationMessage,
  generationRange,
  generationReportMessage,
  parseGenerationReport,
  scheduleFitSummary,
} from './generation'

describe('generationRange', () => {
  it('semana exibida: do início da semana até 6 dias depois', () => {
    expect(generationRange('semana', '2026-11-08', '2026-11-10')).toEqual({
      from: '2026-11-08',
      to: '2026-11-14',
    })
  })

  it('próximas 4 semanas a partir de hoje (28 dias, inclusivo)', () => {
    expect(generationRange('4', '2026-11-08', '2026-11-10')).toEqual({
      from: '2026-11-10',
      to: '2026-12-07',
    })
  })

  it('próximas 8 semanas atravessando o ano', () => {
    expect(generationRange('8', '2026-12-06', '2026-12-10')).toEqual({
      from: '2026-12-10',
      to: '2027-02-03',
    })
  })
})

describe('generationMessage', () => {
  it('fala do intervalo escolhido', () => {
    expect(generationMessage('semana', 0)).toContain('para esta semana')
    expect(generationMessage('4', 1)).toBe('1 aula criada nas próximas 4 semanas.')
    expect(generationMessage('8', 12)).toBe('12 aulas criadas nas próximas 8 semanas.')
  })
})

describe('parseGenerationReport', () => {
  it('lê criadas e puladas', () => {
    const r = parseGenerationReport({
      created: 3,
      skipped_total: 5,
      skipped: [
        {
          student_id: 'a',
          student_name: 'Ana',
          starts_at: '2026-11-10T15:00:00+00:00',
          duration_minutes: 60,
          reason: 'bloqueado',
        },
        { starts_at: '2026-11-11T15:00:00Z', reason: 'outro' },
        { nada: true },
      ],
    })
    expect(r.created).toBe(3)
    expect(r.skippedTotal).toBe(5)
    expect(r.skipped).toHaveLength(2)
    expect(r.skipped[0]).toMatchObject({ studentName: 'Ana', reason: 'bloqueado' })
    expect(r.skipped[1]).toMatchObject({
      studentName: 'Aluno',
      reason: 'fora_disponibilidade',
    })
  })
  it('tolera lixo', () => {
    expect(parseGenerationReport(null)).toEqual({
      created: 0,
      skippedTotal: 0,
      skipped: [],
    })
    expect(parseGenerationReport('x').created).toBe(0)
  })
})

describe('generationReportMessage / scheduleFitSummary', () => {
  it('menciona as puladas', () => {
    const base = { created: 2, skippedTotal: 0, skipped: [] }
    expect(generationReportMessage('4', base)).toBe(generationMessage('4', 2))
    expect(generationReportMessage('4', { ...base, skippedTotal: 1 })).toContain(
      '1 ocorrência foi pulada',
    )
    expect(generationReportMessage('4', { ...base, skippedTotal: 3 })).toContain(
      '3 ocorrências foram puladas',
    )
  })
  it('aviso do horário fixo', () => {
    expect(scheduleFitSummary(3, 8)).toBe(
      'Este horário não cabe na sua disponibilidade em 3 das próximas 8 semanas; essas aulas não serão geradas.',
    )
  })
})
