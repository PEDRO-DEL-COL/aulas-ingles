import { useState, type FormEvent } from 'react'

import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Input, Label, Select } from '@/components/ui/field'
import { friendlyError } from '@/features/shared/errors'
import { useQuery } from '@/lib/data/useQuery'

import { createLesson, listActiveStudents } from '../api'
import { defaultLessonMinutes, parseDuration, validateSlotChoice } from '../lessonForm'
import { useDayAvailability } from '../useDayAvailability'
import { SlotPicker } from './SlotPicker'

/** Nova aula avulsa. Monte só quando for abrir (o estado nasce com a data inicial). */
export function NewLessonDialog({
  initialDate,
  timezone,
  onClose,
  onCreated,
  onOpenDay,
}: {
  initialDate: string
  timezone: string
  onClose: () => void
  onCreated: (message: string) => void
  /** Atalho "ver ou ajustar o dia" quando não há horários. */
  onOpenDay: (dateKey: string) => void
}) {
  const students = useQuery('cal-alunos-ativos', listActiveStudents)
  const [studentId, setStudentId] = useState('')
  const [dateKey, setDateKey] = useState(initialDate)
  const [time, setTime] = useState('')
  const [durationText, setDurationText] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const avail = useDayAvailability(dateKey)
  const duration = durationText ?? String(defaultLessonMinutes(dateKey, avail.data))
  const durationMin = parseDuration(duration)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!studentId) {
      setError('Escolha o aluno.')
      return
    }
    const choice = validateSlotChoice({
      dateKey,
      time,
      durationMin,
      data: avail.data,
      timezone,
    })
    if (!choice.ok || durationMin === null) {
      setError(choice.ok ? 'Duração inválida.' : choice.error)
      return
    }
    setBusy(true)
    setError(null)
    try {
      await createLesson({
        studentId,
        startsAtIso: choice.startsAt,
        durationMinutes: durationMin,
      })
      onCreated('Aula criada.')
    } catch (err) {
      setError(friendlyError(err, 'Não foi possível criar a aula.'))
      setBusy(false)
    }
  }

  return (
    <Dialog open onClose={onClose} title="Nova aula" dismissible={!busy}>
      <form onSubmit={(e) => void submit(e)} noValidate className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="nova-aula-aluno">Aluno</Label>
          {students.error ? (
            <Alert variant="destructive" className="flex flex-wrap items-center gap-2">
              <span>Não foi possível carregar os alunos.</span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={students.refetch}
              >
                Tentar de novo
              </Button>
            </Alert>
          ) : (
            <Select
              id="nova-aula-aluno"
              value={studentId}
              disabled={busy || !students.data}
              onChange={(e) => setStudentId(e.target.value)}
            >
              <option value="">
                {students.data ? 'Escolha o aluno' : 'Carregando alunos…'}
              </option>
              {(students.data ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name}
                </option>
              ))}
            </Select>
          )}
          {students.data && students.data.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum aluno ativo cadastrado.
            </p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="nova-aula-duracao">Duração (min)</Label>
          <Input
            id="nova-aula-duracao"
            type="number"
            inputMode="numeric"
            min={5}
            max={480}
            value={duration}
            disabled={busy}
            aria-invalid={durationMin === null}
            onChange={(e) => setDurationText(e.target.value)}
          />
        </div>

        <SlotPicker
          idPrefix="nova-aula"
          dateKey={dateKey}
          onDateChange={setDateKey}
          time={time}
          onTimeChange={setTime}
          durationMin={durationMin}
          data={avail.data}
          loading={avail.loading}
          error={avail.error}
          onRetry={avail.retry}
          disabled={busy}
          onOpenDay={onOpenDay}
        />

        <p className="text-xs text-muted-foreground">
          Horário no fuso {timezone}. O banco confere a disponibilidade ao salvar.
        </p>
        {error ? <Alert variant="destructive">{error}</Alert> : null}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? 'Salvando…' : 'Criar aula'}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
