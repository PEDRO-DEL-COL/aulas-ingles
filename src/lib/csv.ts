/** CSV (RFC 4180) leve: leitura com detecção de separador e escrita pronta para o Excel. */

export type CsvDelimiter = ',' | ';'

/** Escolhe ';' ou ',' contando separadores fora de aspas na primeira linha. */
export function detectDelimiter(text: string): CsvDelimiter {
  let commas = 0
  let semis = 0
  let quoted = false
  for (const ch of stripBom(text)) {
    if (ch === '"') quoted = !quoted
    else if (!quoted) {
      if (ch === '\n' || ch === '\r') break
      if (ch === ',') commas++
      else if (ch === ';') semis++
    }
  }
  return semis > commas ? ';' : ','
}

const BOM = String.fromCharCode(0xfeff)

function stripBom(text: string): string {
  return text.startsWith(BOM) ? text.slice(1) : text
}

/** Lê o texto CSV em linhas de células. Ignora BOM e linhas totalmente vazias. */
export function parseCsv(text: string, delimiter?: CsvDelimiter): string[][] {
  const src = stripBom(text)
  const sep = delimiter ?? detectDelimiter(src)
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  let touched = false

  const endCell = () => {
    row.push(cell)
    cell = ''
  }
  const endRow = () => {
    endCell()
    if (row.some((c) => c.trim() !== '')) rows.push(row)
    row = []
    touched = false
  }

  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"'
          i++
        } else quoted = false
      } else cell += ch
      continue
    }
    if (ch === '"' && cell === '') {
      quoted = true
      touched = true
    } else if (ch === sep) {
      endCell()
      touched = true
    } else if (ch === '\r') {
      if (src[i + 1] === '\n') i++
      endRow()
    } else if (ch === '\n') {
      endRow()
    } else {
      cell += ch
      touched = true
    }
  }
  if (touched || cell !== '' || row.length > 0) endRow()
  return rows
}

function escapeCell(value: string, sep: string): string {
  let v = value
  // Evita que o Excel/Planilhas execute fórmulas vindas de texto digitado.
  if (/^[=+\-@\t\r]/.test(v)) v = `'${v}`
  if (v.includes('"') || v.includes(sep) || /[\r\n]/.test(v)) {
    return `"${v.replace(/"/g, '""')}"`
  }
  return v
}

export type SerializeOptions = { delimiter?: CsvDelimiter; bom?: boolean }

export function serializeCsv(
  rows: readonly (readonly (string | number | null | undefined)[])[],
  { delimiter = ';', bom = true }: SerializeOptions = {},
): string {
  const body = rows
    .map((r) =>
      r
        .map((c) =>
          c == null ? '' : escapeCell(typeof c === 'number' ? String(c) : c, delimiter),
        )
        .join(delimiter),
    )
    .join('\r\n')
  return (bom ? BOM : '') + body + '\r\n'
}

/** Baixa o CSV pelo navegador (Blob). `nome` sem extensão ganha ".csv". */
export function downloadCsv(
  nome: string,
  rows: readonly (readonly (string | number | null | undefined)[])[],
  options?: SerializeOptions,
): void {
  const blob = new Blob([serializeCsv(rows, options)], {
    type: 'text/csv;charset=utf-8',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nome.toLowerCase().endsWith('.csv') ? nome : `${nome}.csv`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
