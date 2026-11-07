import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'

import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardTitle } from '@/components/ui/card'
import { Dialog } from '@/components/ui/dialog'
import { Input, Select } from '@/components/ui/field'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState, ErrorState } from '@/features/shared/components/StateViews'
import { dayKey, formatDateOnly } from '@/features/shared/datetime'
import { useQuery } from '@/lib/data/useQuery'

import { deleteSchedule, listSchedules, saveSchedule, type Schedule } from '../api'
import {
  validateScheduleForm,
  WEEKDAY_LABELS,
  type ScheduleFormValues,
} from '../validation'
import { ConfirmDialog } from './ConfirmDialog'
import { FormField } from './FormField'

const hhmm = (t: string) => t.slice(0, 5)

function ScheduleDialog({
  studentId,
  schedule,
  timezone,
  onClose,
  onSaved,
}: {
  studentId: string
  schedule: Schedule | null
  timezone: string
  onClose: () => void
  onSaved: () => void
}) {
  const [values, setValues] = useState<ScheduleFormValues>(() => ({
    weekday: String(schedule?.weekday ?? 1),
    start_time: schedule ? hhmm(schedule.start_time) : '14:00',
    duration_minutes: String(schedule?.duration_minutes ?? 60),
    starts_on: schedule?.starts_on ?? dayKey(new Date(), timezone),
    ends_on: schedule?.ends_on ?? '',
    active: schedule?.active ?? true,
  }))
  const [errors, setErrors] = useState<Partial<Record<keyof ScheduleFormValues, string>>>(
    {},
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = <K extends keyof ScheduleFormValues>(k: K, v: ScheduleFormValues[K]) =>
    setValues((s) => ({ ...s, [k]: v }))

  async function submit(e: FormEvent) {
    e.preventDefault()
    const found = validateScheduleForm(values)
    setErrors(found)
    if (Object.keys(found).length > 0) return
    setBusy(true)
    setError(null)
    try {
      await saveSchedule(schedule?.id ?? null, {
        student_id: studentId,
        weekday: Number(values.weekday),
        start_time: values.start_time,
        timezone: schedule?.timezone ?? timezone,
        duration_minutes: Number(values.duration_minutes),
        starts_on: values.starts_on,
        ends_on: values.ends_on === '' ? null : values.ends_on,
        active: values.active,
      })
      onSaved()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível salvar.')
      setBusy(false)
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={schedule ? 'Editar horário' : 'Novo horário'}
      dismissible={!busy}
    >
      <form onSubmit={(e) => void submit(e)} noValidate className="space-y-3">
        <FormField label="Dia da semana" error={errors.weekday}>
          {(p) => (
            <Select
              {...p}
              value={values.weekday}
              onChange={(e) => set('weekday', e.target.value)}
            >
              {WEEKDAY_LABELS.map((l, i) => (
                <option key={l} value={i}>
                  {l}
                </option>
              ))}
            </Select>
          )}
        </FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Hora" error={errors.start_time}>
            {(p) => (
              <Input
                {...p}
                type="time"
                value={values.start_time}
                onChange={(e) => set('start_time', e.target.value)}
              />
            )}
          </FormField>
          <FormField label="Duração (min)" error={errors.duration_minutes}>
            {(p) => (
              <Input
                {...p}
                type="number"
                inputMode="numeric"
                min={5}
                max={480}
                value={values.duration_minutes}
                onChange={(e) => set('duration_minutes', e.target.value)}
              />
            )}
          </FormField>
          <FormField label="Início" error={errors.starts_on}>
            {(p) => (
              <Input
                {...p}
                type="date"
                value={values.starts_on}
                onChange={(e) => set('starts_on', e.target.value)}
              />
            )}
          </FormField>
          <FormField label="Fim (opcional)" error={errors.ends_on}>
            {(p) => (
              <Input
                {...p}
                type="date"
                value={values.ends_on}
                onChange={(e) => set('ends_on', e.target.value)}
              />
            )}
          </FormField>
        </div>
        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            className="size-5 accent-primary"
            checked={values.active}
            onChange={(e) => set('active', e.target.checked)}
          />
          Horário ativo (gera aulas)
        </label>
        <p className="text-xs text-muted-foreground">
          Fuso: {schedule?.timezone ?? timezone}
        </p>
        {error ? <Alert variant="destructive">{error}</Alert> : null}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? 'Salvando…' : 'Salvar horário'}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}

export function SchedulesSection({
  studentId,
  timezone,
}: {
  studentId: string
  timezone: string
}) {
  const list = useQuery(`prof-horarios:${studentId}`, () => listSchedules(studentId))
  const [editing, setEditing] = useState<Schedule | 'new' | null>(null)
  const [removing, setRemoving] = useState<Schedule | null>(null)

  return (
    <Card>
      <div className="flex items-center justify-between gap-2">
        <CardTitle>Horários fixos</CardTitle>
        <Button size="sm" variant="outline" onClick={() => setEditing('new')}>
          <Plus aria-hidden="true" />
          Adicionar
        </Button>
      </div>
      {list.error ? (
        <ErrorState error={list.error} onRetry={list.refetch} />
      ) : !list.data ? (
        <Skeleton className="h-16 w-full" />
      ) : list.data.length === 0 ? (
        <EmptyState title="Nenhum horário fixo">
          Cadastre o dia e a hora para gerar as aulas recorrentes na agenda.
        </EmptyState>
      ) : (
        <ul className="divide-y">
          {list.data.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-2 py-2">
              <div className="min-w-0 text-sm">
                <p className="font-semibold">
                  {WEEKDAY_LABELS[s.weekday]}, {hhmm(s.start_time)}{' '}
                  <span className="font-normal text-muted-foreground">
                    {s.duration_minutes} min
                  </span>
                </p>
                <p className="text-muted-foreground">
                  Desde {formatDateOnly(s.starts_on)}
                  {s.ends_on ? ` até ${formatDateOnly(s.ends_on)}` : ''}{' '}
                  {s.active ? null : <Badge tone="muted">Inativo</Badge>}
                </p>
              </div>
              <div className="flex shrink-0">
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={`Editar horário de ${WEEKDAY_LABELS[s.weekday]}`}
                  onClick={() => setEditing(s)}
                >
                  <Pencil aria-hidden="true" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={`Excluir horário de ${WEEKDAY_LABELS[s.weekday]}`}
                  onClick={() => setRemoving(s)}
                >
                  <Trash2 aria-hidden="true" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {editing ? (
        <ScheduleDialog
          studentId={studentId}
          schedule={editing === 'new' ? null : editing}
          timezone={timezone}
          onClose={() => setEditing(null)}
          onSaved={list.refetch}
        />
      ) : null}
      {removing ? (
        <ConfirmDialog
          title="Excluir horário?"
          description="As aulas já geradas continuam na agenda; só deixam de ser criadas novas."
          confirmLabel="Excluir"
          onClose={() => setRemoving(null)}
          onConfirm={async () => {
            await deleteSchedule(removing.id)
            list.refetch()
          }}
        />
      ) : null}
    </Card>
  )
}
