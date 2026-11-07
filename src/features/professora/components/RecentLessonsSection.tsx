import { Link } from 'react-router'

import { Card, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/features/shared/components/StateViews'
import { formatDateTime } from '@/features/shared/datetime'
import { useQuery } from '@/lib/data/useQuery'

import { listRecentLessons } from '../api'
import { TeacherStatusBadge } from './TeacherStatusBadge'

export function RecentLessonsSection({
  studentId,
  timezone,
}: {
  studentId: string
  timezone: string
}) {
  const lessons = useQuery(`prof-ultimas:${studentId}`, () =>
    listRecentLessons(studentId),
  )
  return (
    <Card>
      <CardTitle>Últimas aulas</CardTitle>
      {lessons.error ? (
        <ErrorState error={lessons.error} onRetry={lessons.refetch} />
      ) : !lessons.data ? (
        <Skeleton className="h-16 w-full" />
      ) : lessons.data.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma aula registrada.</p>
      ) : (
        <ul className="divide-y">
          {lessons.data.map((l) => (
            <li key={l.id}>
              <Link
                to={`/app/professora/aulas/${l.id}`}
                className="flex items-center justify-between gap-2 py-2 text-sm outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <span>{formatDateTime(l.starts_at, timezone)}</span>
                <TeacherStatusBadge status={l.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
