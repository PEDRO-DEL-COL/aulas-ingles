/* eslint-disable react-hooks/refs -- falso positivo: useDragSelect só lê refs em handlers/efeitos */
import { Ban } from 'lucide-react'
import { useEffect, useMemo, useRef } from 'react'

import { TeacherStatusBadge } from '@/features/professora/components/TeacherStatusBadge'
import type { LessonWithStudent } from '@/features/professora/lessons'
import { formatTime } from '@/features/shared/datetime'
import { cn } from '@/lib/utils'

import {
  dayOfMonth,
  daySummary,
  layoutOverlaps,
  minuteFromOffset,
  rangeLabel,
  selectMinutes,
  STATUS_LABEL,
  visibleKeys,
  weekdayShort,
} from '../calendarUi'
import {
  lessonLocalRange,
  localParts,
  minuteToTime,
  timeToMinute,
  type EffectiveDay,
  type Range,
} from '../engine'
import { useDragSelect } from '../useDragSelect'
import { HATCH_STYLE, STATUS_VISUAL } from './statusVisual'

const PX = 1.2
const ROW = 30 * PX
const DEFAULT_START = 6 * 60
const DEFAULT_END = 23 * 60

type Point = { dateKey: string; minute: number }

const CLOSED = new Set(['fechado', 'feriado', 'ferias'])

const CARD_TONE: Record<string, string> = {
  realizada: 'border-sage-text/40 bg-sage text-sage-text',
  falta_aluno: 'border-destructive/40 bg-destructive/10 text-destructive',
}

