/**
 * Lógica PURA da visão Mês "Detalhada": preferência salva no navegador, agrupamento e
 * corte das aulas por dia e escolha dos dias da lista do celular.
 */
import type { DayStatus } from './engine'

// ------------------------------------------------------------------ preferência

export type MonthDetailMode = 'minimalista' | 'detalhada'

export const MONTH_DETAIL_MODES: readonly {
  value: MonthDetailMode
  label: string
}[] = [
  { value: 'minimalista', label: 'Minimalista' },
  { value: 'detalhada', label: 'Detalhada' },
]

export const MONTH_DETAIL_STORAGE_KEY = 'aulas-ingles:calendario:mes-detalhe:v1'
export const DEFAULT_MONTH_DETAIL_MODE: MonthDetailMode = 'minimalista'

export function isMonthDetailMode(value: unknown): value is MonthDetailMode {
  return value === 'minimalista' || value === 'detalhada'
}

/** Valor salvo inválido (ou ausente) cai no padrão. */
export function parseMonthDetailMode(raw: unknown): MonthDetailMode {
  return isMonthDetailMode(raw) ? raw : DEFAULT_MONTH_DETAIL_MODE
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>

function browserStorage(): StorageLike | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}

export function readMonthDetailMode(storage: StorageLike | null = browserStorage()) {
  try {
    return parseMonthDetailMode(storage?.getItem(MONTH_DETAIL_STORAGE_KEY))
  } catch {
    return DEFAULT_MONTH_DETAIL_MODE
  }
}

export function writeMonthDetailMode(
  mode: MonthDetailMode,
  storage: StorageLike | null = browserStorage(),
): void {
  try {
    storage?.setItem(MONTH_DETAIL_STORAGE_KEY, mode)
  } catch {
    // Armazenamento bloqueado ou cheio: a escolha só vale nesta sessão.
  }
}

// ------------------------------------------------------------------ aulas por dia

/** Máximo de aulas listadas em cada célula (desktop); o resto vira "+N mais". */
export const MAX_LESSONS_PER_CELL = 3

type WithStart = { starts_at: string }

/** Cópia ordenada por início (desempate estável pela posição original). */
export function sortLessonsByStart<T extends WithStart>(lessons: readonly T[]): T[] {
  return [...lessons].sort(
    (a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime(),
  )
}

/** Agrupa por chave de dia (fornecida por quem chama) com cada dia em ordem cronológica. */
export function groupLessonsByDay<T extends WithStart>(
  lessons: readonly T[],
  keyOf: (lesson: T) => string,
): Map<string, T[]> {
  const out = new Map<string, T[]>()
  for (const l of sortLessonsByStart(lessons)) {
    const k = keyOf(l)
    const list = out.get(k)
    if (list) list.push(l)
    else out.set(k, [l])
  }
  return out
}

/** Corta em `max` itens e informa quantos ficaram de fora. */
export function truncateForCell<T>(
  items: readonly T[],
  max: number = MAX_LESSONS_PER_CELL,
): { visible: T[]; hidden: number } {
  const limit = Math.max(0, Math.floor(max))
  return {
    visible: items.slice(0, limit),
    hidden: Math.max(0, items.length - limit),
  }
}

// ------------------------------------------------------------------ lista do celular

const SPECIAL_STATUSES: ReadonlySet<DayStatus> = new Set(['fechado', 'feriado', 'ferias'])

/**
 * Dias do mês exibido que entram na lista do celular: com aulas ou com estado especial
 * (fechado, feriado, férias). Dias de meses vizinhos (da grade) ficam de fora.
 */
export function mobileListDays(
  keys: readonly string[],
  month: string,
  statusOf: (key: string) => DayStatus | undefined,
  lessonCountOf: (key: string) => number,
): string[] {
  return keys.filter((k) => {
    if (!k.startsWith(month)) return false
    if (lessonCountOf(k) > 0) return true
    const s = statusOf(k)
    return s !== undefined && SPECIAL_STATUSES.has(s)
  })
}

/** Primeiro dia da lista a rolar até: hoje, ou o próximo dia listado depois de hoje. */
export function scrollTargetDay(
  listed: readonly string[],
  todayKey: string,
): string | null {
  return listed.find((k) => k >= todayKey) ?? null
}

// ------------------------------------------------------------------ textos

export function firstName(fullName: string | null | undefined): string {
  return fullName?.trim().split(/\s+/)[0] || 'Aluno'
}

/** "09:00, Ana Souza, agendada" (aria-label do botão da aula). */
export function lessonAriaLabel(time: string, fullName: string, statusLabel: string) {
  return `${time}, ${fullName.trim() || 'Aluno'}, ${statusLabel.toLowerCase()}`
}
