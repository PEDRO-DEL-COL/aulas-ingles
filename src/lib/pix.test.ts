import { describe, expect, it } from 'vitest'
import {
  buildPixPayload,
  buildTxid,
  crc16ccitt,
  isValidTxid,
  normalizePixKey,
  PIX_TXID_MAX,
} from './pix'

function parseTlv(s: string): Map<string, string> {
  const out = new Map<string, string>()
  let i = 0
  while (i < s.length) {
    const id = s.slice(i, i + 2)
    const len = Number(s.slice(i + 2, i + 4))
    out.set(id, s.slice(i + 4, i + 4 + len))
    i += 4 + len
  }
  return out
}

const UUID = '123e4567-e12b-12d1-a456-426655440000'

describe('crc16ccitt', () => {
  it('bate com o vetor clássico', () => {
    expect(crc16ccitt('123456789')).toBe('29B1')
  })
})

describe('buildPixPayload', () => {
  it('reproduz o exemplo oficial do manual do BC', () => {
    const expected =
      '00020126580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-4266554400005204000053039865802BR5913Fulano de Tal6008BRASILIA62070503***63041D3D'
    expect(crc16ccitt(expected.slice(0, -4))).toBe('1D3D')
    expect(
      buildPixPayload({
        key: UUID,
        receiverName: 'Fulano de Tal',
        receiverCity: 'BRASILIA',
      }),
    ).toBe(expected)
  })

  it('monta valor, txid e descrição com CRC correto', () => {
    const p = buildPixPayload({
      key: 'a@b.com',
      receiverName: 'Maria',
      receiverCity: 'Recife',
      amount: 150.5,
      txid: 'ABC123',
      description: 'Aula',
    })
    expect(p).toContain('5406150.50')
    const f = parseTlv(p.slice(0, -4))
    expect(f.get('00')).toBe('01')
    expect(f.has('01')).toBe(false)
    expect(parseTlv(f.get('26') ?? '')).toEqual(
      new Map([
        ['00', 'br.gov.bcb.pix'],
        ['01', 'a@b.com'],
        ['02', 'Aula'],
      ]),
    )
    expect(f.get('52')).toBe('0000')
    expect(f.get('53')).toBe('986')
    expect(f.get('54')).toBe('150.50')
    expect(f.get('58')).toBe('BR')
    expect(f.get('59')).toBe('Maria')
    expect(f.get('60')).toBe('Recife')
    expect(parseTlv(f.get('62') ?? '').get('05')).toBe('ABC123')
    expect(p.slice(-8, -4)).toBe('6304')
    expect(p.slice(-4)).toBe(crc16ccitt(p.slice(0, -4)))
  })

  it('remove acentos e trunca nome e cidade', () => {
    const p = buildPixPayload({
      key: 'x@y.com',
      receiverName: 'José da Silva Sauro Pereira Gomes',
      receiverCity: 'São Paulo do Sul Grande',
    })
    const f = parseTlv(p.slice(0, -4))
    expect(f.get('59')).toBe('Jose da Silva Sauro Perei')
    expect(f.get('60')).toBe('Sao Paulo do Su')
    expect(
      buildPixPayload({ key: 'x', receiverName: 'A', receiverCity: 'São Paulo' }),
    ).toContain('6009Sao Paulo')
  })

  it('omite valor 0 e lança erros para entradas inválidas', () => {
    const base = { key: 'x@y.com', receiverName: 'A', receiverCity: 'B' }
    expect(buildPixPayload({ ...base, amount: 0 })).not.toContain('54')
    expect(() => buildPixPayload({ ...base, key: ' ' })).toThrow('chave')
    expect(() => buildPixPayload({ ...base, amount: -1 })).toThrow('Valor')
    expect(() => buildPixPayload({ ...base, amount: Number.NaN })).toThrow('Valor')
    expect(() => buildPixPayload({ ...base, amount: 1.234 })).toThrow('casas')
    expect(() => buildPixPayload({ ...base, txid: 'a-b' })).toThrow('txid')
    expect(() => buildPixPayload({ ...base, txid: 'a'.repeat(26) })).toThrow('txid')
    expect(() => buildPixPayload({ ...base, description: 'd'.repeat(80) })).toThrow('99')
    expect(() => buildPixPayload({ ...base, receiverName: '  ' })).toThrow('nome')
  })
})

describe('normalizePixKey', () => {
  it('normaliza cada tipo', () => {
    expect(normalizePixKey('123.456.789-09', 'cpf')).toBe('12345678909')
    expect(normalizePixKey('12.345.678/0001-95', 'cnpj')).toBe('12345678000195')
    expect(normalizePixKey(' Foo@Bar.com ', 'email')).toBe('foo@bar.com')
    expect(normalizePixKey('(11) 99999-9999', 'telefone')).toBe('+5511999999999')
    expect(normalizePixKey('+55 11 99999-9999', 'telefone')).toBe('+5511999999999')
    expect(normalizePixKey(UUID.toUpperCase(), 'aleatoria')).toBe(UUID)
  })

  it('rejeita chaves inválidas', () => {
    expect(() => normalizePixKey('', 'cpf')).toThrow('vazia')
    expect(() => normalizePixKey('123', 'cpf')).toThrow('CPF')
    expect(() => normalizePixKey('123', 'cnpj')).toThrow('CNPJ')
    expect(() => normalizePixKey('abc', 'email')).toThrow('E-mail')
    expect(() => normalizePixKey('123', 'telefone')).toThrow('Telefone')
    expect(() => normalizePixKey('abc', 'aleatoria')).toThrow('UUID')
  })
})

describe('buildTxid', () => {
  it('usa id sem hífens e referência, com no máximo 25 caracteres', () => {
    const t = buildTxid(UUID, '202611')
    expect(t).toBe('123e4567e12b12d1a45202611')
    expect(t).toHaveLength(25)
    expect(t).toMatch(/^[A-Za-z0-9]+$/)
  })

  it('funciona sem referência e valida entradas', () => {
    expect(buildTxid(UUID)).toBe('123e4567e12b12d1a45642665')
    expect(() => buildTxid('---')).toThrow('Id')
    expect(() => buildTxid(UUID, 'a-b')).toThrow('Referência')
  })
})

describe('isValidTxid', () => {
  it('aceita de 1 a 25 alfanuméricos', () => {
    expect(PIX_TXID_MAX).toBe(25)
    expect(isValidTxid('A')).toBe(true)
    expect(isValidTxid('a'.repeat(25))).toBe(true)
  })

  it('rejeita vazio, mais de 25 (o banco antigo aceitava 35) e símbolos', () => {
    expect(isValidTxid('')).toBe(false)
    expect(isValidTxid('a'.repeat(26))).toBe(false)
    expect(isValidTxid('a'.repeat(35))).toBe(false)
    expect(isValidTxid('abc-123')).toBe(false)
    expect(isValidTxid('ação')).toBe(false)
  })

  it('buildTxid sempre produz um txid válido', () => {
    expect(isValidTxid(buildTxid('6f1c0d2e-4b5a-4e3f-9a8b-1c2d3e4f5a6b', '202611'))).toBe(
      true,
    )
  })
})
