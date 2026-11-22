import { Ban, Check, Clock, Repeat, UserX, type LucideIcon } from 'lucide-react'

import type { LessonStatus } from '@/features/aluno/lessons'

/** Ícone + cores do estado de uma aula (sempre acompanhado de texto, nunca só cor). */
export const LESSON_VISUAL: Record<LessonStatus, { Icon: LucideIcon; tone: string }> = {
  agendada: { Icon: Clock, tone: 'border-primary/30 bg-sky/70 text-primary' },
  reposicao: { Icon: Repeat, tone: 'border-primary/30 bg-lavender text-primary' },
  realizada: { Icon: Check, tone: 'border-sage-text/30 bg-sage text-sage-text' },
  falta_aluno: {
    Icon: UserX,
    tone: 'border-destructive/30 bg-destructive/10 text-destructive',
  },
  cancelada_aluno: { Icon: Ban, tone: 'border-border bg-muted text-muted-foreground' },
  cancelada_professora: {
    Icon: Ban,
    tone: 'border-warning/30 bg-warning-soft text-warning',
  },
}
