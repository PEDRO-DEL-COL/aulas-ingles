/**
 * Geração do código Pix "copia e cola" (BR Code estático, EMV QRCPS-MPM),
 * conforme o Manual de Padrões para Iniciação do Pix do Banco Central.
 * Sem dependências externas.
 */

/** Tipos de chave Pix aceitos por {@link normalizePixKey}. */
export type PixKeyType = 'cpf' | 'cnpj' | 'email' | 'telefone' | 'aleatoria'

/** Opções para {@link buildPixPayload}. */
export interface PixPayloadOptions {
  /** Chave Pix já normalizada (veja {@link normalizePixKey}). */
  key: string
  /** Nome do recebedor (máx. 25 caracteres; a caixa é preservada). */
  receiverName: string
  /** Cidade do recebedor (máx. 15 caracteres; a caixa é preservada). */
  receiverCity: string
  /** Valor em reais (ex.: 150.5). Omitido do código se ausente ou 0. */
  amount?: number
  /** Identificador da transação (apenas [A-Za-z0-9], máx. 25). Padrão "***". */
  txid?: string
  /** Descrição opcional exibida ao pagador (subcampo 02 do campo 26). */
  description?: string
}

/**
 * Calcula o CRC16/CCITT-FALSE (polinômio 0x1021, inicial 0xFFFF, sem
 * reflexão, xorout 0) sobre os bytes UTF-8 do texto.
 *
 * @param payload Texto a ser processado.
 * @returns 4 dígitos hexadecimais em maiúsculas.
 */
export function crc16ccitt(payload: string): string {
  let crc = 0xffff
  for (const byte of new TextEncoder().encode(payload)) {
    crc ^= byte << 8
    for (let i = 0; i < 8; i++) {
      crc = (crc & 0x8000) !== 0 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0')
}

/**
 * Remove acentos e qualquer caractere fora do ASCII imprimível, e apara
 * espaços. A caixa (maiúsculas/minúsculas) NÃO é alterada.
 */
function sanitizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^\x20-\x7E]/g, '')
    .trim()
}

