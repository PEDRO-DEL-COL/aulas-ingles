import { Badge } from '@/components/ui/badge'
import { teacherStatusInfo, type LessonWithStudent } from '@/features/professora/lessons'
import { formatDate, formatTime } from '@/features/shared/datetime'

/** Lista compacta de aulas (aluno, data/hora no fuso, status). */
export function ConflictLessonList({
  lessons,
  timezone,
  label,
  limit,
}: {
  lessons: readonly LessonWithStudent[]
  timezone: string
  label: string
  /** Mostra só as primeiras `limit` e resume o resto. */
  limit?: number
}) {
  const shown = limit === undefined ? lessons : lessons.slice(0, limit)
  const rest = lessons.length - shown.length
  return (
    <div>
      <ul
        aria-label={label}
        className="max-h-60 divide-y overflow-y-auto rounded-lg border text-sm"
      >
        {shown.map((l) => {
          const info = teacherStatusInfo(l.status)
          return (
            <li key={l.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 p-2.5">
              <span className="min-w-0 flex-1 font-medium break-words">
                {l.student?.full_name ?? 'Aluno'}
              </span>
              <span className="text-muted-foreground">
                {formatDate(l.starts_at, timezone)} às {formatTime(l.starts_at, timezone)}
                {' · '}
                {l.duration_minutes} min
              </span>
              <Badge tone={info.tone}>{info.label}</Badge>
            </li>
          )
        })}
      </ul>
      {rest > 0 ? (
        <p className="mt-1 text-xs text-muted-foreground">
          e mais {rest} {rest === 1 ? 'aula' : 'aulas'}.
        </p>
      ) : null}
    </div>
  )
}
