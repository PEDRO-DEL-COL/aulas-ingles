import {
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  PartyPopper,
  Plane,
  RefreshCw,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import { CALENDAR_VIEWS, periodTitle, type CalendarView } from '../calendarUi'

const PERIOD_WORD: Record<CalendarView, string> = {
  mes: 'mês',
  semana: 'semana',
  dia: 'dia',
}

export function CalendarToolbar({
  view,
  date,
  refreshing,
  onView,
  onToday,
  onShift,
  onDate,
  onPattern,
  onHolidays,
  onVacation,
  onGenerate,
}: {
  view: CalendarView
  date: string
  refreshing: boolean
  onView: (v: CalendarView) => void
  onToday: () => void
  onShift: (dir: 1 | -1) => void
  onDate: (key: string) => void
  onPattern: () => void
  onHolidays: () => void
  onVacation: () => void
  onGenerate: () => void
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-auto min-w-0 text-xl font-bold first-letter:uppercase sm:text-2xl">
          <span className="sr-only">Calendário: </span>
          {periodTitle(view, date)}
          {refreshing ? (
            <RefreshCw
              aria-hidden="true"
              className="ml-2 inline size-4 animate-spin text-muted-foreground"
            />
          ) : null}
          {refreshing ? <span className="sr-only">Atualizando…</span> : null}
        </h1>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" onClick={onToday}>
            Hoje
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="size-9"
            aria-label={`Anterior (${PERIOD_WORD[view]})`}
            onClick={() => onShift(-1)}
          >
            <ChevronLeft aria-hidden="true" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="size-9"
            aria-label={`Próximo (${PERIOD_WORD[view]})`}
            onClick={() => onShift(1)}
          >
            <ChevronRight aria-hidden="true" />
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <fieldset className="inline-flex rounded-lg border bg-muted/50 p-0.5">
          <legend className="sr-only">Visão do calendário</legend>
          {CALENDAR_VIEWS.map((v) => (
            <label key={v.value} className="relative">
              <input
                type="radio"
                name="visao"
                value={v.value}
                checked={view === v.value}
                onChange={() => onView(v.value)}
                className="peer sr-only"
              />
              <span
                className={cn(
                  'inline-flex h-8 cursor-pointer items-center rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors',
                  'peer-checked:bg-card peer-checked:text-primary peer-checked:shadow-xs',
                  'peer-focus-visible:ring-[3px] peer-focus-visible:ring-ring/60',
                )}
              >
                {v.label}
              </span>
            </label>
          ))}
        </fieldset>
        <label className="flex items-center gap-1.5 text-sm">
          <span className="sr-only sm:not-sr-only sm:text-muted-foreground">Ir para</span>
          <input
            type="date"
            value={date}
            aria-label="Ir para a data"
            onChange={(e) => {
              if (e.target.value) onDate(e.target.value)
            }}
            className="h-9 rounded-md border border-input bg-background px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          />
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" onClick={onPattern}>
          <CalendarClock aria-hidden="true" />
          Horário padrão
        </Button>
        <Button variant="secondary" size="sm" onClick={onHolidays}>
          <PartyPopper aria-hidden="true" />
          Feriados
        </Button>
        <Button variant="secondary" size="sm" onClick={onVacation}>
          <Plane aria-hidden="true" />
          Férias
        </Button>
        <Button variant="secondary" size="sm" onClick={onGenerate}>
          <RefreshCw aria-hidden="true" />
          Gerar aulas
        </Button>
      </div>
    </div>
  )
}
