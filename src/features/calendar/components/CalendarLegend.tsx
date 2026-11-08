import { Ban } from 'lucide-react'

import { STATUS_LABEL } from '../calendarUi'
import type { DayStatus } from '../engine'
import { HATCH_STYLE, STATUS_VISUAL } from './statusVisual'

const ORDER: DayStatus[] = [
  'disponivel',
  'parcial',
  'sem_horario',
  'fechado',
  'feriado',
  'ferias',
  'nao_configurado',
]

export function CalendarLegend({ view }: { view: 'mes' | 'semana' | 'dia' }) {
  return (
    <section aria-label="Legenda do calendário" className="space-y-2">
      <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs">
        {ORDER.map((s) => {
          const { Icon, chip } = STATUS_VISUAL[s]
          return (
            <li key={s} className="flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className={`inline-flex size-5 items-center justify-center rounded-md ${chip}`}
              >
                <Icon className="size-3" />
              </span>
              {STATUS_LABEL[s].label}
            </li>
          )
        })}
      </ul>
      {view !== 'mes' ? (
        <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs">
          <li className="flex items-center gap-1.5">
            <span aria-hidden="true" className="size-5 rounded-md bg-sage/70" />
            Horário disponível
          </li>
          <li className="flex items-center gap-1.5">
            <span
              aria-hidden="true"
              style={HATCH_STYLE}
              className="inline-flex size-5 items-center justify-center rounded-md border"
            >
              <Ban className="size-3 text-peach-text" />
            </span>
            Bloqueio
          </li>
          <li className="flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="size-5 rounded-md border border-primary/40 bg-lavender"
            />
            Aula
          </li>
        </ul>
      ) : null}
    </section>
  )
}
