import { useEffect, useMemo, useRef, type KeyboardEvent } from 'react'

import { teacherStatusInfo, type LessonWithStudent } from '@/features/professora/lessons'
import { addDaysKey } from '@/features/professora/tz'
import { formatTime } from '@/features/shared/datetime'
import { cn } from '@/lib/utils'

import {
  dayOfMonth,
  daySummary,
  lessonCountLabel,
  selectDayRange,
  shiftDate,
  STATUS_LABEL,
  visibleKeys,
  weekdayShort,
  WEEKDAY_INITIALS,
} from '../calendarUi'
import type { EffectiveDay } from '../engine'
import {
  firstName,
  lessonAriaLabel,
  mobileListDays,
  scrollTargetDay,
  truncateForCell,
  type MonthDetailMode,
} from '../monthDetail'
import { useDragSelect } from '../useDragSelect'
import { LESSON_VISUAL } from './lessonVisual'
import { STATUS_VISUAL } from './statusVisual'

type LessonButtonProps = {
  lesson: LessonWithStudent
  timezone: string
  tabIndex?: number
  className?: string
  onSelect: (lesson: LessonWithStudent) => void
}

/** Botão de uma aula: horário, primeiro nome e estado (ícone + texto acessível). */
function LessonButton({
  lesson,
  timezone,
  tabIndex,
  className,
  onSelect,
}: LessonButtonProps) {
  const time = formatTime(lesson.starts_at, timezone)
  const fullName = lesson.student?.full_name ?? 'Aluno'
  const { label } = teacherStatusInfo(lesson.status)
  const { Icon, tone } = LESSON_VISUAL[lesson.status]
  return (
    <button
      type="button"
      data-lesson
      tabIndex={tabIndex}
      aria-label={`${lessonAriaLabel(time, fullName, label)}. Abrir ações`}
      onClick={(e) => {
        // Não abre o painel do dia por trás.
        e.stopPropagation()
        onSelect(lesson)
      }}
      className={cn(
        'flex w-full min-w-0 items-center gap-1 rounded-md border px-1 py-0.5 text-left outline-none hover:brightness-95 focus-visible:ring-[3px] focus-visible:ring-ring/60',
        tone,
        className,
      )}
    >
      <Icon aria-hidden="true" className="size-3 shrink-0" />
      <span className="shrink-0 font-semibold tabular-nums">{time}</span>
      <span className="truncate">{firstName(fullName)}</span>
      <span className="sr-only">{label}</span>
    </button>
  )
}

