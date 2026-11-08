import { Pencil, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input, Select } from '@/components/ui/field'
import {
  findOverlaps,
  formatRange,
  formatSlot,
  groupSlotsByWeekday,
  trimTime,
  validateSlotForm,
  type SlotFormErrors,
} from '@/features/professora/availability'
import {
  deleteSlot,
  listSlots,
  saveSlot,
  toggleSlot,
  type AvailabilitySlot,
} from '@/features/professora/availabilityApi'
import { ConfirmDialog } from '@/features/professora/components/ConfirmDialog'
import { FormField } from '@/features/professora/components/FormField'
import { WEEKDAY_LABELS } from '@/features/professora/validation'
import {
  ErrorState,
  ListSkeleton,
  PageHeader,
} from '@/features/shared/components/StateViews'
import { friendlyError } from '@/features/shared/errors'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useQuery } from '@/lib/data/useQuery'

export default function Disponibilidade() {
  useDocumentTitle('Disponibilidade')
  const list = useQuery('prof-disponibilidade', listSlots)
  const [editing, setEditing] = useState<AvailabilitySlot | null>(null)
  const [deleting, setDeleting] = useState<AvailabilitySlot | null>(null)
  const [weekday, setWeekday] = useState('1')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [notes, setNotes] = useState('')
  const [errors, setErrors] = useState<SlotFormErrors>({})
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null)

  function reset() {
    setEditing(null)
    setStart('')
    setEnd('')
    setNotes('')
    setErrors({})
  }

  function startEdit(s: AvailabilitySlot) {
    setEditing(s)
    setWeekday(String(s.weekday))
    setStart(trimTime(s.start_time))
    setEnd(trimTime(s.end_time))
    setNotes(s.notes ?? '')
    setErrors({})
    setFeedback(null)
    document.getElementById('disp-inicio')?.focus()
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    const values = { weekday, start_time: start, end_time: end, notes }
    const found = validateSlotForm(values)
    setErrors(found)
    setFeedback(null)
    if (Object.keys(found).length > 0) return
    setBusy(true)
    try {
      await saveSlot(values, editing?.id)
      setFeedback({ ok: true, text: 'Faixa salva.' })
      reset()
      list.refetch()
    } catch (err) {
      setFeedback({ ok: false, text: friendlyError(err) })
    } finally {
      setBusy(false)
    }
  }

  async function toggle(s: AvailabilitySlot) {
    setFeedback(null)
    try {
      await toggleSlot(s.id, !s.active)
      list.refetch()
    } catch (err) {
      setFeedback({ ok: false, text: friendlyError(err) })
    }
  }

  const slots = list.data
  const noneActive = slots ? !slots.some((s) => s.active) : false
  const overlaps = slots ? findOverlaps(slots) : []
  const groups = slots ? groupSlotsByWeekday(slots) : null

  return (
    <div className="space-y-4">
      <PageHeader
        title="Disponibilidade"
        description="Reposições só podem ser marcadas dentro destas faixas e fora de férias e feriados."
      />

      {slots && noneActive ? (
        <Alert variant="warning">
          <AlertTitle>Nenhuma faixa ativa</AlertTitle>
          <AlertDescription>
            Enquanto não houver nenhuma faixa ativa, só férias e feriados são respeitados:
            qualquer horário fora deles é aceito para reposição.
          </AlertDescription>
        </Alert>
      ) : (
        <Alert variant="info">
          <AlertDescription>
            Os horários seguem o seu fuso. Veja também{' '}
            <Link to="/app/professora/feriados" className="font-medium underline">
              Férias e feriados
            </Link>
            .
          </AlertDescription>
        </Alert>
      )}

      <form
        onSubmit={(e) => void submit(e)}
        noValidate
        className="space-y-3 rounded-xl border bg-card p-4 shadow-sm"
        aria-label={editing ? 'Editar faixa' : 'Nova faixa'}
      >
        <h2 className="font-semibold">{editing ? 'Editar faixa' : 'Nova faixa'}</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <FormField label="Dia da semana" error={errors.weekday}>
            {(p) => (
              <Select {...p} value={weekday} onChange={(e) => setWeekday(e.target.value)}>
                {WEEKDAY_LABELS.map((label, i) => (
                  <option key={label} value={i}>
                    {label}
                  </option>
                ))}
              </Select>
            )}
          </FormField>
          <FormField label="Início" error={errors.start_time}>
            {(p) => (
              <Input
                {...p}
                id="disp-inicio"
                type="time"
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            )}
          </FormField>
          <FormField label="Fim" error={errors.end_time}>
            {(p) => (
              <Input
                {...p}
                type="time"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
              />
            )}
          </FormField>
        </div>
        <FormField label="Observação (opcional)" error={errors.notes}>
          {(p) => (
            <Input
              {...p}
              value={notes}
              maxLength={200}
              placeholder="Ex.: só online"
              onChange={(e) => setNotes(e.target.value)}
            />
          )}
        </FormField>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          {editing ? (
            <Button type="button" variant="outline" disabled={busy} onClick={reset}>
              Cancelar edição
            </Button>
          ) : null}
          <Button type="submit" disabled={busy}>
            {busy ? 'Salvando…' : editing ? 'Salvar alterações' : 'Adicionar faixa'}
          </Button>
        </div>
      </form>

      <div aria-live="polite" className="space-y-2">
        {feedback ? (
          <Alert variant={feedback.ok ? 'success' : 'destructive'}>{feedback.text}</Alert>
        ) : null}
      </div>

      {overlaps.length > 0 ? (
        <Alert variant="warning">
          <AlertTitle>Faixas sobrepostas</AlertTitle>
          <AlertDescription>
            Estas faixas ativas se sobrepõem (não é um erro, mas talvez valha unir):
            <ul className="mt-1 list-disc pl-5">
              {overlaps.map(([a, b]) => (
                <li key={`${a.id}-${b.id}`}>
                  {formatSlot(a)} e {formatRange(b)}
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      ) : null}

      {list.error ? (
        <ErrorState error={list.error} onRetry={list.refetch} />
      ) : !groups ? (
        <ListSkeleton />
      ) : (
        <ul className="space-y-2" aria-label="Faixas por dia da semana">
          {groups.map((day, wd) => (
            <li key={wd} className="rounded-xl border bg-card p-3 shadow-sm">
              <h2 className="font-semibold">{WEEKDAY_LABELS[wd]}</h2>
              {day.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sem faixas.</p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {day.map((s) => {
                    const range = formatRange(s)
                    return (
                      <li key={s.id} className="flex flex-wrap items-center gap-2">
                        <div className="min-w-0 flex-1">
                          <p
                            className={s.active ? 'font-medium' : 'text-muted-foreground'}
                          >
                            {range}
                            {s.active ? '' : ' (desativada)'}
                          </p>
                          {s.notes ? (
                            <p className="text-sm break-words text-muted-foreground">
                              {s.notes}
                            </p>
                          ) : null}
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void toggle(s)}
                        >
                          {s.active ? 'Desativar' : 'Ativar'}
                          <span className="sr-only"> {range}</span>
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => startEdit(s)}>
                          <Pencil aria-hidden="true" />
                          Editar<span className="sr-only"> {range}</span>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setDeleting(s)}
                        >
                          <Trash2 aria-hidden="true" />
                          Excluir<span className="sr-only"> {range}</span>
                        </Button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}

      <p className="text-sm text-muted-foreground">
        No futuro, esta agenda vai servir também para o aluno ver horários livres.
      </p>

      {deleting ? (
        <ConfirmDialog
          title="Excluir faixa"
          description={`Excluir a faixa ${formatSlot(deleting)}? Reposições já agendadas não são alteradas.`}
          confirmLabel="Excluir"
          onConfirm={async () => {
            await deleteSlot(deleting.id)
            if (editing?.id === deleting.id) reset()
            list.refetch()
          }}
          onClose={() => setDeleting(null)}
        />
      ) : null}
    </div>
  )
}
