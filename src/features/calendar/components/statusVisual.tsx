import {
  Ban,
  Check,
  Clock,
  Info,
  Minus,
  Plane,
  Star,
  type LucideIcon,
} from 'lucide-react'

import type { DayStatus } from '../engine'

/** Cor + ícone + texto de cada estado do dia (nunca só cor). */
export const STATUS_VISUAL: Record<
  DayStatus,
  { Icon: LucideIcon; cell: string; chip: string }
> = {
  disponivel: {
    Icon: Check,
    cell: 'bg-sage/70 border-sage-text/20',
    chip: 'bg-sage text-sage-text',
  },
  parcial: {
    Icon: Clock,
    cell: 'bg-sky/70 border-primary/20',
    chip: 'bg-sky text-primary',
  },
  sem_horario: {
    Icon: Minus,
    cell: 'bg-muted border-border',
    chip: 'bg-muted text-muted-foreground',
  },
  fechado: {
    Icon: Ban,
    cell: 'bg-peach/80 border-peach-text/20',
    chip: 'bg-peach text-peach-text',
  },
  feriado: {
    Icon: Star,
    cell: 'bg-warning-soft border-warning/25',
    chip: 'bg-warning-soft text-warning',
  },
  ferias: {
    Icon: Plane,
    cell: 'bg-lavender border-primary/20',
    chip: 'bg-lavender text-primary',
  },
  nao_configurado: {
    Icon: Info,
    cell: 'bg-card border-dashed border-border',
    chip: 'border border-dashed bg-card text-muted-foreground',
  },
}

/** Fundo hachurado dos bloqueios. */
export const HATCH_STYLE = {
  backgroundImage:
    'repeating-linear-gradient(45deg, transparent 0 5px, color-mix(in srgb, var(--peach-text) 22%, transparent) 5px 7px)',
} as const
