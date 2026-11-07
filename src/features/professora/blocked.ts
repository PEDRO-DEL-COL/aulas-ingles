/** Lógica pura de dias bloqueados (férias/feriados) e do formulário de materiais. */
import { formatDateOnly } from '@/features/shared/datetime'

import { parseDayKey } from './tz'
import { isValidHttpUrl } from './validation'

export type BlockedRange = { starts_on: string; ends_on: string }

export type BlockedDateFormValues = {
  starts_on: string
  /** Vazio = mesmo dia da data inicial. */
  ends_on: string
  reason: string
}

export type BlockedDateFormErrors = Partial<Record<keyof BlockedDateFormValues, string>>

export function validateBlockedDateForm(v: BlockedDateFormValues): BlockedDateFormErrors {
  const errors: BlockedDateFormErrors = {}
  if (v.starts_on === '') errors.starts_on = 'Informe a data inicial.'
  else if (!parseDayKey(v.starts_on)) errors.starts_on = 'Data inicial inválida.'
  if (v.ends_on !== '') {
    if (!parseDayKey(v.ends_on)) errors.ends_on = 'Data final inválida.'
    else if (!errors.starts_on && v.ends_on < v.starts_on)
      errors.ends_on = 'A data final não pode ser antes da inicial.'
  }
  if (v.reason.trim().length > 200) errors.reason = 'Use até 200 caracteres.'
  return errors
}

export function isDateBlocked(dateKey: string, list: readonly BlockedRange[]): boolean {
  return list.some((b) => b.starts_on <= dateKey && dateKey <= b.ends_on)
}

export function classifyBlockedDates<T extends BlockedRange>(
  list: readonly T[],
  todayKey: string,
): { atuais: T[]; futuras: T[]; passadas: T[] } {
  const atuais: T[] = []
  const futuras: T[] = []
  const passadas: T[] = []
  for (const b of list) {
    if (b.ends_on < todayKey) passadas.push(b)
    else if (b.starts_on > todayKey) futuras.push(b)
    else atuais.push(b)
  }
  atuais.sort((a, b) => a.starts_on.localeCompare(b.starts_on))
  futuras.sort((a, b) => a.starts_on.localeCompare(b.starts_on))
  passadas.sort((a, b) => b.starts_on.localeCompare(a.starts_on))
  return { atuais, futuras, passadas }
}

/** "24/12/2026" ou "24/12/2026 a 06/01/2027". */
export function formatBlockedRange(startsOn: string, endsOn: string): string {
  return startsOn === endsOn
    ? formatDateOnly(startsOn)
    : `${formatDateOnly(startsOn)} a ${formatDateOnly(endsOn)}`
}

/** Aviso mostrado antes de salvar um período com aulas já agendadas. */
export function blockPreviewMessage(count: number): string {
  const aulas = count === 1 ? '1 aula agendada' : `${count} aulas agendadas`
  const serao = count === 1 ? 'será cancelada' : 'serão canceladas'
  return `Ao salvar, ${aulas} nesse período ${serao} como 'cancelada pela professora', com direito a reposição (não contam no limite mensal do aluno).`
}

/** "1 aula cancelada automaticamente" / "N aulas canceladas automaticamente". */
export function canceledSummaryTitle(count: number): string {
  return count === 1
    ? '1 aula cancelada automaticamente'
    : `${count} aulas canceladas automaticamente`
}

/** Conta aulas por blocked_date_id (ignora nulos). */
export function countByBlockedDate(
  rows: readonly { blocked_date_id: string | null }[],
): Map<string, number> {
  const map = new Map<string, number>()
  for (const r of rows) {
    if (r.blocked_date_id)
      map.set(r.blocked_date_id, (map.get(r.blocked_date_id) ?? 0) + 1)
  }
  return map
}

export type MaterialTarget =
  | { kind: 'geral' }
  | { kind: 'aluno'; studentId: string }
  | { kind: 'aula'; lessonId: string }

export type MaterialFormValues = {
  title: string
  url: string
  description: string
  /** 'geral' | 'aluno' | 'aula' */
  targetKind: string
  studentId: string
  lessonId: string
}

export type MaterialFormErrors = Partial<Record<keyof MaterialFormValues, string>>

export function validateMaterialForm(v: MaterialFormValues): MaterialFormErrors {
  const errors: MaterialFormErrors = {}
  const title = v.title.trim()
  if (title === '') errors.title = 'Informe o título.'
  else if (title.length > 200) errors.title = 'Use até 200 caracteres.'

  if (v.url.trim() === '') errors.url = 'Informe o link do material.'
  else if (!isValidHttpUrl(v.url))
    errors.url = 'Link inválido. Use um endereço que comece com https://.'

  if (v.description.trim().length > 2000) errors.description = 'Use até 2000 caracteres.'

  if (v.targetKind === 'aluno') {
    if (v.studentId === '') errors.studentId = 'Escolha o aluno.'
  } else if (v.targetKind === 'aula') {
    if (v.studentId === '') errors.studentId = 'Escolha o aluno da aula.'
    else if (v.lessonId === '') errors.lessonId = 'Escolha a aula.'
  } else if (v.targetKind !== 'geral') {
    errors.targetKind = 'Escolha para quem é o material.'
  }
  return errors
}
