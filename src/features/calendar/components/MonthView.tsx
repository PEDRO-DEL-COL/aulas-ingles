import { useEffect, useMemo, useRef, type KeyboardEvent } from 'react'

import { addDaysKey } from '@/features/professora/tz'
import type { LessonWithStudent } from '@/features/professora/lessons'
import { cn } from '@/lib/utils'

import {
  dayOfMonth,
  daySummary,
  selectDayRange,
  shiftDate,
  STATUS_LABEL,
  visibleKeys,
  WEEKDAY_INITIALS,
} from '../calendarUi'
import type { EffectiveDay } from '../engine'
import { useDragSelect } from '../useDragSelect'
import { STATUS_VISUAL } from './statusVisual'

export function MonthView({
  date,
  todayKey,
  days,
  activeLessonsByDay,
  onOpenDay,
  onFocusDate,
  onSelectRange,
}: {
  date: string
  todayKey: string
  days: ReadonlyMap<string, EffectiveDay>
  activeLessonsByDay: ReadonlyMap<string, LessonWithStudent[]>
  onOpenDay: (key: string) => void
  onFocusDate: (key: string) => void
  onSelectRange: (from: string, to: string) => void
}) {
  const keys = useMemo(() => visibleKeys('mes', date), [date])
  const weeks = useMemo(() => {
    const out: string[][] = []
    for (let i = 0; i < keys.length; i += 7) out.push(keys.slice(i, i + 7))
    return out
  }, [keys])
  const month = date.slice(0, 7)
  const gridRef = useRef<HTMLDivElement | null>(null)
  const pendingFocus = useRef(false)

  const drag = useDragSelect<string>({
    resolve: (x, y) =>
      (document.elementFromPoint(x, y) as HTMLElement | null)?.closest<HTMLElement>(
        '[data-key]',
      )?.dataset.key ?? null,
    onCommit: (a, b) => {
      const r = selectDayRange(a, b)
      onSelectRange(r.from, r.to)
    },
  })

  useEffect(() => {
    if (!pendingFocus.current) return
    pendingFocus.current = false
    gridRef.current?.querySelector<HTMLElement>(`[data-key="${date}"]`)?.focus()
  }, [date])

  function onKeyDown(e: KeyboardEvent) {
    let next: string | null = null
    switch (e.key) {
      case 'ArrowLeft':
        next = addDaysKey(date, -1)
        break
      case 'ArrowRight':
        next = addDaysKey(date, 1)
        break
      case 'ArrowUp':
        next = addDaysKey(date, -7)
        break
      case 'ArrowDown':
        next = addDaysKey(date, 7)
        break
      case 'PageUp':
        next = shiftDate('mes', date, -1)
        break
      case 'PageDown':
        next = shiftDate('mes', date, 1)
        break
    }
    if (next) {
      e.preventDefault()
      pendingFocus.current = true
      onFocusDate(next)
    }
  }

  const sel = drag.selection
  const selRange = sel ? selectDayRange(sel.anchor, sel.current) : null

  return (
    <div
      role="grid"
      aria-label="Calendário do mês. Setas movem entre os dias; Enter abre o dia."
      aria-rowcount={weeks.length + 1}
      className="overflow-hidden rounded-xl border bg-card select-none"
    >
      <div role="row" className="grid grid-cols-7 border-b bg-muted/40">
        {WEEKDAY_INITIALS.map((d, i) => (
          <div
            key={i}
            role="columnheader"
            aria-label={
              ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'][i]
            }
            className="py-1.5 text-center text-xs font-semibold text-muted-foreground"
          >
            {d}
          </div>
        ))}
      </div>
      <div
        ref={(el) => {
          gridRef.current = el
          drag.bindContainer(el)
        }}
        onKeyDown={onKeyDown}
        {...drag.handlers}
        className="touch-manipulation"
      >
        {weeks.map((week) => (
          <div key={week[0]} role="row" className="grid grid-cols-7">
            {week.map((key) => {
              const day = days.get(key)
              const lessons = activeLessonsByDay.get(key)?.length ?? 0
              const inMonth = key.startsWith(month)
              const status = day?.status ?? 'nao_configurado'
              const { Icon, cell } = STATUS_VISUAL[status]
              const selected = selRange && key >= selRange.from && key <= selRange.to
              return (
                <div
                  key={key}
                  role="gridcell"
                  className="border-t border-l p-0.5 first:border-l-0 md:p-1"
                >
                  <button
                    type="button"
                    data-key={key}
                    tabIndex={key === date ? 0 : -1}
                    aria-label={daySummary(key, status, lessons)}
                    aria-current={key === todayKey ? 'date' : undefined}
                    onClick={() => {
                      if (drag.shouldSuppressClick()) return
                      if (inMonth) onFocusDate(key)
                      onOpenDay(key)
                    }}
                    className={cn(
                      'flex min-h-16 w-full flex-col items-start gap-0.5 rounded-lg border p-1 text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/60 md:min-h-24 md:p-1.5',
                      cell,
                      !inMonth && 'opacity-45',
                      selected && 'ring-2 ring-primary',
                    )}
                  >
                    <span
                      className={cn(
                        'inline-flex size-6 items-center justify-center rounded-full text-xs font-semibold',
                        key === todayKey && 'bg-primary text-primary-foreground',
                      )}
                    >
                      {dayOfMonth(key)}
                    </span>
                    <span
                      aria-hidden="true"
                      className="flex items-center gap-1 text-[10px] leading-tight font-medium md:text-xs"
                    >
                      <Icon className="size-3 shrink-0" />
                      <span className="hidden md:inline">
                        {STATUS_LABEL[status].short}
                      </span>
                    </span>
                    {lessons > 0 ? (
                      <span
                        aria-hidden="true"
                        className="mt-auto rounded-full bg-primary/10 px-1.5 text-[10px] font-semibold text-primary md:text-xs"
                      >
                        <span className="md:hidden">{lessons}</span>
                        <span className="hidden md:inline">
                          {lessons === 1 ? '1 aula' : `${lessons} aulas`}
                        </span>
                      </span>
                    ) : null}
                  </button>
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