export function MonthView({
  date,
  todayKey,
  timezone,
  days,
  activeLessonsByDay,
  detail = 'minimalista',
  onOpenDay,
  onFocusDate,
  onSelectRange,
  onSelectLesson,
}: {
  date: string
  todayKey: string
  timezone: string
  days: ReadonlyMap<string, EffectiveDay>
  /**
   * Aulas não canceladas por dia, em ordem. Aulas canceladas ficam fora da célula e da lista
   * (continuam visíveis no painel do dia).
   */
  activeLessonsByDay: ReadonlyMap<string, LessonWithStudent[]>
  detail?: MonthDetailMode
  onOpenDay: (key: string) => void
  onFocusDate: (key: string) => void
  onSelectRange: (from: string, to: string) => void
  onSelectLesson: (lesson: LessonWithStudent) => void
}) {
  const keys = useMemo(() => visibleKeys('mes', date), [date])
  const weeks = useMemo(() => {
    const out: string[][] = []
    for (let i = 0; i < keys.length; i += 7) out.push(keys.slice(i, i + 7))
    return out
  }, [keys])
  const month = date.slice(0, 7)
  const detailed = detail === 'detalhada'
  const gridRef = useRef<HTMLDivElement | null>(null)
  const pendingFocus = useRef(false)

  const listed = useMemo(
    () =>
      detailed
        ? mobileListDays(
            keys,
            month,
            (k) => days.get(k)?.status,
            (k) => activeLessonsByDay.get(k)?.length ?? 0,
          )
        : [],
    [detailed, keys, month, days, activeLessonsByDay],
  )

  // Celular (detalhada): rola a lista até hoje (ou o próximo dia listado) ao abrir o mês.
  const listRef = useRef<HTMLDivElement | null>(null)
  const listEmpty = listed.length === 0
  useEffect(() => {
    const list = listRef.current
    if (!list || listed.length === 0) return
    const target = scrollTargetDay(listed, todayKey)
    if (!target || !target.startsWith(month)) return
    const row = list.querySelector<HTMLElement>(`[data-day-row="${target}"]`)
    if (row) list.scrollTop = Math.max(0, row.offsetTop - list.offsetTop)
    // Só ao abrir/trocar de mês ou de modo, não a cada atualização dos dados.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, detailed, listEmpty])

  const drag = useDragSelect<string>({
    ignore: '[data-lesson]',
    resolve: (x, y) =>
      (document.elementFromPoint(x, y) as HTMLElement | null)?.closest<HTMLElement>(
        '[data-cell]',
      )?.dataset.cell ?? null,
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
    // Setas dentro do botão de uma aula não mudam de dia.
    if ((e.target as Element).closest('[data-lesson]')) return
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

  function openDay(key: string, inMonth: boolean) {
    if (drag.shouldSuppressClick()) return
    if (inMonth) onFocusDate(key)
    onOpenDay(key)
  }

  const sel = drag.selection
  const selRange = sel ? selectDayRange(sel.anchor, sel.current) : null

  return (
    <>
      <div
        role="grid"
        aria-label="Calendário do mês. Setas movem entre os dias; Enter abre o dia."
        aria-rowcount={weeks.length + 1}
        className={cn(
          'overflow-hidden rounded-xl border bg-card select-none',
          detailed && 'hidden md:block',
        )}
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
                const dayLessons = activeLessonsByDay.get(key)
                const lessons = dayLessons?.length ?? 0
                const inMonth = key.startsWith(month)
                const status = day?.status ?? 'nao_configurado'
                const { Icon, cell } = STATUS_VISUAL[status]
                const selected = selRange && key >= selRange.from && key <= selRange.to
                const { visible, hidden } = truncateForCell(dayLessons ?? [])
                return (
                  <div
                    key={key}
                    role="gridcell"
                    data-cell={key}
                    className="border-t border-l p-0.5 first:border-l-0 md:p-1"
                  >
                    <div
                      // O clique no espaço livre da célula também abre o dia (o botão do dia
                      // continua sendo o alvo de teclado); as aulas param a propagação.
                      onClick={detailed ? () => openDay(key, inMonth) : undefined}
                      className={cn(
                        'flex min-h-16 w-full flex-col items-start gap-0.5 rounded-lg border p-1 text-left md:min-h-24 md:p-1.5',
                        detailed &&
                          'cursor-pointer focus-within:ring-[3px] focus-within:ring-ring/60 md:min-h-32',
                        !detailed && 'p-0',
                        cell,
                        !inMonth && 'opacity-45',
                        selected && 'ring-2 ring-primary',
                      )}
                    >
                      <button
                        type="button"
                        data-key={key}
                        tabIndex={key === date ? 0 : -1}
                        aria-label={daySummary(key, status, lessons)}
                        aria-current={key === todayKey ? 'date' : undefined}
                        onClick={
                          detailed
                            ? undefined // sobe até a div da célula
                            : () => openDay(key, inMonth)
                        }
                        className={cn(
                          'flex w-full flex-col items-start gap-0.5 text-left outline-none',
                          detailed
                            ? 'rounded-md focus-visible:ring-[3px] focus-visible:ring-ring/60'
                            : 'min-h-16 flex-1 rounded-lg p-1 focus-visible:ring-[3px] focus-visible:ring-ring/60 md:min-h-24 md:p-1.5',
                        )}
                      >
                        <span className="flex w-full items-center gap-1">
                          <span
                            className={cn(
                              'inline-flex size-6 items-center justify-center rounded-full text-xs font-semibold',
                              key === todayKey && 'bg-primary text-primary-foreground',
                            )}
                          >
                            {dayOfMonth(key)}
                          </span>
                          {detailed ? (
                            <span
                              aria-hidden="true"
                              className="flex min-w-0 items-center gap-1 text-xs leading-tight font-medium"
                            >
                              <Icon className="size-3 shrink-0" />
                              <span className="truncate">
                                {STATUS_LABEL[status].short}
                              </span>
                            </span>
                          ) : null}
                        </span>
                        {!detailed ? (
                          <span
                            aria-hidden="true"
                            className="flex items-center gap-1 text-[10px] leading-tight font-medium md:text-xs"
                          >
                            <Icon className="size-3 shrink-0" />
                            <span className="hidden md:inline">
                              {STATUS_LABEL[status].short}
                            </span>
                          </span>
                        ) : null}
                        {!detailed && lessons > 0 ? (
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
                      {detailed && lessons > 0 ? (
                        <div className="flex w-full min-w-0 flex-col gap-0.5 text-[11px] leading-tight">
                          {visible.map((l) => (
                            <LessonButton
                              key={l.id}
                              lesson={l}
                              timezone={timezone}
                              // Roving: só as aulas do dia focado entram na ordem de Tab.
                              tabIndex={key === date ? 0 : -1}
                              onSelect={onSelectLesson}
                            />
                          ))}
                          {hidden > 0 ? (
                            <button
                              type="button"
                              tabIndex={key === date ? 0 : -1}
                              aria-label={`Mais ${hidden} ${hidden === 1 ? 'aula' : 'aulas'} em ${daySummary(key, status, lessons)}. Abrir o dia`}
                              onClick={(e) => {
                                e.stopPropagation()
                                openDay(key, inMonth)
                              }}
                              className="rounded-md px-1 text-left font-semibold text-primary outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/60"
                            >
                              +{hidden} mais
                            </button>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>

      {detailed ? (
        <div
          ref={listRef}
          role="list"
          aria-label="Dias do mês com aulas ou estado especial"
          className="relative max-h-[70vh] space-y-2 overflow-y-auto md:hidden"
        >
          {listed.length === 0 ? (
            <p className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">
              Nenhuma aula ou dia especial neste mês.
            </p>
          ) : null}
          {listed.map((key) => {
            const status = days.get(key)?.status ?? 'nao_configurado'
            const { Icon, chip } = STATUS_VISUAL[status]
            const dayLessons = activeLessonsByDay.get(key) ?? []
            const isToday = key === todayKey
            return (
              <section
                key={key}
                role="listitem"
                data-day-row={key}
                aria-current={isToday ? 'date' : undefined}
                className={cn(
                  'overflow-hidden rounded-xl border bg-card',
                  isToday && 'border-primary ring-2 ring-primary/40',
                )}
              >
                <button
                  type="button"
                  onClick={() => {
                    onFocusDate(key)
                    onOpenDay(key)
                  }}
                  aria-label={`${daySummary(key, status, dayLessons.length)}${isToday ? ', hoje' : ''}. Abrir o dia`}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/60 focus-visible:ring-inset"
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      'inline-flex size-9 shrink-0 flex-col items-center justify-center rounded-full text-sm leading-none font-semibold',
                      isToday ? 'bg-primary text-primary-foreground' : 'bg-muted',
                    )}
                  >
                    {dayOfMonth(key)}
                  </span>
                  <span aria-hidden="true" className="min-w-0 flex-1">
                    <span className="block text-xs text-muted-foreground uppercase">
                      {weekdayShort(key)}
                      {isToday ? ' · Hoje' : ''}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {lessonCountLabel(dayLessons.length)}
                    </span>
                  </span>
                  <span
                    aria-hidden="true"
                    className={cn(
                      'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium',
                      chip,
                    )}
                  >
                    <Icon className="size-3" />
                    {STATUS_LABEL[status].label}
                  </span>
                </button>
                {dayLessons.length > 0 ? (
                  <div className="space-y-1 border-t p-2 text-sm">
                    {dayLessons.map((l) => (
                      <LessonButton
                        key={l.id}
                        lesson={l}
                        timezone={timezone}
                        className="min-h-10 gap-2 px-2 py-1.5"
                        onSelect={onSelectLesson}
                      />
                    ))}
                  </div>
                ) : null}
              </section>
            )
          })}
        </div>
      ) : null}
    </>
  )
}
