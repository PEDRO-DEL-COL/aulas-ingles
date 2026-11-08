import { ClipboardPen, MessageCircle, Wallet } from 'lucide-react'
import { Link } from 'react-router'

import { Greeting } from '@/components/app/Greeting'
import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { hasActiveAvailabilityPattern } from '@/features/calendar/api'
import { NoPatternAlert } from '@/features/calendar/components/NoPatternAlert'
import { isActiveStatus, resolveMeetLink } from '@/features/aluno/lessons'
import {
  countOverdueInvoices,
  listLessonsBetween,
  listPendingDecisions,
} from '@/features/professora/api'
import { JoinButton } from '@/features/professora/components/JoinButton'
import { MakeupToScheduleList } from '@/features/professora/components/MakeupToScheduleList'
import { listMakeupsToSchedule } from '@/features/professora/makeupsApi'
import { MakeupDecisionCard } from '@/features/professora/components/MakeupDecisionCard'
import { TeacherStatusBadge } from '@/features/professora/components/TeacherStatusBadge'
import { reminderLink, type LessonWithStudent } from '@/features/professora/lessons'
import { rangeUtc } from '@/features/professora/tz'
import { useTimezone } from '@/features/professora/useTimezone'
import { dayKey, formatDayFull, formatTime } from '@/features/shared/datetime'
import { EmptyState, ErrorState } from '@/features/shared/components/StateViews'
import { useNow } from '@/features/shared/useNow'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useQuery } from '@/lib/data/useQuery'
import { cn } from '@/lib/utils'

function TodayLesson({
  lesson,
  now,
  timezone,
}: {
  lesson: LessonWithStudent
  now: Date
  timezone: string
}) {
  const active = isActiveStatus(lesson.status)
  const meet = resolveMeetLink(lesson, lesson.student)
  const wa = active ? reminderLink(lesson.student, lesson, meet, timezone) : null
  return (
    <li>
      <Card className={cn(!active && lesson.status !== 'realizada' && 'opacity-80')}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xl font-bold">{formatTime(lesson.starts_at, timezone)}</p>
            <p className="truncate font-semibold">
              {lesson.student?.full_name ?? 'Aluno'}
            </p>
            <p className="text-sm text-muted-foreground">{lesson.duration_minutes} min</p>
          </div>
          <TeacherStatusBadge status={lesson.status} />
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {active ? <JoinButton lesson={lesson} meetLink={meet} now={now} /> : null}
          <Button asChild variant="outline">
            <Link to={`/app/professora/aulas/${lesson.id}`}>
              <ClipboardPen aria-hidden="true" />
              Registrar aula
            </Link>
          </Button>
          {wa ? (
            <Button asChild variant="outline">
              <a href={wa} target="_blank" rel="noopener noreferrer">
                <MessageCircle aria-hidden="true" />
                Lembrete no WhatsApp
                <span className="sr-only"> (abre em nova aba)</span>
              </a>
            </Button>
          ) : null}
        </div>
        {active && !wa ? (
          <p className="text-xs text-muted-foreground">
            Sem telefone válido na ficha: não é possível enviar lembrete.
          </p>
        ) : null}
      </Card>
    </li>
  )
}

export default function Hoje() {
  useDocumentTitle('Hoje')
  const timezone = useTimezone()
  const now = useNow()
  const today = dayKey(now, timezone)

  const lessons = useQuery(`prof-hoje:${today}:${timezone}`, () => {
    const { start, end } = rangeUtc(today, today, timezone)
    return listLessonsBetween(start, end)
  })
  const pending = useQuery('prof-pendentes', listPendingDecisions)
  const toSchedule = useQuery('prof-repor-agendar', () => listMakeupsToSchedule())
  const overdue = useQuery('prof-atrasadas', countOverdueInvoices)
  const hasPattern = useQuery('prof-padrao-ativo', hasActiveAvailabilityPattern)

  return (
    <div className="space-y-5">
      <div>
        <Greeting />
        <p className="text-muted-foreground first-letter:uppercase">
          {formatDayFull(now, timezone)}
        </p>
      </div>

      {hasPattern.data === false ? <NoPatternAlert /> : null}

      <section aria-labelledby="hoje-aulas" className="space-y-3">
        <h2 id="hoje-aulas" className="text-lg font-semibold">
          Aulas de hoje
        </h2>
        {lessons.error ? (
          <ErrorState error={lessons.error} onRetry={lessons.refetch} />
        ) : !lessons.data ? (
          <Skeleton className="h-40 w-full rounded-xl" />
        ) : lessons.data.length === 0 ? (
          <EmptyState title="Nenhuma aula hoje">
            Veja a agenda da semana ou gere as aulas dos horários fixos.
          </EmptyState>
        ) : (
          <ul className="space-y-3">
            {lessons.data.map((l) => (
              <TodayLesson key={l.id} lesson={l} now={now} timezone={timezone} />
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="hoje-resumo" className="space-y-3">
        <h2 id="hoje-resumo" className="text-lg font-semibold">
          Pendências
        </h2>
        <Card>
          <CardTitle className="flex items-center gap-2">
            <Wallet aria-hidden="true" className="size-4" />
            Cobranças atrasadas
          </CardTitle>
          {overdue.error ? (
            <ErrorState error={overdue.error} onRetry={overdue.refetch} />
          ) : overdue.data === undefined ? (
            <Skeleton className="h-8 w-full" />
          ) : (
            <>
              <p className="text-2xl font-bold">{overdue.data}</p>
              <CardDescription>
                {overdue.data === 0
                  ? 'Nenhuma cobrança atrasada.'
                  : overdue.data === 1
                    ? 'cobrança atrasada.'
                    : 'cobranças atrasadas.'}
              </CardDescription>
            </>
          )}
          <Link
            to="/app/professora/financeiro"
            className="text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            Abrir o financeiro
          </Link>
        </Card>

        <h3 className="pt-1 font-semibold">Reposições a decidir</h3>
        {pending.error ? (
          <ErrorState error={pending.error} onRetry={pending.refetch} />
        ) : !pending.data ? (
          <Skeleton className="h-28 w-full rounded-xl" />
        ) : pending.data.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum cancelamento aguardando a sua decisão.
          </p>
        ) : (
          <ul className="space-y-3">
            {pending.data.map((l) => (
              <li key={l.id}>
                <MakeupDecisionCard
                  lesson={l}
                  timezone={timezone}
                  onDone={pending.refetch}
                />
              </li>
            ))}
          </ul>
        )}

        <h3 className="pt-1 font-semibold">Reposições a agendar</h3>
        {toSchedule.error ? (
          <ErrorState error={toSchedule.error} onRetry={toSchedule.refetch} />
        ) : !toSchedule.data ? (
          <Skeleton className="h-28 w-full rounded-xl" />
        ) : toSchedule.data.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma reposição esperando agendamento.
          </p>
        ) : (
          <MakeupToScheduleList
            lessons={toSchedule.data}
            timezone={timezone}
            onChanged={() => {
              toSchedule.refetch()
              lessons.refetch()
            }}
          />
        )}
      </section>
    </div>
  )
}
