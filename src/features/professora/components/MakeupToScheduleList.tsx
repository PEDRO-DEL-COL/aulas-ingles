import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { formatDateTimeLong } from '@/features/shared/datetime'

import type { LessonWithStudent } from '../lessons'
import { LessonActionsDialog } from './LessonActionsDialog'

/** Lista de cancelamentos com direito a reposição, cada um com "Agendar reposição". */
export function MakeupToScheduleList({
  lessons,
  timezone,
  onChanged,
  showReason = true,
}: {
  lessons: LessonWithStudent[]
  timezone: string
  onChanged: () => void
  showReason?: boolean
}) {
  const [selected, setSelected] = useState<LessonWithStudent | null>(null)
  return (
    <>
      <ul className="space-y-3">
        {lessons.map((l) => (
          <li key={l.id}>
            <Card className="gap-2">
              <p className="font-semibold">{l.student?.full_name ?? 'Aluno'}</p>
              <p className="text-sm text-muted-foreground first-letter:uppercase">
                Aula original: {formatDateTimeLong(l.starts_at, timezone)}
              </p>
              {showReason && l.cancel_reason ? (
                <p className="text-sm text-muted-foreground">Motivo: {l.cancel_reason}</p>
              ) : null}
              <Button className="self-start" onClick={() => setSelected(l)}>
                Agendar reposição
                <span className="sr-only"> de {l.student?.full_name ?? 'aluno'}</span>
              </Button>
            </Card>
          </li>
        ))}
      </ul>
      {selected ? (
        <LessonActionsDialog
          lesson={selected}
          hasMakeup={false}
          timezone={timezone}
          onClose={() => setSelected(null)}
          onChanged={onChanged}
        />
      ) : null}
    </>
  )
}
