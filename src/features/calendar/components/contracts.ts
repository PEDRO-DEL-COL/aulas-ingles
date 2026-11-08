/**
 * Contratos (props) dos painéis do calendário. Os componentes vivem em arquivos próprios
 * e a página Calendário só depende destes tipos.
 */
import type { LessonWithStudent } from '@/features/professora/lessons'

import type { AvailabilityData } from '../engine'

export type DateRange = { from: string; to: string }

/** Assistente "Definir horário padrão" (criar ou editar um padrão, com prévia). */
export type PatternWizardProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  data: AvailabilityData
  timezone: string
  /** Padrão a editar; null = criar novo. */
  patternId: string | null
  /** Recarregar os dados depois de salvar/excluir. */
  onSaved: () => void
}

/** Painel de feriados nacionais (sugestões) + feriados manuais. */
export type HolidaysPanelProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  year: number
  data: AvailabilityData
  timezone: string
  onApplied: () => void
}

/** Férias / período bloqueado (blocked_dates) por intervalo de datas. */
export type VacationDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Intervalo pré-selecionado (ex.: arrastado no mês); null = escolher. */
  initialRange: DateRange | null
  timezone: string
  onSaved: () => void
}

export type ConflictAction = 'manter' | 'cancelar' | 'desfazer'

/** Lista as aulas afetadas por uma mudança e deixa a professora escolher o que fazer. */
export type ConflictDialogProps = {
  open: boolean
  title: string
  description?: string
  lessons: LessonWithStudent[]
  timezone: string
  busy?: boolean
  onResolve: (action: ConflictAction) => void
}
