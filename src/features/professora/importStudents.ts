/** Importação de alunos por planilha (CSV): cabeçalhos, validação linha a linha. Puro. */
import type { TablesInsert } from '@/types/database'

import { isValidEmail, isValidMeetLink, whatsappNumber } from './validation'

export type ImportField =
  | 'nome'
  | 'email'
  | 'telefone'
  | 'nivel'
  | 'objetivo'
  | 'plano'
  | 'meet'
  | 'menor'
  | 'situacao'

/** Minúsculas, sem acento e só letras/números separados por espaço. */
export function normalizeText(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

const HEADER_SYNONYMS: Record<ImportField, string[]> = {
  nome: ['nome', 'aluno', 'nome completo', 'nome do aluno'],
  email: ['email', 'e-mail', 'e-mail google', 'email google', 'conta google'],
  telefone: ['telefone', 'whatsapp', 'celular', 'fone', 'tel'],
  nivel: ['nivel'],
  objetivo: ['objetivo', 'meta'],
  plano: ['plano'],
  meet: ['link do meet', 'meet', 'link meet', 'link da aula'],
  menor: ['menor de idade', 'menor'],
  situacao: ['situacao', 'status'],
}

const HEADER_LOOKUP = new Map<string, ImportField>()
for (const [field, names] of Object.entries(HEADER_SYNONYMS) as [
  ImportField,
  string[],
][]) {
  for (const n of names) HEADER_LOOKUP.set(normalizeText(n), field)
}

export const TEMPLATE_HEADERS = [
  'Nome',
  'E-mail',
  'Telefone',
  'Nível',
  'Objetivo',
  'Plano',
  'Link do Meet',
  'Menor de idade',
  'Situação',
]

export const TEMPLATE_ROWS: string[][] = [
  [
    'Maria Exemplo',
    'maria.exemplo@gmail.com',
    '(11) 91234-5678',
    'Intermediário',
    'Conversação para viagens',
    '',
    'https://meet.google.com/abc-defg-hij',
    'Não',
    'Ativo',
  ],
]

export type ImportStatus = 'importar' | 'ja_existe' | 'erro'

export type ImportRow = {
  /** Número da linha na planilha (cabeçalho = 1). */
  line: number
  status: ImportStatus
  errors: string[]
  warnings: string[]
  /** Presente quando status = 'importar'. */
  student: TablesInsert<'students'> | null
  name: string
  email: string
}

export type ImportPreview = {
  rows: ImportRow[]
  counts: Record<ImportStatus, number>
  /** Erro geral (arquivo vazio, cabeçalhos ausentes). */
  fatal: string | null
}

export type PlanRef = { id: string; name: string }

const MAX = { nome: 200, telefone: 30, nivel: 40, objetivo: 1000, meet: 500 }

function parseBool(v: string): boolean | null {
  const n = normalizeText(v)
  if (n === '') return false
  if (['sim', 's', 'true', '1', 'yes', 'y'].includes(n)) return true
  if (['nao', 'n', 'false', '0', 'no'].includes(n)) return false
  return null
}

function parseStatus(v: string): 'ativo' | 'pausado' | 'saiu' | null {
  const n = normalizeText(v)
  if (n === '' || n === 'ativo' || n === 'ativa') return 'ativo'
  if (n === 'pausado' || n === 'pausada') return 'pausado'
  if (n === 'saiu' || n === 'inativo' || n === 'inativa') return 'saiu'
  return null
}

export function buildImportPreview(
  table: readonly (readonly string[])[],
  existingEmails: Iterable<string>,
  plans: readonly PlanRef[],
): ImportPreview {
  const counts: Record<ImportStatus, number> = { importar: 0, ja_existe: 0, erro: 0 }
  const fail = (fatal: string): ImportPreview => ({ rows: [], counts, fatal })
  if (table.length === 0) return fail('A planilha está vazia.')

  const cols = new Map<ImportField, number>()
  const header = table[0] ?? []
  header.forEach((h, i) => {
    const f = HEADER_LOOKUP.get(normalizeText(h))
    if (f && !cols.has(f)) cols.set(f, i)
  })
  if (!cols.has('nome') || !cols.has('email')) {
    return fail(
      'Não encontrei as colunas "Nome" e "E-mail" na primeira linha. Use o modelo para conferir.',
    )
  }
  if (table.length < 2)
    return fail('A planilha não tem nenhum aluno abaixo do cabeçalho.')

  const existing = new Set([...existingEmails].map((e) => e.trim().toLowerCase()))
  const planByName = new Map(plans.map((p) => [normalizeText(p.name), p.id]))
  const seen = new Map<string, number>()
  const rows: ImportRow[] = []

  for (let r = 1; r < table.length; r++) {
    const cells = table[r] ?? []
    const get = (f: ImportField) => (cells[cols.get(f) ?? -1] ?? '').trim()
    const line = r + 1
    const errors: string[] = []
    const warnings: string[] = []
    const name = get('nome')
    const email = get('email').toLowerCase()

    if (name === '') errors.push('Nome obrigatório.')
    else if (name.length > MAX.nome) errors.push('Nome com mais de 200 caracteres.')

    if (email === '') errors.push('E-mail obrigatório (use o e-mail da Conta Google).')
    else if (!isValidEmail(email)) errors.push('E-mail inválido.')

    let alreadyExists = false
    if (email !== '' && isValidEmail(email)) {
      const first = seen.get(email)
      if (first !== undefined)
        errors.push(`E-mail repetido na planilha (linha ${first}).`)
      else seen.set(email, line)
      if (existing.has(email)) alreadyExists = true
    }

    let phone = get('telefone')
    if (phone !== '' && (phone.length > MAX.telefone || whatsappNumber(phone) === null)) {
      warnings.push('Telefone inválido: foi ignorado.')
      phone = ''
    }

    const level = get('nivel')
    if (level.length > MAX.nivel) errors.push('Nível com mais de 40 caracteres.')
    const goal = get('objetivo')
    if (goal.length > MAX.objetivo) errors.push('Objetivo com mais de 1000 caracteres.')

    let planId: string | null = null
    const planName = get('plano')
    if (planName !== '') {
      planId = planByName.get(normalizeText(planName)) ?? null
      if (!planId) warnings.push(`Plano "${planName}" não encontrado: ficará sem plano.`)
    }

    let meet = get('meet')
    if (meet !== '' && (meet.length > MAX.meet || !isValidMeetLink(meet))) {
      warnings.push('Link do Meet inválido: foi ignorado.')
      meet = ''
    }

    const minor = parseBool(get('menor'))
    if (minor === null) errors.push('"Menor de idade" deve ser Sim ou Não.')
    const status = parseStatus(get('situacao'))
    if (status === null) errors.push('Situação deve ser Ativo, Pausado ou Saiu.')

    let result: ImportStatus = 'importar'
    if (errors.length > 0) result = 'erro'
    else if (alreadyExists) {
      result = 'ja_existe'
      warnings.length = 0
    }
    counts[result]++
    rows.push({
      line,
      status: result,
      errors,
      warnings,
      name,
      email,
      student:
        result === 'importar'
          ? {
              full_name: name,
              email,
              phone: phone || null,
              level: level || null,
              goal: goal || null,
              plan_id: planId,
              meet_link: meet || null,
              is_minor: minor === true,
              status: status ?? 'ativo',
            }
          : null,
    })
  }
  return { rows, counts, fatal: null }
}
