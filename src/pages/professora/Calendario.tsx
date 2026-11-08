import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'

import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { LessonActionsDialog } from '@/features/professora/components/LessonActionsDialog'
import { groupByDay, type LessonWithStudent } from '@/features/professora/lessons'
import { ErrorState } from '@/features/shared/components/StateViews'
import { dayKey } from '@/features/shared/datetime'
import { friendlyError } from '@/features/shared/errors'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'

import { cancelLessonsByTeacher } from '@/features/calendar/api'
import {
  fetchWindow,
  removedByChange,
  serializeCalendarParams,
  shiftDate,
  parseCalendarParams,
  visibleKeys,
  type CalendarView,
  type DayChangeRequest,
} from '@/features/calendar/calendarUi'
import { CalendarLegend } from '@/features/calendar/components/CalendarLegend'
import { CalendarToolbar } from '@/features/calendar/components/CalendarToolbar'
import { ConflictDialog } from '@/features/calendar/components/ConflictDialog'
import type { ConflictAction, DateRange } from '@/features/calendar/components/contracts'
import { DayPanel } from '@/features/calendar/components/DayPanel'
import { DayView } from '@/features/calendar/components/DayView'
import { GenerateLessonsDialog } from '@/features/calendar/components/GenerateLessonsDialog'
import { HolidaysPanel } from '@/features/calendar/components/HolidaysPanel'
import { MonthView } from '@/features/calendar/components/MonthView'
import { NewLessonDialog } from '@/features/calendar/components/NewLessonDialog'
import { NoPatternAlert } from '@/features/calendar/components/NoPatternAlert'
import { PatternWizard } from '@/features/calendar/components/PatternWizard'
import { RangeMenuDialog } from '@/features/calendar/components/RangeMenuDialog'
import { UndoToast, type ToastState } from '@/features/calendar/components/UndoToast'
import { VacationDialog } from '@/features/calendar/components/VacationDialog'
import { WeekView } from '@/features/calendar/components/WeekView'
import {
  affectedLessons,
  effectiveDay,
  hasActivePattern,
  minuteToTime,
  type AvailabilityException,
  type EffectiveDay,
  type Range,
} from '@/features/calendar/engine'
import { useCalendarData } from '@/features/calendar/useCalendarData'
import { useTimezone } from '@/features/professora/useTimezone'

const isCancelled = (l: LessonWithStudent) =>
  l.status === 'cancelada_aluno' || l.status === 'cancelada_professora'

const EMPTY_AVAILABILITY = { patterns: [], slots: [], exceptions: [], blocked: [] }

