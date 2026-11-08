import { describe, expect, it } from 'vitest'

import { detectDelimiter, parseCsv, serializeCsv } from './csv'

describe('parseCsv', () => {
  it('lê vírgulas, CRLF e BOM', () => {
    expect(parseCsv('﻿a,b\r\n1,2\r\n')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ])
  })
  it('detecta ponto e vírgula', () => {
    expect(detectDelimiter('nome;email\nA;b')).toBe(';')
    expect(parseCsv('nome;email\nAna;a@b.co')).toEqual([
      ['nome', 'email'],
      ['Ana', 'a@b.co'],
    ])
  })
  it('trata aspas, aspas duplas e quebra de linha em célula', () => {
    expect(parseCsv('a,b\n"x, ""y""","l1\nl2"')).toEqual([
      ['a', 'b'],
      ['x, "y"', 'l1\nl2'],
    ])
  })
  it('ignora linhas vazias e aceita última linha sem quebra', () => {
    expect(parseCsv('a,b\n\n1,2')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ])
  })
  it('mantém células vazias', () => {
    expect(parseCsv('a,,c\n')).toEqual([['a', '', 'c']])
  })
})

describe('serializeCsv', () => {
  it('usa ; e BOM por padrão e escapa', () => {
    expect(serializeCsv([['a;b', 'say "hi"', 'x\ny', null, 3]])).toBe(
      '﻿"a;b";"say ""hi""";"x\ny";;3\r\n',
    )
  })
  it('protege contra fórmulas', () => {
    expect(serializeCsv([['=1+1', '+5', '-2', '@x', 'ok']], { bom: false })).toBe(
      "'=1+1;'+5;'-2;'@x;ok\r\n",
    )
  })
  it('faz ida e volta', () => {
    const rows = [
      ['n', 'o'],
      ['a;b', 'c"d\ne'],
    ]
    expect(parseCsv(serializeCsv(rows))).toEqual(rows)
  })
})