export function WeekView({
  date,
  todayKey,
  timezone,
  days,
  activeLessonsByDay,
  onSelectLesson,
  onOpenDay,
  onFocusDate,
  onSelectMinutes,
}: {
  date: string
  todayKey: string
  timezone: string
  days: ReadonlyMap<string, EffectiveDay>
  /** Aulas não canceladas por dia. */
  activeLessonsByDay: ReadonlyMap<string, LessonWithStudent[]>
  onSelectLesson: (lesson: LessonWithStudent) => void
  onOpenDay: (key: string) => void
  onFocusDate: (key: string) => void
  onSelectMinutes: (dateKey: string, range: Range) => void
}) {
  const keys = useMemo(() => visibleKeys('semana', date), [date])
  const scrollRef = useRef<HTMLDivElement | null>(null)

  const { gridStart, gridEnd } = useMemo(() => {
    let s = DEFAULT_START
    let e = DEFAULT_END
    for (const k of keys) {
      for (const l of activeLessonsByDay.get(k) ?? []) {
        const { range } = lessonLocalRange(l, timezone)
        s = Math.min(s, Math.floor(range[0] / 60) * 60)
        e = Math.max(e, Math.min(1440, Math.ceil(range[1] / 60) * 60))
      }
    }
    return { gridStart: s, gridEnd: e }
  }, [keys, activeLessonsByDay, timezone])

  const height = (gridEnd - gridStart) * PX
  const hours = useMemo(() => {
    const out: number[] = []
    for (let m = gridStart; m < gridEnd; m += 60) out.push(m)
    return out
  }, [gridStart, gridEnd])

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = (7 * 60 - gridStart) * PX
  }, [gridStart])

  const drag = useDragSelect<Point>({
    ignore: '[data-lesson]',
    resolve: (x, y) => {
      const col = (
        document.elementFromPoint(x, y) as HTMLElement | null
      )?.closest<HTMLElement>('[data-day]')
      if (!col?.dataset.day) return null
      const rect = col.getBoundingClientRect()
      return {
        dateKey: col.dataset.day,
        minute: minuteFromOffset(y - rect.top, PX, gridStart),
      }
    },
    onCommit: (a, b) => {
      const [s, e] = selectMinutes(a.minute, b.minute, 15, gridStart, gridEnd)
      onSelectMinutes(a.dateKey, [s, Math.min(gridEnd, Math.max(e, s + 30))])
    },
  })

  const sel = drag.selection
  const selRange: Range | null = sel
    ? selectMinutes(sel.anchor.minute, sel.current.minute, 15, gridStart, gridEnd)
    : null

  const now = localParts(new Date(), timezone)

  return (
    <div className="space-y-2">
      {/* Celular: um dia por vez, com seletor de dia. */}
      <div
        role="group"
        aria-label="Escolher dia da semana"
        className="grid grid-cols-7 gap-1 md:hidden"
      >
        {keys.map((k) => {
          const status = days.get(k)?.status ?? 'nao_configurado'
          const { Icon, chip } = STATUS_VISUAL[status]
          return (
            <button
              key={k}
              type="button"
              aria-pressed={k === date}
              aria-label={daySummary(k, status, activeLessonsByDay.get(k)?.length ?? 0)}
              onClick={() => onFocusDate(k)}
              className={cn(
                'flex flex-col items-center gap-0.5 rounded-lg border py-1.5 text-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/60',
                k === date ? 'border-primary bg-lavender font-semibold' : 'bg-card',
              )}
            >
              <span className="text-muted-foreground uppercase">{weekdayShort(k)}</span>
              <span
                className={cn(
                  'inline-flex size-6 items-center justify-center rounded-full text-sm font-semibold',
                  k === todayKey && 'bg-primary text-primary-foreground',
                )}
              >
                {dayOfMonth(k)}
              </span>
              <span aria-hidden="true" className={cn('rounded p-0.5', chip)}>
                <Icon className="size-3" />
              </span>
            </button>
          )
        })}
      </div>

      <div
        ref={scrollRef}
        className="max-h-[68vh] overflow-auto rounded-xl border bg-card"
      >
        {/* Cabeçalho (desktop) */}
        <div className="sticky top-0 z-20 hidden grid-cols-[3.25rem_repeat(7,minmax(0,1fr))] border-b bg-card md:grid">
          <div />
          {keys.map((k) => {
            const status = days.get(k)?.status ?? 'nao_configurado'
            const { Icon, chip } = STATUS_VISUAL[status]
            return (
              <button
                key={k}
                type="button"
                onClick={() => onOpenDay(k)}
                aria-label={`${daySummary(k, status, activeLessonsByDay.get(k)?.length ?? 0)}. Abrir o dia`}
                className="flex flex-col items-center gap-0.5 border-l py-1.5 text-xs outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/60 focus-visible:ring-inset"
              >
                <span className="text-muted-foreground uppercase">{weekdayShort(k)}</span>
                <span
                  className={cn(
                    'inline-flex size-7 items-center justify-center rounded-full text-sm font-semibold',
                    k === todayKey && 'bg-primary text-primary-foreground',
                  )}
                >
                  {dayOfMonth(k)}
                </span>
                <span
                  aria-hidden="true"
                  className={cn(
                    'inline-flex items-center gap-1 rounded px-1.5 py-0.5',
                    chip,
                  )}
                >
                  <Icon className="size-3" />
                  {STATUS_LABEL[status].short}
                </span>
              </button>
            )
          })}
        </div>

        <div
          ref={drag.bindContainer}
          {...drag.handlers}
          className="mt-3 grid grid-cols-[3.25rem_minmax(0,1fr)] select-none md:grid-cols-[3.25rem_repeat(7,minmax(0,1fr))]"
          style={{ height }}
        >
          <div className="relative" aria-hidden="true">
            {hours.map((m) => (
              <span
                key={m}
                className="absolute right-1.5 -translate-y-1/2 text-[11px] text-muted-foreground"
                style={{ top: (m - gridStart) * PX }}
              >
                {minuteToTime(m)}
              </span>
            ))}
          </div>
          {keys.map((k) => (
            <DayColumn
              key={k}
              dateKey={k}
              hiddenOnMobile={k !== date}
              isToday={k === todayKey}
              nowMinute={k === now.dateKey ? now.minute : null}
              day={days.get(k)}
              lessons={activeLessonsByDay.get(k) ?? []}
              timezone={timezone}
              gridStart={gridStart}
              gridEnd={gridEnd}
              selRange={sel && sel.anchor.dateKey === k ? selRange : null}
              onSelectLesson={onSelectLesson}
            />
          ))}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Arraste sobre horas vazias (no celular: toque longo e arraste) para bloquear um
        horário ou adicionar um horário extra.
      </p>
    </div>
  )
}

