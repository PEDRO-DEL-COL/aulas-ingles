import { ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react'
import { useState } from 'react'

import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Label, Select } from '@/components/ui/field'
import { Skeleton } from '@/components/ui/skeleton'
import {
  generateLessons,
  listLessonsBetween,
  listMakeupOrigins,
} from '@/features/professora/api'
import { LessonActionsDialog } from '@/features/professora/components/LessonActionsDialog'
import { TeacherStatusBadge } from '@/features/professora/components/TeacherStatusBadge'
import {
  GENERATION_OPTIONS,
  generationMessage,
  generationRange,
  type GenerationScope,
} from '@/features/professora/generation'
import { groupByDay, type LessonWithStudent } from '@/features/professora/lessons'
import { addDaysKey, rangeUtc, weekDayKeys, weekStartKey } from '@/features/professora/tz'
import { useTimezone } from '@/features/professora/useTimezone'
import { EmptyState, ErrorState } from '@/features/shared/components/StateViews'
import {
  dayKey,
  formatDateOnly,
  formatDayLong,
  formatTime,
} from '@/features/shared/datetime'
import { friendlyError } from '@/features/shared/errors'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useQuery } from '@/lib/data/useQuery'

export default function Agenda() {
  useDocumentTitle('Agenda da semana')
  const timezone = useTimezone()
  const [startKey, setStartKey] = useState(() => weekStartKey(new Date(), timezone))
  const [selected, setSelected] = useState<LessonWithStudent | null>(null)
  const [generating, setGenerating] = useState(false)
  const [scope, setScope] = useState<GenerationScope>('4')
  const [genMessage, setGenMessage] = useState<{ ok: boolean; text: string } | null>(null)

  const endKey = addDaysKey(startKey, 6)
  const week = useQuery(`prof-semana:${startKey}:${timezone}`, async () => {
    const { start, end } = rangeUtc(startKey, endKey, timezone)
    const lessons = await listLessonsBetween(start, end)
    const cancelled = lessons
      .filter(
        (l) => l.status === 'cancelada_aluno' || l.status === 'cancelada_professora',
      )
      .map((l) => l.id)
    const withMakeup = await listMakeupOrigins(cancelled)
    return { lessons, withMakeup }
  })

  async function generate() {
    setGenerating(true)
    setGenMessage(null)
    try {
      const { from, to } = generationRange(scope, startKey, dayKey(new Date(), timezone))
      const n = await generateLessons(from, to)
      setGenMessage({ ok: true, text: generationMessage(scope, n) })
      week.refetch()
    } catch (e) {
      setGenMessage({ ok: false, text: friendlyError(e) })
    } finally {
      setGenerating(false)
    }
  }

  const days = weekDayKeys(startKey)
  const groups = new Map(
    groupByDay(week.data?.lessons ?? [], timezone).map((g) => [g.key, g.items]),
  )

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold">Agenda da semana</h1>
        <p className="text-muted-foreground">
          {formatDateOnly(startKey)} a {formatDateOnly(endKey)}
        </p>
      </header>

      <div className="flex items-center justify-between gap-2">
        <Button variant="outline" onClick={() => setStartKey(addDaysKey(startKey, -7))}>
          <ChevronLeft aria-hidden="true" />
          Anterior
        </Button>
        <Button
          variant="ghost"
          onClick={() => setStartKey(weekStartKey(new Date(), timezone))}
        >
          Hoje
        </Button>
        <Button variant="outline" onClick={() => setStartKey(addDaysKey(startKey, 7))}>
          Próxima
          <ChevronRight aria-hidden="true" />
        </Button>
      </div>

      <div className="space-y-2">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="space-y-1.5">
            <Label htmlFor="gerar-intervalo">Gerar aulas recorrentes</Label>
            <Select
              id="gerar-intervalo"
              value={scope}
              onChange={(e) => setScope(e.target.value as GenerationScope)}
              className="sm:w-56"
            >
              {GENERATION_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </div>
          <Button
            variant="secondary"
            disabled={generating}
            onClick={() => void generate()}
            className="w-full sm:w-auto"
          >
            <RefreshCw aria-hidden="true" className={generating ? 'animate-spin' : ''} />
            {generating ? 'Gerando…' : 'Gerar aulas'}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Usa os horários fixos dos alunos ativos e pula férias e feriados. Aulas já
          existentes não são duplicadas.
        </p>
        {genMessage ? (
          <Alert variant={genMessage.ok ? 'success' : 'destructive'}>
            {genMessage.text}
          </Alert>
        ) : null}
      </div>

      {week.error ? (
        <ErrorState error={week.error} onRetry={week.refetch} />
      ) : !week.data ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : week.data.lessons.length === 0 ? (
        <EmptyState title="Nenhuma aula nesta semana">
          Use &quot;Gerar aulas recorrentes&quot; para criar as aulas dos horários fixos.
        </EmptyState>
      ) : (
        <div className="space-y-4">
          {days.map((key) => {
            const items = groups.get(key)
            if (!items) return null
            return (
              <section key={key} aria-labelledby={`dia-${key}`}>
                <h2
                  id={`dia-${key}`}
                  className="mb-2 font-semibold first-letter:uppercase"
                >
                  {formatDayLong(`${key}T12:00:00Z`, 'UTC')}
                </h2>
                <ul className="space-y-2">
                  {items.map((l) => (
                    <li key={l.id}>
                      <button
                        type="button"
                        onClick={() => setSelected(l)}
                        className="flex w-full items-center justify-between gap-3 rounded-xl border bg-card p-3 text-left shadow-sm outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50"
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
                  ))}
                </ul>
              </section>
            )
          })}
        </div>
      )}

      {selected ? (
        <LessonActionsDialog
          lesson={selected}
          hasMakeup={week.data?.withMakeup.has(selected.id) ?? false}
          timezone={timezone}
          onClose={() => setSelected(null)}
          onChanged={week.refetch}
        />
      ) : null}
    </div>
  )
}
