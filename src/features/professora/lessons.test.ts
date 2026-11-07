import { describe, expect, it } from 'vitest'

import {
  canCancel,
  canMarkAttendance,
  canScheduleMakeup,
  groupByDay,
  needsMakeupDecision,
  reminderLink,
  reminderMessage,
} from './lessons'

const SP = 'America/Sao_Paulo'

describe('groupByDay', () => {
  it('agrupa por dia local e ordena', () => {
    const items = [
      { id: 'c', starts_at: '2026-11-09T12:00:00Z' },
      { id: 'a', starts_at: '2026-11-08T01:30:00Z' }, // 07/11 22:30 em SP
      { id: 'b', starts_at: '2026-11-08T13:00:00Z' }, // 08/11
    ]
    const groups = groupByDay(items, SP)
    expect(groups.map((g) => g.key)).toEqual(['2026-11-07', '2026-11-08', '2026-11-09'])
    expect(groups[0]?.items[0]?.id).toBe('a')
  })
  it('lista vazia', () => {
    expect(groupByDay([], SP)).toEqual([])
  })
})

describe('mensagem de lembrete', () => {
  it('usa o primeiro nome, hora e link', () => {
    expect(
      reminderMessage({
        name: 'Ana Souza',
        time: '14:30',
        meetLink: 'https://meet.google.com/abc-defg-hij',
      }),
    ).toBe(
      'Oi, Ana! Lembrete da nossa aula de inglês hoje às 14:30. Link: https://meet.google.com/abc-defg-hij',
    )
  })
  it('sem link omite o trecho', () => {
    expect(reminderMessage({ name: 'Ana', time: '09:00', meetLink: null })).toBe(
      'Oi, Ana! Lembrete da nossa aula de inglês hoje às 09:00.',
    )
  })
  it('monta o link wa.me com telefone brasileiro e hora no fuso', () => {
    const url = reminderLink(
      { full_name: 'Ana Souza', phone: '(11) 91234-5678' },
      { starts_at: '2026-11-09T17:30:00Z' },
      null,
      SP,
    )
    expect(url).toContain('https://wa.me/5511912345678?text=')
    expect(decodeURIComponent(url ?? '')).toContain('às 14:30')
  })
  it('null sem telefone', () => {
    expect(
      reminderLink(
        { full_name: 'Ana', phone: null },
        { starts_at: '2026-11-09T17:30:00Z' },
        null,
        SP,
      ),
    ).toBeNull()
  })
})

describe('regras de ação', () => {
  const now = new Date('2026-11-09T12:00:00Z')
  it('cancelar só aula ativa e futura', () => {
    expect(
      canCancel({ status: 'agendada', starts_at: '2026-11-10T12:00:00Z' }, now),
    ).toBe(true)
    expect(
      canCancel({ status: 'agendada', starts_at: '2026-11-09T11:00:00Z' }, now),
    ).toBe(false)
    expect(
      canCancel({ status: 'realizada', starts_at: '2026-11-10T12:00:00Z' }, now),
    ).toBe(false)
  })
  it('presença', () => {
    expect(canMarkAttendance({ status: 'agendada' })).toBe(true)
    expect(canMarkAttendance({ status: 'cancelada_aluno' })).toBe(false)
  })
  it('reposição', () => {
    expect(
      canScheduleMakeup({ status: 'cancelada_professora', makeup_eligible: true }, false),
    ).toBe(true)
    expect(
      canScheduleMakeup({ status: 'cancelada_aluno', makeup_eligible: true }, false),
    ).toBe(true)
    expect(
      canScheduleMakeup({ status: 'cancelada_aluno', makeup_eligible: null }, false),
    ).toBe(false)
    expect(
      canScheduleMakeup({ status: 'cancelada_aluno', makeup_eligible: false }, false),
    ).toBe(false)
    expect(
      canScheduleMakeup({ status: 'cancelada_professora', makeup_eligible: true }, true),
    ).toBe(false)
  })
  it('decisão pendente', () => {
    expect(
      needsMakeupDecision({ status: 'cancelada_aluno', makeup_eligible: null }),
    ).toBe(true)
    expect(
      needsMakeupDecision({ status: 'cancelada_aluno', makeup_eligible: true }),
    ).toBe(false)
    expect(needsMakeupDecision({ status: 'agendada', makeup_eligible: null })).toBe(false)
  })
})
