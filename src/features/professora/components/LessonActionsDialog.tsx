import { useState } from 'react'
import { Link } from 'react-router'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Input, Label, Textarea } from '@/components/ui/field'
import { rescheduleLesson } from '@/features/calendar/api'
import { SlotPicker } from '@/features/calendar/components/SlotPicker'
import { parseDuration, validateSlotChoice } from '@/features/calendar/lessonForm'
import { useDayAvailability } from '@/features/calendar/useDayAvailability'
import { formatDateTimeLong } from '@/features/shared/datetime'
import { friendlyError } from '@/features/shared/errors'

import { cancelLesson, scheduleMakeup, setLessonStatus } from '../api'
import {
  canCancel,
  canMarkAttendance,
  canScheduleMakeup,
  needsMakeupDecision,
  type LessonWithStudent,
} from '../lessons'
import { addDaysKey } from '../tz'
import { dayKey } from '@/features/shared/datetime'
import { TeacherStatusBadge } from './TeacherStatusBadge'

type Mode =
  'menu' | 'cancel_teacher' | 'cancel_student' | 'makeup' | 'reschedule' | 'done'

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
  const [time, setTime] = useState('')
  const [durationText, setDurationText] = useState<string | null>(null)

  // Só carrega a disponibilidade quando um formulário de data/hora está aberto.
  const picking = mode === 'makeup' || mode === 'reschedule'
  const avail = useDayAvailability(picking ? date : '')

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
    const choice = validateSlotChoice({
      dateKey: date,
      time,
      durationMin: lesson.duration_minutes,
      data: avail.data,
      timezone,
    })
    if (!choice.ok) {
      setError(choice.error)
      return
    }
    void run(async () => {
      await scheduleMakeup(lesson.id, choice.startsAt)
      return 'Reposição agendada.'
    })
  }

  const rescheduleMinutes = parseDuration(durationText ?? String(lesson.duration_minutes))

  function submitReschedule() {
    const choice = validateSlotChoice({
      dateKey: date,
      time,
      durationMin: rescheduleMinutes,
      data: avail.data,
      timezone,
    })
    if (!choice.ok || rescheduleMinutes === null) {
      setError(choice.ok ? 'Duração inválida.' : choice.error)
      return
    }
    void run(async () => {
      try {
        await rescheduleLesson(
          lesson.id,
          choice.startsAt,
          rescheduleMinutes === lesson.duration_minutes ? undefined : rescheduleMinutes,
        )
      } catch (e) {
        throw new Error(friendlyError(e, 'Não foi possível remarcar a aula.'))
      }
      return 'Aula remarcada.'
    })
  }

  function openForm(next: 'makeup' | 'reschedule') {
    setError(null)
    setTime('')
    setDurationText(null)
    setMode(next)
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
          {lesson.status === 'agendada' || lesson.status === 'reposicao' ? (
            <Button variant="outline" onClick={() => openForm('reschedule')}>
              Remarcar
            </Button>
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
            <Button onClick={() => openForm('makeup')}>Agendar reposição</Button>
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
          <SlotPicker
            idPrefix="makeup"
            dateKey={date}
            onDateChange={setDate}
            time={time}
            onTimeChange={setTime}
            durationMin={lesson.duration_minutes}
            data={avail.data}
            loading={avail.loading}
            error={avail.error}
            onRetry={avail.retry}
            disabled={busy}
          />
          <p className="text-xs text-muted-foreground">
            Horário no fuso {timezone}. O limite de reposições do mês e a disponibilidade
            são conferidos pelo banco.
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

      {mode === 'reschedule' ? (
        <>
          <div className="space-y-1.5">
            <Label htmlFor="resched-duration">Duração (min)</Label>
            <Input
              id="resched-duration"
              type="number"
              inputMode="numeric"
              min={5}
              max={480}
              value={durationText ?? String(lesson.duration_minutes)}
              disabled={busy}
              aria-invalid={rescheduleMinutes === null}
              onChange={(e) => setDurationText(e.target.value)}
            />
          </div>
          <SlotPicker
            idPrefix="resched"
            dateKey={date}
            onDateChange={setDate}
            time={time}
            onTimeChange={setTime}
            durationMin={rescheduleMinutes}
            data={avail.data}
            loading={avail.loading}
            error={avail.error}
            onRetry={avail.retry}
            disabled={busy}
          />
          <Alert variant="info" role="note">
            <AlertDescription>
              Horário no fuso {timezone}. Se esta aula foi gerada por um horário fixo do
              aluno e o mesmo período for gerado de novo, ela pode reaparecer no horário
              original (limitação conhecida).
            </AlertDescription>
          </Alert>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" disabled={busy} onClick={() => setMode('menu')}>
              Voltar
            </Button>
            <Button disabled={busy} onClick={submitReschedule}>
              {busy ? 'Remarcando…' : 'Remarcar aula'}
            </Button>
          </div>
        </>
      ) : null}
    </Dialog>
  )
}
