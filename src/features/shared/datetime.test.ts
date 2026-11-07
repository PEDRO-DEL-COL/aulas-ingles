import { describe, expect, it } from 'vitest'

import {
  dayKey,
  formatDate,
  formatDateOnly,
  formatDateTime,
  formatReferenceMonth,
  formatTime,
  monthStartKey,
  referenceYYYYMM,
  safeTimezone,
} from './datetime'

describe('datetime', () => {
  const iso = '2026-11-07T17:30:00Z'
  it('formata no fuso do perfil', () => {
    expect(formatTime(iso, 'America/Sao_Paulo')).toBe('14:30')
    expect(formatTime(iso, 'Europe/Lisbon')).toBe('17:30')
    expect(formatDate(iso, 'America/Sao_Paulo')).toBe('07/11/2026')
    expect(formatDateTime(iso, 'America/Sao_Paulo')).toBe('07/11/2026 às 14:30')
  })
  it('usa o padrão com fuso nulo ou inválido', () => {
    expect(formatTime(iso, null)).toBe('14:30')
    expect(formatTime(iso, 'Nao/Existe')).toBe('14:30')
    expect(safeTimezone('Nao/Existe')).toBe('America/Sao_Paulo')
  })
  it('vira o dia conforme o fuso', () => {
    const late = '2026-11-08T01:30:00Z'
    expect(dayKey(late, 'America/Sao_Paulo')).toBe('2026-11-07')
    expect(dayKey(late, 'Europe/Lisbon')).toBe('2026-11-08')
  })
  it('retorna vazio para data inválida', () => {
    expect(formatTime('lixo')).toBe('')
  })
  it('mês civil e datas puras', () => {
    expect(monthStartKey(new Date('2026-12-01T01:00:00Z'))).toBe('2026-11-01')
    expect(formatDateOnly('2026-11-10')).toBe('10/11/2026')
    expect(formatReferenceMonth('2026-11-01')).toBe('novembro de 2026')
    expect(referenceYYYYMM('2026-11-01')).toBe('202611')
  })
})