/** Monta um campo TLV: ID(2) + tamanho(2 dígitos) + valor. */
function field(id: string, value: string): string {
  if (value.length > 99) {
    throw new Error(`O campo ${id} do Pix excede 99 caracteres (${value.length}).`)
  }
  return `${id}${value.length.toString().padStart(2, '0')}${value}`
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Normaliza e valida uma chave Pix de acordo com o tipo informado.
 * - cpf: 11 dígitos; cnpj: 14 dígitos (pontuação removida).
 * - email: minúsculas, sem espaços nas pontas, máx. 77 caracteres.
 * - telefone: "+55" + DDD + número (aceita com ou sem "+55" e com pontuação).
 * - aleatoria: UUID em minúsculas.
 *
 * @throws Error em pt-BR se a chave for inválida para o tipo.
 */
export function normalizePixKey(key: string, type: PixKeyType): string {
  const raw = key.trim()
  if (raw === '') throw new Error('A chave Pix não pode ser vazia.')
  switch (type) {
    case 'cpf': {
      const d = raw.replace(/\D/g, '')
      if (d.length !== 11) throw new Error('CPF inválido: deve ter 11 dígitos.')
      return d
    }
    case 'cnpj': {
      const d = raw.replace(/\D/g, '')
      if (d.length !== 14) throw new Error('CNPJ inválido: deve ter 14 dígitos.')
      return d
    }
    case 'email': {
      const e = raw.toLowerCase()
      if (!EMAIL_RE.test(e) || e.length > 77)
        throw new Error('E-mail da chave Pix inválido.')
      return e
    }
    case 'telefone': {
      let d = raw.replace(/\D/g, '')
      if (d.length === 12 || d.length === 13) {
        if (!d.startsWith('55')) throw new Error('Telefone inválido: use DDD + número.')
        d = d.slice(2)
      }
      if (d.length !== 10 && d.length !== 11) {
        throw new Error('Telefone inválido: use DDD + número (10 ou 11 dígitos).')
      }
      return `+55${d}`
    }
    case 'aleatoria': {
      const u = raw.toLowerCase()
      if (!UUID_RE.test(u)) throw new Error('Chave aleatória inválida: esperado um UUID.')
      return u
    }
  }
}

/**
 * Gera o código Pix "copia e cola" estático.
 *
 * Escolhas: campo 01 (Point of Initiation Method) omitido; nome e cidade têm
 * acentos removidos e são truncados (25 e 15), mas a caixa é preservada.
 *
 * @throws Error em pt-BR para chave vazia, valor inválido, txid inválido,
 * nome/cidade vazios ou campos acima de 99 caracteres.
 */
export function buildPixPayload(opts: PixPayloadOptions): string {
  const key = opts.key.trim()
  if (key === '') throw new Error('A chave Pix não pode ser vazia.')

  const name = sanitizeText(opts.receiverName).slice(0, 25).trim()
  if (name === '') throw new Error('O nome do recebedor não pode ser vazio.')
  const city = sanitizeText(opts.receiverCity).slice(0, 15).trim()
  if (city === '') throw new Error('A cidade do recebedor não pode ser vazia.')

  let accountInfo = field('00', 'br.gov.bcb.pix') + field('01', key)
  if (opts.description !== undefined) {
    const desc = sanitizeText(opts.description)
    if (desc !== '') accountInfo += field('02', desc)
  }
  if (accountInfo.length > 99) {
    throw new Error(
      'Chave e descrição do Pix são grandes demais (campo 26 excede 99 caracteres).',
    )
  }

  let amountField = ''
  const amount = opts.amount
  if (amount !== undefined && amount !== 0) {
    if (!Number.isFinite(amount) || amount < 0) {
      throw new Error('Valor do Pix inválido: deve ser um número positivo.')
    }
    const cents = Math.round(amount * 100)
    if (Math.abs(amount * 100 - cents) > 1e-6) {
      throw new Error('Valor do Pix inválido: use no máximo 2 casas decimais.')
    }
    const formatted = (cents / 100).toFixed(2)
    if (cents <= 0 || formatted.length > 13)
      throw new Error('Valor do Pix fora do limite permitido.')
    amountField = field('54', formatted)
  }

  const txid = opts.txid ?? '***'
  if (txid !== '***' && !isValidTxid(txid)) {
    throw new Error('txid inválido: use de 1 a 25 caracteres alfanuméricos.')
  }

  const body =
    field('00', '01') +
    field('26', accountInfo) +
    field('52', '0000') +
    field('53', '986') +
    amountField +
    field('58', 'BR') +
    field('59', name) +
    field('60', city) +
    field('62', field('05', txid)) +
    '6304'
  return body + crc16ccitt(body)
}

/** Limite do txid no BR Code estático (campo 62-05). O banco usa o mesmo limite. */
export const PIX_TXID_MAX = 25

/** txid aceito pelo BR Code: 1 a 25 letras ou números (sem acento, espaço ou símbolo). */
export function isValidTxid(value: string): boolean {
  return /^[A-Za-z0-9]+$/.test(value) && value.length <= PIX_TXID_MAX
}

/**
 * Gera um txid seguro (alfanumérico, máx. 25) a partir do id do aluno.
 * Remove hífens/símbolos do id e, se houver referência (ex.: "202611"),
 * a anexa ao final; o id é truncado para caber em 25 caracteres.
 *
 * @throws Error em pt-BR se o id ou a referência forem inválidos.
 */
export function buildTxid(studentId: string, reference?: string): string {
  const id = studentId.replace(/[^A-Za-z0-9]/g, '')
  if (id === '') throw new Error('Id do aluno inválido para gerar o txid.')
  const ref = reference === undefined ? '' : reference.trim()
  if (ref !== '' && !/^[A-Za-z0-9]{1,10}$/.test(ref)) {
    throw new Error('Referência inválida: use até 10 caracteres alfanuméricos.')
  }
  return id.slice(0, 25 - ref.length) + ref
}