function DayColumn({
  dateKey,
  hiddenOnMobile,
  isToday,
  nowMinute,
  day,
  lessons,
  timezone,
  gridStart,
  gridEnd,
  selRange,
  onSelectLesson,
}: {
  dateKey: string
  hiddenOnMobile: boolean
  isToday: boolean
  nowMinute: number | null
  day: EffectiveDay | undefined
  lessons: LessonWithStudent[]
  timezone: string
  gridStart: number
  gridEnd: number
  selRange: Range | null
  onSelectLesson: (l: LessonWithStudent) => void
}) {
  const top = (m: number) => (Math.max(gridStart, Math.min(gridEnd, m)) - gridStart) * PX
  const items = useMemo(
    () =>
      lessons.map((l) => {
        const { range } = lessonLocalRange(l, timezone)
        return { lesson: l, id: l.id, start: range[0], end: range[1] }
      }),
    [lessons, timezone],
  )
  const layout = useMemo(() => layoutOverlaps(items), [items])
  const closed = day ? CLOSED.has(day.status) : false
  const blocks = (day?.exceptions ?? []).flatMap((x) =>
    x.kind === 'bloqueio' && x.start_time && x.end_time
      ? [{ id: x.id, r: [timeToMinute(x.start_time), timeToMinute(x.end_time)] as Range }]
      : [],
  )
  const ClosedIcon = day ? STATUS_VISUAL[day.status].Icon : Ban

  return (
    <div
      data-day={dateKey}
      className={cn(
        'relative border-l',
        hiddenOnMobile ? 'hidden md:block' : 'block',
        isToday && 'bg-primary/[0.03]',
      )}
      style={{
        backgroundImage: `repeating-linear-gradient(to bottom, transparent 0, transparent ${ROW - 1}px, var(--border) ${ROW - 1}px, var(--border) ${ROW}px)`,
        backgroundSize: `100% ${ROW}px`,
      }}
    >
      {(day?.ranges ?? []).map((r, i) => (
        <div
          key={i}
          aria-hidden="true"
          className="absolute inset-x-0 bg-sage/60"
          style={{ top: top(r[0]), height: Math.max(0, top(r[1]) - top(r[0])) }}
          title={`Disponível ${rangeLabel(r)}`}
        />
      ))}
      {closed ? (
        <div
          className="absolute inset-0 z-[1] flex items-start justify-center bg-card/50 pt-2"
          style={HATCH_STYLE}
        >
          <span className="inline-flex items-center gap-1 rounded-md bg-card/90 px-1.5 py-0.5 text-[11px] font-medium shadow-xs">
            <ClosedIcon aria-hidden="true" className="size-3" />
            {day ? STATUS_LABEL[day.status].label : ''}
          </span>
        </div>
      ) : null}
      {blocks.map((b) => (
        <div
          key={b.id}
          className="absolute inset-x-0 z-[1] flex items-start border-y border-peach-text/30"
          style={{
            ...HATCH_STYLE,
            top: top(b.r[0]),
            height: Math.max(0, top(b.r[1]) - top(b.r[0])),
          }}
          title={`Bloqueado ${rangeLabel(b.r)}`}
        >
          <span className="m-0.5 inline-flex items-center gap-1 rounded bg-card/90 px-1 text-[10px] font-medium text-peach-text">
            <Ban aria-hidden="true" className="size-3" />
            Bloqueio
          </span>
        </div>
      ))}
      {selRange ? (
        <div
          className="pointer-events-none absolute inset-x-0.5 z-10 rounded-md border-2 border-primary bg-primary/20 text-[11px] font-semibold text-primary"
          style={{ top: top(selRange[0]), height: top(selRange[1]) - top(selRange[0]) }}
        >
          <span className="px-1">{rangeLabel(selRange)}</span>
        </div>
      ) : null}
      {nowMinute !== null && nowMinute >= gridStart && nowMinute <= gridEnd ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 z-10 h-0.5 bg-destructive"
          style={{ top: top(nowMinute) }}
        />
      ) : null}
      {items.map((it) => {
        const pos = layout.find((p) => p.id === it.id)
        const col = pos?.col ?? 0
        const cols = pos?.cols ?? 1
        const l = it.lesson
        const h = Math.max(24, top(it.end) - top(it.start))
        const name = l.student?.full_name ?? 'Aluno'
        const time = formatTime(l.starts_at, timezone)
        return (
          <button
            key={l.id}
            type="button"
            data-lesson
            onClick={() => onSelectLesson(l)}
            aria-label={`Aula de ${name}, ${time}, ${l.duration_minutes} minutos. Abrir ações`}
            className={cn(
              'absolute z-10 overflow-hidden rounded-md border px-1.5 py-0.5 text-left text-xs shadow-xs outline-none hover:brightness-95 focus-visible:ring-[3px] focus-visible:ring-ring/60',
              CARD_TONE[l.status] ?? 'border-primary/40 bg-lavender text-foreground',
            )}
            style={{
              top: top(it.start),
              height: h,
              left: `calc(${(col / cols) * 100}% + 1px)`,
              width: `calc(${100 / cols}% - 2px)`,
            }}
          >
            <span className="block truncate font-semibold">{name}</span>
            <span className="block truncate text-[11px] opacity-80">{time}</span>
            {h >= 62 ? <TeacherStatusBadge status={l.status} /> : null}
          </button>
        )
      })}
    </div>
  )
}
