import { useState } from 'react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Label, Textarea } from '@/components/ui/field'
import { cancelLesson } from '@/features/aluno/api'
import { useAluno } from '@/features/aluno/AlunoContext'
import { formatDateTimeLong } from '@/features/aluno/datetime'
import {
  previewCancellation,
  previewMessage,
  type CancelPreview,
  type Lesson,
} from '@/features/aluno/lessons'

const VARIANT: Record<CancelPreview, 'success' | 'warning' | 'destructive'> = {
  com_reposicao: 'success',
  a_criterio: 'warning',
  sem_reposicao: 'destructive',
}

function resultText(updated: Lesson): { title: string; text: string } {
  if (updated.makeup_eligible === true) {
    return {
      title: 'Aula cancelada',
      text: 'Você tem direito a reposição. A professora vai combinar um novo horário com você.',
    }
  }
  if (updated.makeup_eligible === false) {
    return {
      title: 'Aula cancelada',
      text: 'Esta aula foi cancelada fora do prazo e não dá direito a reposição.',
    }
  }
  return {
    title: 'Aula cancelada',
    text: 'A reposição ficará a critério da professora, que vai avisar você.',
  }
}

/** Monte somente quando houver uma aula selecionada (a prévia usa a hora da abertura). */
export function CancelDialog({
  lesson,
  onClose,
  onDone,
}: {
  lesson: Lesson
  onClose: () => void
  /** Chamado ao fechar depois de um cancelamento bem-sucedido. */
  onDone: () => void
}) {
  const { settings, timezone } = useAluno()
  const [openedAt] = useState(() => new Date())
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<Lesson | null>(null)

  const preview = previewCancellation(openedAt, lesson.starts_at, settings)

  async function confirm() {
    setBusy(true)
    setError(null)
    try {
      setResult(await cancelLesson(lesson.id, reason))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível cancelar a aula.')
    } finally {
      setBusy(false)
    }
  }

  function close() {
    if (result) onDone()
    else onClose()
  }

  if (result) {
    const r = resultText(result)
    return (
      <Dialog open onClose={close} title={r.title}>
        <Alert variant={result.makeup_eligible === false ? 'warning' : 'success'}>
          <AlertDescription>{r.text}</AlertDescription>
        </Alert>
        <Button onClick={close}>Fechar</Button>
      </Dialog>
    )
  }

  return (
    <Dialog open onClose={close} title="Cancelar esta aula?" dismissible={!busy}>
      <p className="text-sm first-letter:uppercase">
        {formatDateTimeLong(lesson.starts_at, timezone)}
      </p>
      <Alert variant={VARIANT[preview]} role="note">
        <AlertTitle>
          {previewMessage(preview, settings.cancellation_min_hours)}
        </AlertTitle>
        <AlertDescription>
          O resultado final é definido pelo sistema no momento do cancelamento.
          {settings.cancellation_policy_text
            ? ` ${settings.cancellation_policy_text}`
            : ''}
        </AlertDescription>
      </Alert>
      <div className="space-y-1.5">
        <Label htmlFor="cancel-reason">Motivo (opcional)</Label>
        <Textarea
          id="cancel-reason"
          value={reason}
          maxLength={500}
          onChange={(e) => setReason(e.target.value)}
          disabled={busy}
        />
      </div>
      {error ? <Alert variant="destructive">{error}</Alert> : null}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="outline" onClick={close} disabled={busy}>
          Manter a aula
        </Button>
        <Button variant="destructive" onClick={() => void confirm()} disabled={busy}>
          {busy ? 'Cancelando…' : 'Cancelar aula'}
        </Button>
      </div>
    </Dialog>
  )
}
