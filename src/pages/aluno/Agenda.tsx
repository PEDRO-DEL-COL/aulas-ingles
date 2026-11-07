import { useMemo, useState } from 'react'
import { Link } from 'react-router'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useQuery } from '@/lib/data/useQuery'
import { listLessons } from '@/features/aluno/api'
import { useAluno } from '@/features/aluno/AlunoContext'
import { CancelDialog } from '@/features/aluno/components/CancelDialog'
import {
  EmptyState,
  ErrorState,
  ListSkeleton,
  PageHeader,
} from '@/features/shared/components/StateViews'
import { useNow } from '@/features/shared/useNow'
import { LessonStatusBadge } from '@/features/aluno/components/StatusBadges'
import { dayKey, formatDayFull, formatTime } from '@/features/shared/datetime'
import {
  canStudentCancel,
  lessonEnd,
  makeupText,
  type Lesson,
} from '@/features/aluno/lessons'

export default function Agenda() {
  useDocumentTitle('Agenda')
  const { student, timezone } = useAluno()
  const { data, error, loading, refetch } = useQuery(`lessons:${student.id}`, () =>
    listLessons(student.id),
  )
  const [canceling, setCanceling] = useState<Lesson | null>(null)
  const now = useNow()

  const groups = useMemo(() => {
    const upcoming = (data ?? []).filter((l) => lessonEnd(l).getTime() > now.getTime())
    const map = new Map<string, Lesson[]>()
    for (const l of upcoming) {
      const key = dayKey(l.starts_at, timezone)
      map.set(key, [...(map.get(key) ?? []), l])
    }
    return [...map.entries()]
  }, [data, timezone, now])

  return (
    <div>
      <PageHeader title="Agenda" description="Suas próximas aulas." />
      {error ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : loading && !data ? (
        <ListSkeleton />
      ) : groups.length === 0 ? (
        <EmptyState title="Nenhuma aula agendada ainda">
          Quando a professora marcar suas aulas, elas aparecem aqui.
        </EmptyState>
      ) : (
        <div className="space-y-5">
          {groups.map(([key, lessons]) => (
            <section key={key} aria-labelledby={`dia-${key}`}>
              <h2
                id={`dia-${key}`}
                className="mb-2 text-sm font-semibold text-muted-foreground first-letter:uppercase"
              >
                {lessons[0] ? formatDayFull(lessons[0].starts_at, timezone) : key}
              </h2>
              <ul className="space-y-2">
                {lessons.map((l) => {
                  const note = makeupText(l)
                  return (
                    <li key={l.id}>
                      <Card className="gap-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-lg font-bold">
                            {formatTime(l.starts_at, timezone)}
                          </span>
                          <LessonStatusBadge status={l.status} />
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {l.duration_minutes} minutos
                          {note ? ` · ${note}` : ''}
                        </p>
                        {canStudentCancel(l, now) ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="self-start"
                            onClick={() => setCanceling(l)}
                          >
                            Cancelar aula
                          </Button>
                        ) : null}
                        <Link
                          to={`/app/aluno/aulas/${l.id}`}
                          className="self-start text-sm font-medium text-primary underline-offset-4 hover:underline"
                        >
                          Ver detalhes
                        </Link>
                      </Card>
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      {canceling ? (
        <CancelDialog
          lesson={canceling}
          onClose={() => setCanceling(null)}
          onDone={() => {
            setCanceling(null)
            refetch()
          }}
        />
      ) : null}
    </div>
  )
}