export default function Calendario() {
  useDocumentTitle('Calendário')
  const profileTz = useTimezone()
  const [search, setSearch] = useSearchParams()
  const [mobile] = useState(
    () =>
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(max-width: 767px)').matches,
  )

  const todayProfile = dayKey(new Date(), profileTz)
  const params = parseCalendarParams(search, todayProfile, mobile ? 'dia' : 'mes')
  const { view, date } = params

  const win = fetchWindow(view, date)
  const cal = useCalendarData(win.from, win.to)
  const timezone = cal.timezone
  const todayKey = dayKey(new Date(), timezone)
  const availability = cal.data?.availability ?? EMPTY_AVAILABILITY
  const lessons = useMemo(() => cal.data?.lessons ?? [], [cal.data?.lessons])

  // UI
  const [dayOpen, setDayOpen] = useState<string | null>(null)
  const [selectedLesson, setSelectedLesson] = useState<LessonWithStudent | null>(null)
  const [patternOpen, setPatternOpen] = useState(params.panel === 'horario')
  const [holidaysOpen, setHolidaysOpen] = useState(params.panel === 'feriados')
  const [vacation, setVacation] = useState<{ range: DateRange | null } | null>(null)
  const [generateOpen, setGenerateOpen] = useState(false)
  const [newLesson, setNewLesson] = useState<{ date: string } | null>(null)
  const [rangeSel, setRangeSel] = useState<{ dateKey: string; range: Range } | null>(null)
  const [pending, setPending] = useState<{
    req: DayChangeRequest
    affected: LessonWithStudent[]
  } | null>(null)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<ToastState | null>(null)
  const toastId = useRef(0)

  // Remove ?painel= depois de aberto (só reescreve a URL; o estado já foi lido acima).
  const hasPanelParam = params.panel !== null
  useEffect(() => {
    if (hasPanelParam) setSearch(serializeCalendarParams(view, date), { replace: true })
  }, [hasPanelParam, view, date, setSearch])

  const go = useCallback(
    (nextView: CalendarView, nextDate: string, replace = false) => {
      setSearch(serializeCalendarParams(nextView, nextDate), { replace })
    },
    [setSearch],
  )

  const showToast = useCallback((t: Omit<ToastState, 'id'>) => {
    toastId.current += 1
    setToast({ ...t, id: toastId.current })
  }, [])
  const dismissToast = useCallback(() => setToast(null), [])

  // Dados derivados (só o período visível).
  const days = useMemo(() => {
    const map = new Map<string, EffectiveDay>()
    for (const k of visibleKeys(view, date)) map.set(k, effectiveDay(k, availability))
    return map
  }, [view, date, availability])

  const { lessonsByDay, activeLessonsByDay } = useMemo(() => {
    const all = new Map<string, LessonWithStudent[]>()
    const active = new Map<string, LessonWithStudent[]>()
    for (const g of groupByDay(lessons, timezone)) {
      all.set(g.key, g.items)
      active.set(
        g.key,
        g.items.filter((l) => !isCancelled(l)),
      )
    }
    return { lessonsByDay: all, activeLessonsByDay: active }
  }, [lessons, timezone])

  const panelDay = useMemo(
    () => (dayOpen ? effectiveDay(dayOpen, availability) : null),
    [dayOpen, availability],
  )
  const selectedDay = days.get(date) ?? effectiveDay(date, availability)

  // ---------------------------------------------------------------- mudanças

  const apply = useCallback(
    async (
      req: DayChangeRequest,
      action: Exclude<ConflictAction, 'desfazer'>,
      affected: LessonWithStudent[],
    ) => {
      setBusy(true)
      try {
        const removedRows = availability.exceptions.filter((e) =>
          req.removeIds.includes(e.id),
        )
        // Cria primeiro e remove depois: se algo falhar, o dia nunca fica sem regra.
        const created: AvailabilityException[] = []
        for (const d of req.add) {
          created.push(await cal.createException({ on_date: req.dateKey, ...d }))
        }
        for (const id of req.removeIds) await cal.removeException(id)

        let message = req.done
        let tone: ToastState['tone'] = 'default'
        if (action === 'cancelar' && affected.length > 0) {
          const out = await cancelLessonsByTeacher(
            affected.map((l) => l.id),
            'Horário da professora alterado',
          )
          cal.refetch()
          message += ` ${out.succeeded.length} ${out.succeeded.length === 1 ? 'aula cancelada' : 'aulas canceladas'}.`
          if (out.failed.length > 0) {
            tone = 'error'
            message += ` ${out.failed.length} não ${out.failed.length === 1 ? 'pôde ser cancelada' : 'puderam ser canceladas'}: ${out.failed[0]?.message ?? ''}`
          }
        }

        showToast({
          message,
          tone,
          actionLabel: 'Desfazer',
          onAction: () => {
            void (async () => {
              try {
                for (const c of created) await cal.removeException(c.id)
                for (const r of removedRows) {
                  await cal.createException({
                    on_date: r.on_date,
                    kind: r.kind,
                    start_time: r.start_time,
                    end_time: r.end_time,
                    reason: r.reason,
                  })
                }
                showToast({ message: 'Alteração desfeita.' })
              } catch (e) {
                cal.refetch()
                showToast({ message: friendlyError(e), tone: 'error' })
              }
            })()
          },
        })
        setDayOpen(null)
        setRangeSel(null)
      } catch (e) {
        cal.refetch()
        showToast({ message: friendlyError(e), tone: 'error' })
      } finally {
        setBusy(false)
      }
    },
    [availability.exceptions, cal, showToast],
  )

  const request = useCallback(
    (req: DayChangeRequest) => {
      const removed = removedByChange(availability, req.dateKey, req.add, req.removeIds)
      const hit =
        removed === 'all' || removed.length > 0
          ? affectedLessons(lessons, req.dateKey, removed, timezone)
          : []
      if (hit.length > 0) setPending({ req, affected: hit })
      else void apply(req, 'manter', [])
    },
    [availability, lessons, timezone, apply],
  )

  async function resolveConflict(action: ConflictAction) {
    const p = pending
    if (!p) return
    if (action === 'desfazer') {
      setPending(null)
      return
    }
    await apply(p.req, action, p.affected)
    setPending(null)
  }

  function chooseRange(kind: 'bloqueio' | 'extra') {
    if (!rangeSel) return
    const [s, e] = rangeSel.range
    const text = `${minuteToTime(s)}–${minuteToTime(e)}`
    request({
      dateKey: rangeSel.dateKey,
      removeIds: [],
      add: [{ kind, start_time: minuteToTime(s), end_time: minuteToTime(e) }],
      title: kind === 'bloqueio' ? `Bloquear ${text}` : `Adicionar horário extra ${text}`,
      done:
        kind === 'bloqueio'
          ? `Horário ${text} bloqueado.`
          : `Horário extra ${text} adicionado.`,
    })
  }

  const activePattern = availability.patterns.find((p) => p.active)
  const year = Number(date.slice(0, 4))

  return (
    <div className="space-y-4">
      <CalendarToolbar
        view={view}
        date={date}
        refreshing={cal.refreshing && !cal.initialLoading}
        onView={(v) => go(v, date)}
        onToday={() => go(view, todayKey)}
        onShift={(dir) => go(view, shiftDate(view, date, dir))}
        onDate={(k) => go(view, k)}
        onPattern={() => setPatternOpen(true)}
        onHolidays={() => setHolidaysOpen(true)}
        onVacation={() => setVacation({ range: null })}
        onGenerate={() => setGenerateOpen(true)}
        onNewLesson={() => setNewLesson({ date })}
      />

      {cal.data && !hasActivePattern(availability) ? (
        <NoPatternAlert onDefine={() => setPatternOpen(true)} />
      ) : null}

      {cal.error && cal.data ? (
        <Alert
          variant="warning"
          className="flex flex-wrap items-center justify-between gap-2"
        >
          <span>
            Não foi possível atualizar. Os dados abaixo podem estar desatualizados.
          </span>
          <Button size="sm" variant="outline" onClick={cal.refetch}>
            Tentar de novo
          </Button>
        </Alert>
      ) : null}

      {cal.error && !cal.data ? (
        <ErrorState error={cal.error} onRetry={cal.refetch} />
      ) : cal.initialLoading ? (
        <div role="status" aria-live="polite">
          <span className="sr-only">Carregando calendário…</span>
          <Skeleton className="h-[28rem] w-full rounded-xl" />
        </div>
      ) : (
        <>
          {view === 'mes' ? (
            <MonthView
              date={date}
              todayKey={todayKey}
              days={days}
              activeLessonsByDay={activeLessonsByDay}
              onOpenDay={setDayOpen}
              onFocusDate={(k) => go('mes', k, true)}
              onSelectRange={(from, to) => setVacation({ range: { from, to } })}
            />
          ) : view === 'semana' ? (
            <WeekView
              date={date}
              todayKey={todayKey}
              timezone={timezone}
              days={days}
              activeLessonsByDay={activeLessonsByDay}
              onSelectLesson={setSelectedLesson}
              onOpenDay={setDayOpen}
              onFocusDate={(k) => go('semana', k, true)}
              onSelectMinutes={(dateKey, range) => setRangeSel({ dateKey, range })}
            />
          ) : (
            <DayView
              dateKey={date}
              day={selectedDay}
              lessons={lessonsByDay.get(date) ?? []}
              timezone={timezone}
              onSelectLesson={setSelectedLesson}
              onOpenPanel={() => setDayOpen(date)}
            />
          )}

          <CalendarLegend view={view} />
        </>
      )}

      {dayOpen && panelDay ? (
        <DayPanel
          key={dayOpen}
          open
          dateKey={dayOpen}
          day={panelDay}
          lessons={lessonsByDay.get(dayOpen) ?? []}
          timezone={timezone}
          busy={busy}
          onClose={() => setDayOpen(null)}
          onRequest={request}
          onSelectLesson={setSelectedLesson}
          onOpenHolidays={() => setHolidaysOpen(true)}
          onOpenVacation={(k) => setVacation({ range: { from: k, to: k } })}
          onNewLesson={(k) => setNewLesson({ date: k })}
        />
      ) : null}

      <RangeMenuDialog
        selection={rangeSel}
        busy={busy}
        onClose={() => setRangeSel(null)}
        onChoose={chooseRange}
      />

      {selectedLesson ? (
        <LessonActionsDialog
          lesson={selectedLesson}
          hasMakeup={cal.data?.withMakeup.has(selectedLesson.id) ?? false}
          timezone={timezone}
          onClose={() => setSelectedLesson(null)}
          onChanged={cal.refetch}
        />
      ) : null}

      <ConflictDialog
        open={pending !== null}
        title={pending ? `Há aulas neste horário: ${pending.req.title}` : ''}
        description="Essas aulas ficam fora do novo horário. Mantenha-as, cancele-as (o aluno é avisado) ou desfaça a mudança."
        lessons={pending?.affected ?? []}
        timezone={timezone}
        busy={busy}
        onResolve={(a) => void resolveConflict(a)}
      />

      <PatternWizard
        open={patternOpen}
        onOpenChange={setPatternOpen}
        data={availability}
        timezone={timezone}
        patternId={activePattern?.id ?? null}
        onSaved={cal.refetch}
      />
      <HolidaysPanel
        open={holidaysOpen}
        onOpenChange={setHolidaysOpen}
        year={year}
        data={availability}
        timezone={timezone}
        onApplied={cal.refetch}
      />
      <VacationDialog
        open={vacation !== null}
        onOpenChange={(o) => {
          if (!o) setVacation(null)
        }}
        initialRange={vacation?.range ?? null}
        timezone={timezone}
        onSaved={() => {
          cal.refetch()
          showToast({ message: 'Período salvo.' })
        }}
      />
      {generateOpen ? (
        <GenerateLessonsDialog
          open
          timezone={timezone}
          referenceDate={date}
          onClose={() => setGenerateOpen(false)}
          onDone={(message) => {
            setGenerateOpen(false)
            cal.refetch()
            showToast({ message })
          }}
        />
      ) : null}
      {newLesson ? (
        <NewLessonDialog
          initialDate={newLesson.date}
          timezone={timezone}
          onClose={() => setNewLesson(null)}
          onCreated={(message) => {
            setNewLesson(null)
            cal.refetch()
            showToast({ message })
          }}
          onOpenDay={(k) => {
            setNewLesson(null)
            setDayOpen(k)
          }}
        />
      ) : null}

      <UndoToast toast={toast} onDismiss={dismissToast} />
    </div>
  )
}
