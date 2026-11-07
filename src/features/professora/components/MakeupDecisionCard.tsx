import { useState } from 'react'

import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { formatDateTimeLong } from '@/features/shared/datetime'

import { decideMakeup } from '../api'
import type { LessonWithStudent } from '../lessons'

/** Cancelamento "a critério": a professora decide entre dar ou não a reposição. */
export function MakeupDecisionCard({
  lesson,
  timezone,
  onDone,
}: {
  lesson: LessonWithStudent
  timezone: string
  onDone: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function decide(eligible: boolean) {
    setBusy(true)
    setError(null)
    try {
      await decideMakeup(lesson.id, eligible)
      onDone()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível registrar a decisão.')
      setBusy(false)
    }
  }

  return (
    <Card className="gap-2">
      <p className="font-semibold">{lesson.student?.full_name ?? 'Aluno'}</p>
      <p className="text-sm text-muted-foreground first-letter:uppercase">
        Cancelou a aula de {formatDateTimeLong(lesson.starts_at, timezone)}
        {lesson.cancel_reason ? `. Motivo: ${lesson.cancel_reason}` : ''}
      </p>
      {error ? <Alert variant="destructive">{error}</Alert> : null}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button disabled={busy} onClick={() => void decide(true)}>
          Dar reposição
        </Button>
        <Button variant="outline" disabled={busy} onClick={() => void decide(false)}>
          Sem reposição
        </Button>
      </div>
    </Card>
  )
}
