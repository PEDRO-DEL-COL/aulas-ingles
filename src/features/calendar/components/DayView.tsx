import { Ban, CalendarClock, Settings2 } from 'lucide-react'
import { useMemo } from 'react'

import { Button } from '@/components/ui/button'
import { TeacherStatusBadge } from '@/features/professora/components/TeacherStatusBadge'
import type { LessonWithStudent } from '@/features/professora/lessons'
import { EmptyState } from '@/features/shared/components/StateViews'
import { formatTime } from '@/features/shared/datetime'
import { cn } from '@/lib/utils'

import {
  dayEntries,
  lessonCountLabel,
  longDayLabel,
  rangeLabel,
  STATUS_LABEL,
} from '../calendarUi'
import { lessonLocalRange, type EffectiveDay } from '../engine'
import { STATUS_VISUAL } from './statusVisual'

const isCancelled = (l: LessonWithStudent) =>
  l.status === 'cancelada_aluno' || l.status === 'cancelada_professora'

/** Visão "Agenda do dia": faixas livres, bloqueios e aulas em ordem. */
export function DayView({
  dateKey,
  day,
  lessons,
  timezone,
  onSelectLesson,
  onOpenPanel,
}: {
  dateKey: string
  day: EffectiveDay
  /** Todas as aulas do dia (inclui canceladas). */
  lessons: LessonWithStudent[]
  timezone: string
  onSelectLesson: (l: LessonWithStudent) => void
  onOpenPanel: () => void
}) {
  const active = useMemo(() => lessons.filter((l) => !isCancelled(l)), [lessons])
  const cancelled = useMemo(() => lessons.filter(isCancelled), [lessons])
  const byId = useMemo(() => new Map(lessons.map((l) => [l.id, l])), [lessons])
  const entries = useMemo(
    () =>
      dayEntries(
        day,
        active.map((l) => {
          const { range } = lessonLocalRange(l, timezone)
          return { id: l.id, start: range[0], end: range[1] }
        }),
      ),
    [day, active, timezone],
  )
  const { Icon, chip } = STATUS_VISUAL[day.status]

  return (
    <section aria-label={`Agenda de ${longDayLabel(dateKey)}`} className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-card p-3">
        <div className="space-y-1">
          <h2 className="font-semibold first-letter:uppercase">
            {longDayLabel(dateKey)}
          </h2>
          <p className="flex flex-wrap items-center gap-2 text-sm">
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold',
                chip,
              )}
            >
              <Icon aria-hidden="true" className="size-3" />
              {STATUS_LABEL[day.status].label}
            </span>
            <span className="text-muted-foreground">
              {lessonCountLabel(active.length)}
            </span>
            {day.blocked?.reason ? (
              <span className="text-muted-foreground">· {day.blocked.reason}</span>
            ) : null}
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={onOpenPanel}>
          <Settings2 aria-hidden="true" />
          Ações do dia
        </Button>
      </div>

      {entries.length === 0 ? (
        <EmptyState title="Nada neste dia">
          Sem faixas de atendimento, bloqueios nem aulas. Use &quot;Ações do dia&quot;
          para adicionar um horário extra.
        </EmptyState>
      ) : (
        <ol className="space-y-2">
          {entries.map((e, i) => {
            if (e.kind === 'aula') {
              const l = byId.get(e.lessonId)
              if (!l) return null
              return (
                <li key={`a-${l.id}`}>
                  <button
                    type="button"
                    onClick={() => onSelectLesson(l)}
                    className="flex w-full items-center justify-between gap-3 rounded-xl border border-primary/30 bg-lavender p-3 text-left outline-none hover:brightness-95 focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  >
                    <span className="min-w-0">
                      <span className="block font-semibold">
                        {formatTime(l.starts_at, timezone)}{' '}
                        <span className="font-normal text-muted-foreground">
                          {l.duration_minutes} min
                        </span>
                      </span>
                      <span className="block truncate">
                        {l.student?.full_name ?? 'Aluno'}
                      </span>
                    </span>
                    <TeacherStatusBadge status={l.status} />
                  </button>
                </li>
              )
            }
            if (e.kind === 'bloqueio') {
              return (
                <li
                  key={`b-${i}`}
                  className="flex items-center gap-2 rounded-xl border border-peach-text/30 bg-peach/60 p-3 text-sm text-peach-text"
                >
                  <Ban aria-hidden="true" className="size-4 shrink-0" />
                  <span>
                    <strong>Bloqueado</strong> {rangeLabel([e.start, e.end])}
                    {e.reason ? ` · ${e.reason}` : ''}
                  </span>
                </li>
              )
            }
            return (
              <li
                key={`l-${i}`}
                className="flex items-center gap-2 rounded-xl border bg-sage/60 p-3 text-sm text-sage-text"
              >
                <CalendarClock aria-hidden="true" className="size-4 shrink-0" />
                <span>
                  <strong>Disponível</strong> {rangeLabel([e.start, e.end])}
                </span>
              </li>
            )
          })}
        </ol>
      )}

      {cancelled.length > 0 ? (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-muted-foreground">Canceladas</h3>
          <ul className="space-y-2">
            {cancelled.map((l) => (
              <li key={l.id}>
                <button
                  type="button"
                  onClick={() => onSelectLesson(l)}
                  className="flex w-full items-center justify-between gap-3 rounded-xl border bg-card p-3 text-left text-muted-foreground outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                  <span className="truncate">
                    {formatTime(l.starts_at, timezone)} ·{' '}
                    {l.student?.full_name ?? 'Aluno'}
                  </span>
                  <TeacherStatusBadge status={l.status} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  )
}
