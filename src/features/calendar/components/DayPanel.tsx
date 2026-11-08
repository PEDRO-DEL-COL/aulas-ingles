import { Ban, CalendarOff, Plus, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'

import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Input, Label } from '@/components/ui/field'
import { TeacherStatusBadge } from '@/features/professora/components/TeacherStatusBadge'
import type { LessonWithStudent } from '@/features/professora/lessons'
import { formatTime } from '@/features/shared/datetime'
import { cn } from '@/lib/utils'

import {
  capitalize,
  fromInputTime,
  lessonCountLabel,
  longDayLabel,
  rangeLabel,
  rangesLabel,
  STATUS_LABEL,
  toInputTime,
  type DayChangeRequest,
} from '../calendarUi'
import {
  normalizeRanges,
  timeToMinute,
  type AvailabilityException,
  type EffectiveDay,
  type Range,
} from '../engine'
import { STATUS_VISUAL } from './statusVisual'

type Mode = 'main' | 'substituir' | 'extra' | 'bloqueio'

const KIND_LABEL: Record<AvailabilityException['kind'], string> = {
  fechado: 'Dia fechado',
  substituir: 'Horário só deste dia',
  extra: 'Horário extra',
  bloqueio: 'Bloqueio',
}

function exceptionText(x: AvailabilityException): string {
  const base = KIND_LABEL[x.kind]
  if (x.start_time === null || x.end_time === null) return base
  const r: Range = [timeToMinute(x.start_time), timeToMinute(x.end_time)]
  return `${base}: ${rangeLabel(r)}`
}

type Row = { start: string; end: string }

