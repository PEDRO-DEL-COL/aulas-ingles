import { addDaysKey } from './tz'

/** Quanto gerar de aulas recorrentes: a semana exibida ou as próximas N semanas a partir de hoje. */
export type GenerationScope = 'semana' | '4' | '8'

export const GENERATION_OPTIONS: readonly { value: GenerationScope; label: string }[] = [
  { value: 'semana', label: 'Semana exibida' },
  { value: '4', label: 'Próximas 4 semanas' },
  { value: '8', label: 'Próximas 8 semanas' },
]

/**
 * Intervalo [from, to] (datas "AAAA-MM-DD", inclusivas) para `generate_lessons`.
 * "semana" = semana exibida (weekStartKey..+6); N semanas = de hoje até hoje + 7N - 1.
 * O banco limita a 366 dias e pula `blocked_dates`.
 */
export function generationRange(
  scope: GenerationScope,
  weekStartKey: string,
  todayKey: string,
): { from: string; to: string } {
  if (scope === 'semana') return { from: weekStartKey, to: addDaysKey(weekStartKey, 6) }
  const weeks = Number(scope)
  return { from: todayKey, to: addDaysKey(todayKey, weeks * 7 - 1) }
}

export function generationMessage(scope: GenerationScope, created: number): string {
  const where = scope === 'semana' ? 'para esta semana' : `nas próximas ${scope} semanas`
  if (created === 0)
    return `Nenhuma aula nova: os horários fixos já estavam gerados ${where}.`
  return `${created} ${created === 1 ? 'aula criada' : 'aulas criadas'} ${where}.`
}
