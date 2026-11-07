import { Link } from 'react-router'

import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useQuery } from '@/lib/data/useQuery'
import { listLessonNotes, listLessons } from '@/features/aluno/api'
import { useAluno } from '@/features/aluno/AlunoContext'
import {
  EmptyState,
  ErrorState,
  ListSkeleton,
  PageHeader,
} from '@/features/shared/components/StateViews'
import { LessonStatusBadge } from '@/features/aluno/components/StatusBadges'
import { formatDateTime } from '@/features/shared/datetime'
import { isActiveStatus, lessonEnd, makeupText } from '@/features/aluno/lessons'
import { useNow } from '@/features/shared/useNow'

export default function Historico() {
  useDocumentTitle('Histórico')
  const { student, timezone } = useAluno()
  const now = useNow()
  const { data, error, loading, refetch } = useQuery(
    `historico:${student.id}`,
    async () => {
      const lessons = await listLessons(student.id)
      const past = lessons.filter((l) => lessonEnd(l).getTime() <= Date.now()).reverse()
      const notes = await listLessonNotes(past.map((l) => l.id))
      return { past, notes }
    },
  )

  return (
    <div>
      <PageHeader title="Histórico" description="Suas aulas anteriores." />
      {error ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : loading && !data ? (
        <ListSkeleton />
      ) : !data || data.past.length === 0 ? (
        <EmptyState title="Nenhuma aula no histórico ainda">
          Depois de cada aula, o resumo e a tarefa aparecem aqui.
        </EmptyState>
      ) : (
        <ul className="space-y-2">
          {data.past.map((l) => {
            const note = data.notes.get(l.id)
            const text = note?.summary || note?.content
            const extra = makeupText(l)
            return (
              <li key={l.id}>
                <Card className="gap-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold">
                      {formatDateTime(l.starts_at, timezone)}
                    </p>
                    {isActiveStatus(l.status) && lessonEnd(l) <= now ? (
                      <Badge tone="muted">Aguardando registro</Badge>
                    ) : (
                      <LessonStatusBadge status={l.status} />
                    )}
                  </div>
                  {text ? (
                    <p className="line-clamp-2 text-sm text-muted-foreground">{text}</p>
                  ) : null}
                  {note?.homework ? (
                    <p className="text-sm">
                      <span className="font-medium">Tarefa:</span>{' '}
                      <span className="line-clamp-2">{note.homework}</span>
                    </p>
                  ) : null}
                  {extra ? (
                    <p className="text-sm text-muted-foreground">{extra}</p>
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
      )}
    </div>
  )
}
