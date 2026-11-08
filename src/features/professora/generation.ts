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

// ------------------------------------------------------------ relatório (generate_recurring_lessons)

export type SkipReason = 'bloqueado' | 'fora_disponibilidade'

export type SkippedLesson = {
  studentId: string
  studentName: string
  startsAt: string
  durationMinutes: number
  reason: SkipReason
}

export type GenerationReport = {
  created: number
  skippedTotal: number
  skipped: SkippedLesson[]
}

export const SKIP_REASON_LABEL: Record<SkipReason, string> = {
  bloqueado: 'Férias, feriado ou dia fechado',
  fora_disponibilidade: 'Fora do horário disponível',
}

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

/** Lê o jsonb devolvido pela RPC de forma defensiva (nunca lança). */
export function parseGenerationReport(raw: unknown): GenerationReport {
  const obj = isObj(raw) ? raw : {}
  const skipped: SkippedLesson[] = []
  if (Array.isArray(obj.skipped)) {
    for (const item of obj.skipped as unknown[]) {
      if (!isObj(item) || typeof item.starts_at !== 'string') continue
      skipped.push({
        studentId: typeof item.student_id === 'string' ? item.student_id : '',
        studentName:
          typeof item.student_name === 'string' && item.student_name
            ? item.student_name
            : 'Aluno',
        startsAt: item.starts_at,
        durationMinutes:
          typeof item.duration_minutes === 'number' ? item.duration_minutes : 0,
        reason: item.reason === 'bloqueado' ? 'bloqueado' : 'fora_disponibilidade',
      })
    }
  }
  const created = typeof obj.created === 'number' ? obj.created : 0
  const total = typeof obj.skipped_total === 'number' ? obj.skipped_total : skipped.length
  return { created, skippedTotal: Math.max(total, skipped.length), skipped }
}

/** Resumo curto para o aviso (toast) depois de gerar. */
export function generationReportMessage(
  scope: GenerationScope,
  report: GenerationReport,
): string {
  const base = generationMessage(scope, report.created)
  if (report.skippedTotal === 0) return base
  const n = report.skippedTotal
  return `${base} ${n} ${n === 1 ? 'ocorrência foi pulada' : 'ocorrências foram puladas'} (fora da disponibilidade).`
}

/** Aviso (não bloqueante) quando um horário fixo não cabe na disponibilidade. */
export function scheduleFitSummary(outsideCount: number, total: number): string {
  return `Este horário não cabe na sua disponibilidade em ${outsideCount} das próximas ${total} ${total === 1 ? 'semana' : 'semanas'}; essas aulas não serão geradas.`
}
