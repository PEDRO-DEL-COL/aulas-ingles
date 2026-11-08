import { ArrowLeft } from 'lucide-react'
import { Link, useParams } from 'react-router'

import { Alert } from '@/components/ui/alert'
import { Card, CardTitle } from '@/components/ui/card'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useQuery } from '@/lib/data/useQuery'
import { getLesson } from '@/features/aluno/api'
import { useAluno } from '@/features/aluno/AlunoContext'
import {
  EmptyState,
  ErrorState,
  ListSkeleton,
} from '@/features/shared/components/StateViews'
import { LessonStatusBadge } from '@/features/aluno/components/StatusBadges'
import { MaterialItem } from '@/features/aluno/components/MaterialItem'
import { formatDateTime, formatDateTimeLong } from '@/features/shared/datetime'
import { makeupText } from '@/features/aluno/lessons'

function TextBlock({ title, text }: { title: string; text: string }) {
  return (
    <Card>
      <CardTitle>{title}</CardTitle>
      <p className="text-sm leading-relaxed whitespace-pre-line">{text}</p>
    </Card>
  )
}

export default function AulaDetalhe() {
  useDocumentTitle('Detalhe da aula')
  const { id = '' } = useParams()
  const { student, timezone } = useAluno()
  const { data, error, loading, refetch } = useQuery(`aula:${student.id}:${id}`, () =>
    getLesson(id, student.id),
  )

  return (
    <div className="space-y-4">
      <Link
        to="/app/aluno/historico"
        className="inline-flex items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline"
      >
        <ArrowLeft aria-hidden="true" className="size-4" /> Histórico
      </Link>

      {error ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : loading && data === undefined ? (
        <ListSkeleton />
      ) : !data ? (
        <EmptyState title="Aula não encontrada">
          Ela pode ter sido removida ou não pertencer à sua conta.
        </EmptyState>
      ) : (
        <>
          <header className="space-y-2">
            <h1 className="text-2xl font-bold first-letter:uppercase">
              {formatDateTimeLong(data.lesson.starts_at, timezone)}
            </h1>
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <LessonStatusBadge status={data.lesson.status} />
              <span>{data.lesson.duration_minutes} minutos</span>
            </div>
            {makeupText(data.lesson, data.makeup, (iso) =>
              formatDateTime(iso, timezone),
            ) ? (
              <p className="text-sm">
                {makeupText(data.lesson, data.makeup, (iso) =>
                  formatDateTime(iso, timezone),
                )}
              </p>
            ) : null}
            {data.lesson.cancel_reason &&
            data.lesson.status !== 'cancelada_professora' ? (
              <p className="text-sm text-muted-foreground">
                Motivo do cancelamento: {data.lesson.cancel_reason}
              </p>
            ) : null}
          </header>

          {!data.note && data.materials.length === 0 ? (
            <Alert variant="info">
              A professora ainda não registrou o conteúdo desta aula.
            </Alert>
          ) : null}
          {data.note?.content ? (
            <TextBlock title="Tema da aula" text={data.note.content} />
          ) : null}
          {data.note?.summary ? (
            <TextBlock title="Resumo" text={data.note.summary} />
          ) : null}
          {data.note?.homework ? (
            <TextBlock title="Tarefa" text={data.note.homework} />
          ) : null}
          {data.materials.length > 0 ? (
            <section aria-labelledby="aula-materiais">
              <h2 id="aula-materiais" className="mb-2 text-base font-semibold">
                Materiais desta aula
              </h2>
              <ul className="space-y-2">
                {data.materials.map((m) => (
                  <li key={m.id}>
                    <MaterialItem material={m} />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      )}
    </div>
  )
}
