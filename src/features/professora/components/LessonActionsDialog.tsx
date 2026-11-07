import { useState } from 'react'
import { Link } from 'react-router'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Input, Label, Textarea } from '@/components/ui/field'
import { formatDateTimeLong } from '@/features/shared/datetime'

import { cancelLesson, scheduleMakeup, setLessonStatus } from '../api'
import {
  canCancel,
  canMarkAttendance,
  canScheduleMakeup,
  needsMakeupDecision,
  type LessonWithStudent,
} from '../lessons'
import { addDaysKey, localToUtc } from '../tz'
import { dayKey } from '@/features/shared/datetime'
import { TeacherStatusBadge } from './TeacherStatusBadge'

type Mode = 'menu' | 'cancel_teacher' | 'cancel_student' | 'makeup' | 'done'

function eligibilityText(l: { makeup_eligible: boolean | null }): string {
  if (l.makeup_eligible === true) return 'O aluno tem direito a reposição.'
  if (l.makeup_eligible === false)
    return 'Cancelamento fora do prazo: sem direito a reposição.'
  return 'Reposição a critério da professora: decida na tela Hoje.'
}

/** Monte somente com uma aula selecionada. */
export function LessonActionsDialog({
  lesson,
  hasMakeup,
  timezone,
  onClose,
  onChanged,
}: {
  lesson: LessonWithStudent
  hasMakeup: boolean
  timezone: string
  onClose: () => void
  /** Chamado após qualquer alteração (para recarregar a lista). */
  onChanged: () => void
}) {
  const [openedAt] = useState(() => new Date())
  const [mode, setMode] = useState<Mode>('menu')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [date, setDate] = useState(() => addDaysKey(dayKey(openedAt, timezone), 1))
  const [time, setTime] = useState('14:00')

  const name = lesson.student?.full_name ?? 'Aluno'

  async function run(action: () => Promise<string | null>) {
    setBusy(true)
    setError(null)
    try {
      const text = await action()
      onChanged()
      if (text) {
        setMessage(text)
        setMode('done')
      } else {
        onClose()
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível concluir a ação.')
    } finally {
      setBusy(false)
    }
  }

  function submitMakeup() {
    const utc = localToUtc(date, time, timezone)
    if (!utc) {
      setError('Data ou hora inválida para o fuso configurado.')
      return
    }
    if (utc.getTime() <= Date.now()) {
      setError('A reposição precisa ser em uma data e hora futuras.')
      return
    }
    void run(async () => {
      await scheduleMakeup(lesson.id, utc.toISOString())
      return 'Reposição agendada.'
    })
  }

  const close = () => (busy ? undefined : onClose())

  return (
    <Dialog open onClose={close} title={name} dismissible={!busy}>
      <div className="space-y-1">
        <p className="text-sm first-letter:uppercase">
          {formatDateTimeLong(lesson.starts_at, timezone)}
        </p>
        <TeacherStatusBadge status={lesson.status} />
      </div>
      {error ? <Alert variant="destructive">{error}</Alert> : null}

      {mode === 'done' ? (
        <>
          <Alert variant="success">
            <AlertDescription>{message}</AlertDescription>
          </Alert>
          <Button onClick={onClose}>Fechar</Button>
        </>
      ) : null}

      {mode === 'menu' ? (
        <div className="flex flex-col gap-2">
          {canMarkAttendance(lesson) ? (
            <>
              <Button
                disabled={busy || lesson.status === 'realizada'}
                onClick={() =>
                  void run(async () => {
                    await setLessonStatus(lesson.id, 'realizada')
                    return null
                  })
                }
              >
                Marcar como realizada
              </Button>
              <Button
                variant="outline"
                disabled={busy || lesson.status === 'falta_aluno'}
                onClick={() =>
                  void run(async () => {
                    await setLessonStatus(lesson.id, 'falta_aluno')
                    return null
                  })
                }
              >
                Falta do aluno
              </Button>
            </>
          ) : null}
          {canCancel(lesson, openedAt) ? (
            <>
              <Button variant="outline" onClick={() => setMode('cancel_teacher')}>
                Cancelar pela professora
              </Button>
              <Button variant="outline" onClick={() => setMode('cancel_student')}>
                Registrar cancelamento pedido pelo aluno
              </Button>
            </>
          ) : null}
          {canScheduleMakeup(lesson, hasMakeup) ? (
            <Button onClick={() => setMode('makeup')}>Agendar reposição</Button>
          ) : null}
          {hasMakeup ? (
            <p className="text-sm text-muted-foreground">
              Esta aula já tem uma reposição agendada.
            </p>
          ) : null}
          {needsMakeupDecision(lesson) ? (
            <p className="text-sm text-muted-foreground">
              Reposição a critério: decida na tela Hoje (Dar reposição / Sem reposição).
            </p>
          ) : null}
          <Button variant="ghost" asChild>
            <Link to={`/app/professora/aulas/${lesson.id}`}>Registro da aula</Link>
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Fechar
          </Button>
        </div>
      ) : null}

      {mode === 'cancel_teacher' || mode === 'cancel_student' ? (
        <>
          <Alert variant="info" role="note">
            <AlertDescription>
              {mode === 'cancel_teacher'
                ? 'Cancelamento pela professora: o aluno sempre tem direito a reposição.'
                : 'Registra um cancelamento pedido pelo aluno agora. O banco aplica a regra de antecedência para definir se há reposição.'}
            </AlertDescription>
          </Alert>
          <div className="space-y-1.5">
            <Label htmlFor="cancel-reason">Motivo (opcional)</Label>
            <Textarea
              id="cancel-reason"
              value={reason}
              maxLength={500}
              disabled={busy}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" disabled={busy} onClick={() => setMode('menu')}>
              Voltar
            </Button>
            <Button
              variant="destructive"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  const updated = await cancelLesson(
                    lesson.id,
                    mode === 'cancel_teacher',
                    reason,
                  )
                  return `Aula cancelada. ${eligibilityText(updated)}`
                })
              }
            >
              {busy ? 'Cancelando…' : 'Cancelar aula'}
            </Button>
          </div>
        </>
      ) : null}

      {mode === 'makeup' ? (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="makeup-date">Data</Label>
              <Input
                id="makeup-date"
                type="date"
                value={date}
                disabled={busy}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="makeup-time">Hora</Label>
              <Input
                id="makeup-time"
                type="time"
                value={time}
                disabled={busy}
                onChange={(e) => setTime(e.target.value)}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Horário no fuso {timezone}. O limite de reposições do mês é conferido pelo
            banco.
          </p>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" disabled={busy} onClick={() => setMode('menu')}>
              Voltar
            </Button>
            <Button disabled={busy} onClick={submitMakeup}>
              {busy ? 'Agendando…' : 'Agendar reposição'}
            </Button>
          </div>
        </>
      ) : null}
    </Dialog>
  )
}
