import { describe, expect, it } from 'vitest'
import { rescheduleNote, rescheduleNoteForStudent } from './reschedule'

const TZ = 'America/Sao_Paulo'
const base = { starts_at: '2026-11-10T17:00:00Z' }

describe('rescheduleNote', () => {
  it('retorna null sem horário original', () => {
    expect(rescheduleNote({ ...base, original_starts_at: null }, TZ)).toBeNull()
  })
  it('mostra o horário original no fuso', () => {
    const note = rescheduleNote(
      { ...base, original_starts_at: '2026-11-07T17:30:00Z' },
      TZ,
    )
    expect(note).toBe('Remarcada — horário original: sábado, 7 de novembro, às 14:30')
  })
  it('retorna null com data inválida', () => {
    expect(rescheduleNote({ ...base, original_starts_at: 'x' }, TZ)).toBeNull()
  })
})

describe('rescheduleNoteForStudent', () => {
  it('retorna null sem horário original', () => {
    expect(rescheduleNoteForStudent({ ...base, original_starts_at: null }, TZ)).toBeNull()
  })
  it('mostra data e hora curtas', () => {
    expect(
      rescheduleNoteForStudent(
        { ...base, original_starts_at: '2026-11-07T17:30:00Z' },
        TZ,
      ),
    ).toBe('Remarcada (era 07/11/2026 às 14:30)')
  })
})