/** Painel do dia: status, faixas, exceções, aulas e ações. Monte com `key={dateKey}`. */
export function DayPanel({
  open,
  dateKey,
  day,
  lessons,
  timezone,
  busy,
  onClose,
  onRequest,
  onSelectLesson,
  onOpenHolidays,
  onOpenVacation,
  onNewLesson,
}: {
  open: boolean
  dateKey: string
  day: EffectiveDay
  lessons: LessonWithStudent[]
  timezone: string
  busy: boolean
  onClose: () => void
  onRequest: (req: DayChangeRequest) => void
  onSelectLesson: (l: LessonWithStudent) => void
  onOpenHolidays: () => void
  onOpenVacation: (day: string) => void
  onNewLesson: (day: string) => void
}) {
  const [mode, setMode] = useState<Mode>('main')
  const [rows, setRows] = useState<Row[]>([])
  const [one, setOne] = useState<Row>({ start: '09:00', end: '10:00' })
  const [error, setError] = useState<string | null>(null)
  const title = capitalize(longDayLabel(dateKey))
  const { Icon, chip } = STATUS_VISUAL[day.status]
  const closedByException = day.exceptions.some((e) => e.kind === 'fechado')
  const blockedByPeriod = day.blocked !== null
  const allIds = useMemo(() => day.exceptions.map((e) => e.id), [day.exceptions])
  const label = longDayLabel(dateKey).split(', ')[1] ?? dateKey

  function start(next: Mode) {
    setError(null)
    if (next === 'substituir') {
      const base = day.ranges.length > 0 ? day.ranges : ([[540, 720]] as Range[])
      setRows(base.map(([s, e]) => ({ start: toInputTime(s), end: toInputTime(e) })))
    }
    if (next === 'extra') setOne({ start: '18:00', end: '19:00' })
    if (next === 'bloqueio') setOne({ start: '12:00', end: '13:00' })
    setMode(next)
  }

  function validRange(r: Row): Range | null {
    const s = timeToMinute(fromInputTime(r.start))
    const e = timeToMinute(fromInputTime(r.end))
    return Number.isFinite(s) && Number.isFinite(e) && e > s ? [s, e] : null
  }

  function submitReplace() {
    const parsed = rows.map(validRange)
    if (parsed.some((p) => p === null)) {
      setError('Confira os horários: o fim deve ser depois do início.')
      return
    }
    const ranges = normalizeRanges(parsed as Range[])
    if (ranges.length === 0) {
      setError('Informe ao menos uma faixa, ou use "Fechar o dia".')
      return
    }
    onRequest({
      dateKey,
      removeIds: allIds,
      add: ranges.map(([s, e]) => ({
        kind: 'substituir',
        start_time: fromInputTime(toInputTime(s)),
        end_time: e >= 1440 ? '24:00' : toInputTime(e),
      })),
      title: `Mudar o horário de ${label}`,
      done: `Horário de ${label} alterado: ${rangesLabel(ranges)}.`,
    })
  }

  function submitOne(kind: 'extra' | 'bloqueio') {
    const r = validRange(one)
    if (!r) {
      setError('O fim deve ser depois do início.')
      return
    }
    onRequest({
      dateKey,
      removeIds: [],
      add: [
        {
          kind,
          start_time: fromInputTime(one.start),
          end_time: fromInputTime(one.end),
        },
      ],
      title:
        kind === 'bloqueio'
          ? `Bloquear ${rangeLabel(r)} em ${label}`
          : `Adicionar horário extra em ${label}`,
      done:
        kind === 'bloqueio'
          ? `Bloqueado ${rangeLabel(r)} em ${label}.`
          : `Horário extra ${rangeLabel(r)} adicionado em ${label}.`,
    })
  }

  return (
    <Dialog open={open} onClose={onClose} title={title} className="max-w-lg">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold',
            chip,
          )}
        >
          <Icon aria-hidden="true" className="size-3" />
          {STATUS_LABEL[day.status].label}
        </span>
        <span className="text-muted-foreground">{lessonCountLabel(lessons.length)}</span>
      </div>

      {error ? <Alert variant="destructive">{error}</Alert> : null}

      {mode === 'main' ? (
        <>
          <section aria-label="Faixas do dia" className="space-y-1">
            <h3 className="text-sm font-semibold">Faixas de atendimento</h3>
            {blockedByPeriod ? (
              <p className="text-sm text-muted-foreground">
                {day.status === 'feriado' ? 'Feriado' : 'Período bloqueado (férias)'}
                {day.blocked?.reason
                  ? `: ${day.blocked.reason.replace(/^Feriado: /, '')}`
                  : ''}
                . Para mudar, use {day.status === 'feriado' ? '"Feriados"' : '"Férias"'}.
              </p>
            ) : (
              <p className="text-sm">
                {closedByException
                  ? 'Dia fechado: sem atendimento.'
                  : rangesLabel(day.ranges)}
              </p>
            )}
          </section>

          {day.exceptions.length > 0 ? (
            <section aria-label="Exceções do dia" className="space-y-1">
              <h3 className="text-sm font-semibold">Ajustes deste dia</h3>
              <ul className="space-y-1">
                {day.exceptions.map((x) => (
                  <li
                    key={x.id}
                    className="flex items-center justify-between gap-2 rounded-lg border bg-muted/40 px-3 py-1.5 text-sm"
                  >
                    <span>{exceptionText(x)}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={busy}
                      aria-label={`Remover: ${exceptionText(x)}`}
                      onClick={() =>
                        onRequest({
                          dateKey,
                          add: [],
                          removeIds: [x.id],
                          title: `Remover ajuste de ${label}`,
                          done: 'Ajuste removido.',
                        })
                      }
                    >
                      <Trash2 aria-hidden="true" />
                      Remover
                    </Button>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section aria-label="Aulas do dia" className="space-y-1">
            <h3 className="text-sm font-semibold">Aulas</h3>
            {lessons.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma aula neste dia.</p>
            ) : (
              <ul className="space-y-1">
                {lessons.map((l) => (
                  <li key={l.id}>
                    <button
                      type="button"
                      onClick={() => {
                        onClose()
                        onSelectLesson(l)
                      }}
                      className="flex w-full items-center justify-between gap-2 rounded-lg border bg-card px-3 py-2 text-left text-sm outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50"
                    >
                      <span className="min-w-0 truncate">
                        <strong>{formatTime(l.starts_at, timezone)}</strong>{' '}
                        {l.student?.full_name ?? 'Aluno'}
                      </span>
                      <TeacherStatusBadge status={l.status} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-label="Ações do dia" className="grid gap-2 sm:grid-cols-2">
            {blockedByPeriod ? (
              <>
                <Button
                  variant="outline"
                  onClick={() => {
                    onClose()
                    if (day.status === 'feriado') onOpenHolidays()
                    else onOpenVacation(dateKey)
                  }}
                >
                  <CalendarOff aria-hidden="true" />
                  {day.status === 'feriado' ? 'Abrir feriados' : 'Abrir férias'}
                </Button>
              </>
            ) : closedByException ? (
              <Button
                disabled={busy}
                onClick={() =>
                  onRequest({
                    dateKey,
                    add: [],
                    removeIds: day.exceptions
                      .filter((e) => e.kind === 'fechado')
                      .map((e) => e.id),
                    title: `Abrir ${label}`,
                    done: `Dia ${label} aberto.`,
                  })
                }
              >
                Abrir o dia
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() =>
                    onRequest({
                      dateKey,
                      add: [{ kind: 'fechado' }],
                      removeIds: [],
                      title: `Fechar ${label}`,
                      done: `Dia ${label} fechado.`,
                    })
                  }
                >
                  <Ban aria-hidden="true" />
                  Fechar o dia
                </Button>
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => start('substituir')}
                >
                  Mudar horário só deste dia
                </Button>
                <Button variant="outline" disabled={busy} onClick={() => start('extra')}>
                  <Plus aria-hidden="true" />
                  Adicionar horário extra
                </Button>
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => start('bloqueio')}
                >
                  Bloquear intervalo
                </Button>
              </>
            )}
            {day.exceptions.length > 1 && !blockedByPeriod ? (
              <Button
                variant="ghost"
                disabled={busy}
                onClick={() =>
                  onRequest({
                    dateKey,
                    add: [],
                    removeIds: allIds,
                    title: `Voltar ${label} ao horário padrão`,
                    done: `${label} voltou ao horário padrão.`,
                  })
                }
              >
                Voltar ao horário padrão
              </Button>
            ) : null}
          </section>

          <div className="flex flex-wrap justify-end gap-2">
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => onNewLesson(dateKey)}
            >
              <Plus aria-hidden="true" />
              Nova aula neste dia
            </Button>
            <Button variant="ghost" onClick={onClose}>
              Fechar
            </Button>
          </div>
        </>
      ) : mode === 'substituir' ? (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault()
            submitReplace()
          }}
        >
          <p className="text-sm text-muted-foreground">
            Define as faixas só de {label}. Substitui o horário padrão e os outros ajustes
            deste dia.
          </p>
          {rows.map((r, i) => (
            <div key={i} className="flex items-end gap-2">
              <div className="flex-1 space-y-1">
                <Label htmlFor={`sub-ini-${i}`}>Início</Label>
                <Input
                  id={`sub-ini-${i}`}
                  type="time"
                  step={900}
                  value={r.start}
                  onChange={(e) =>
                    setRows(
                      rows.map((x, j) => (j === i ? { ...x, start: e.target.value } : x)),
                    )
                  }
                />
              </div>
              <div className="flex-1 space-y-1">
                <Label htmlFor={`sub-fim-${i}`}>Fim</Label>
                <Input
                  id={`sub-fim-${i}`}
                  type="time"
                  step={900}
                  value={r.end}
                  onChange={(e) =>
                    setRows(
                      rows.map((x, j) => (j === i ? { ...x, end: e.target.value } : x)),
                    )
                  }
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Remover faixa ${i + 1}`}
                disabled={rows.length === 1}
                onClick={() => setRows(rows.filter((_, j) => j !== i))}
              >
                <Trash2 aria-hidden="true" />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setRows([...rows, { start: '14:00', end: '18:00' }])}
          >
            <Plus aria-hidden="true" />
            Adicionar faixa
          </Button>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setMode('main')}>
              Voltar
            </Button>
            <Button type="submit" disabled={busy}>
              Aplicar
            </Button>
          </div>
        </form>
      ) : (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault()
            submitOne(mode)
          }}
        >
          <p className="text-sm text-muted-foreground">
            {mode === 'bloqueio'
              ? `Bloqueia um intervalo só em ${label}.`
              : `Libera um horário a mais só em ${label}.`}
          </p>
          <div className="flex items-end gap-2">
            <div className="flex-1 space-y-1">
              <Label htmlFor="one-ini">Início</Label>
              <Input
                id="one-ini"
                type="time"
                step={900}
                value={one.start}
                onChange={(e) => setOne({ ...one, start: e.target.value })}
              />
            </div>
            <div className="flex-1 space-y-1">
              <Label htmlFor="one-fim">Fim</Label>
              <Input
                id="one-fim"
                type="time"
                step={900}
                value={one.end}
                onChange={(e) => setOne({ ...one, end: e.target.value })}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setMode('main')}>
              Voltar
            </Button>
            <Button type="submit" disabled={busy}>
              {mode === 'bloqueio' ? 'Bloquear' : 'Adicionar'}
            </Button>
          </div>
        </form>
      )}
    </Dialog>
  )
}
