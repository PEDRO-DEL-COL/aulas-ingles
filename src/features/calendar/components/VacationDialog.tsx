import { useState, type FormEvent } from 'react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/field'
import {
  blockPreviewMessage,
  formatBlockedRange,
  validateBlockedDateForm,
} from '@/features/professora/blocked'
import { FormField } from '@/features/professora/components/FormField'
import { friendlyError } from '@/features/shared/errors'

import { addBlockedDates } from '../api'
import type { VacationDialogProps } from './contracts'
import { ConflictLessonList } from './ConflictLessonList'
import { useActiveLessons } from './ConflictUseLessons'

export function VacationDialog(props: VacationDialogProps) {
  return (
    <Dialog
      open={props.open}
      onClose={() => props.onOpenChange(false)}
      title="Férias ou período bloqueado"
    >
      {props.open ? <VacationBody {...props} /> : null}
    </Dialog>
  )
}

function VacationBody({
  initialRange,
  timezone,
  onOpenChange,
  onSaved,
}: VacationDialogProps) {
  const [startsOn, setStartsOn] = useState(initialRange?.from ?? '')
  const [endsOn, setEndsOn] = useState(
    initialRange && initialRange.to !== initialRange.from ? initialRange.to : '',
  )
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  const values = { starts_on: startsOn, ends_on: endsOn, reason }
  const errors = validateBlockedDateForm(values)
  const valid = Object.keys(errors).length === 0
  const lastDay = endsOn === '' ? startsOn : endsOn
  const preview = useActiveLessons(
    valid ? startsOn : null,
    valid ? lastDay : null,
    timezone,
  )
  const count = preview.lessons.length

  async function submit(e: FormEvent) {
    e.preventDefault()
    setSubmitted(true)
    setError(null)
    if (!valid || preview.loading) return
    setBusy(true)
    try {
      await addBlockedDates([
        { starts_on: startsOn, ends_on: lastDay, reason: reason.trim() || null },
      ])
      const range = formatBlockedRange(startsOn, lastDay)
      const canceled =
        count === 0
          ? 'Nenhuma aula estava agendada nesse período.'
          : count === 1
            ? '1 aula agendada foi cancelada, com direito a reposição.'
            : `${count} aulas agendadas foram canceladas, com direito a reposição.`
      setDone(`Período ${range} bloqueado. ${canceled}`)
      onSaved()
    } catch (err) {
      setError(friendlyError(err, 'Não foi possível bloquear o período.'))
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    return (
      <div className="space-y-4">
        <Alert variant="success">
          <AlertTitle>Período bloqueado</AlertTitle>
          <AlertDescription>{done}</AlertDescription>
        </Alert>
        <div className="flex justify-end">
          <Button autoFocus onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={(e) => void submit(e)} noValidate className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Dias bloqueados não recebem aulas nem reposições.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="Primeiro dia" error={submitted ? errors.starts_on : undefined}>
          {(p) => (
            <Input
              {...p}
              type="date"
              value={startsOn}
              onChange={(e) => setStartsOn(e.target.value)}
            />
          )}
        </FormField>
        <FormField
          label="Último dia (opcional)"
          error={submitted || endsOn ? errors.ends_on : undefined}
          help="Em branco bloqueia só o primeiro dia."
        >
          {(p) => (
            <Input
              {...p}
              type="date"
              value={endsOn}
              min={startsOn || undefined}
              onChange={(e) => setEndsOn(e.target.value)}
            />
          )}
        </FormField>
      </div>
      <FormField label="Motivo (opcional)" error={errors.reason}>
        {(p) => (
          <Input
            {...p}
            value={reason}
            maxLength={200}
            placeholder="Ex.: férias de julho"
            onChange={(e) => setReason(e.target.value)}
          />
        )}
      </FormField>

      {valid ? (
        <div aria-live="polite" className="space-y-2">
          {preview.loading ? (
            <p className="text-sm text-muted-foreground">
              Verificando as aulas do período…
            </p>
          ) : preview.error ? (
            <Alert variant="warning">
              {preview.error} Você ainda pode salvar; o banco cancela as aulas agendadas
              do período.
            </Alert>
          ) : count > 0 ? (
            <>
              <Alert variant="warning">{blockPreviewMessage(count)}</Alert>
              <ConflictLessonList
                lessons={preview.lessons}
                timezone={timezone}
                label="Aulas que serão canceladas"
                limit={5}
              />
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Nenhuma aula agendada nesse período.
            </p>
          )}
        </div>
      ) : null}

      {error ? <Alert variant="destructive">{error}</Alert> : null}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={() => onOpenChange(false)}
        >
          Cancelar
        </Button>
        <Button
          type="submit"
          variant={count > 0 ? 'destructive' : 'default'}
          disabled={busy || (valid && preview.loading)}
        >
          {busy
            ? 'Salvando…'
            : count > 0
              ? `Bloquear e cancelar ${count === 1 ? '1 aula' : `${count} aulas`}`
              : 'Bloquear período'}
        </Button>
      </div>
    </form>
  )
}
