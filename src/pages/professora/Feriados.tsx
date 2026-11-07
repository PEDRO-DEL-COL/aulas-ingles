import { Pencil, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'

import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/field'
import {
  classifyBlockedDates,
  formatBlockedRange,
  validateBlockedDateForm,
  type BlockedDateFormErrors,
} from '@/features/professora/blocked'
import {
  countScheduledLessonsInRange,
  deleteBlockedDate,
  listBlockedDates,
  saveBlockedDate,
  type BlockedDate,
} from '@/features/professora/blockedDatesApi'
import { ConfirmDialog } from '@/features/professora/components/ConfirmDialog'
import { FormField } from '@/features/professora/components/FormField'
import { useTimezone } from '@/features/professora/useTimezone'
import {
  EmptyState,
  ErrorState,
  ListSkeleton,
  PageHeader,
} from '@/features/shared/components/StateViews'
import { dayKey } from '@/features/shared/datetime'
import { friendlyError } from '@/features/shared/errors'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useQuery } from '@/lib/data/useQuery'

export default function Feriados() {
  useDocumentTitle('Férias e feriados')
  const timezone = useTimezone()
  const list = useQuery('prof-feriados', listBlockedDates)
  const [editing, setEditing] = useState<BlockedDate | null>(null)
  const [deleting, setDeleting] = useState<BlockedDate | null>(null)
  const [startsOn, setStartsOn] = useState('')
  const [endsOn, setEndsOn] = useState('')
  const [reason, setReason] = useState('')
  const [errors, setErrors] = useState<BlockedDateFormErrors>({})
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState<{
    ok: boolean
    text: string
    lessons?: number
  } | null>(null)

  function reset() {
    setEditing(null)
    setStartsOn('')
    setEndsOn('')
    setReason('')
    setErrors({})
  }

  function startEdit(b: BlockedDate) {
    setEditing(b)
    setStartsOn(b.starts_on)
    setEndsOn(b.ends_on === b.starts_on ? '' : b.ends_on)
    setReason(b.reason ?? '')
    setErrors({})
    setFeedback(null)
    document.getElementById('fer-inicio')?.focus()
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    const values = { starts_on: startsOn, ends_on: endsOn, reason }
    const found = validateBlockedDateForm(values)
    setErrors(found)
    setFeedback(null)
    if (Object.keys(found).length > 0) return
    setBusy(true)
    try {
      const end = endsOn === '' ? startsOn : endsOn
      await saveBlockedDate(values, editing?.id)
      let count = 0
      try {
        count = await countScheduledLessonsInRange(startsOn, end, timezone)
      } catch {
        count = 0
      }
      setFeedback({ ok: true, text: 'Período salvo.', lessons: count })
      reset()
      list.refetch()
    } catch (err) {
      setFeedback({ ok: false, text: friendlyError(err) })
    } finally {
      setBusy(false)
    }
  }

  const groups = list.data
    ? classifyBlockedDates(list.data, dayKey(new Date(), timezone))
    : null

  return (
    <div className="space-y-4">
      <PageHeader
        title="Férias e feriados"
        description="Dias bloqueados não recebem aulas quando você gera as aulas recorrentes."
      />

      <Alert variant="info">
        Aulas que já foram geradas nesses dias não são canceladas automaticamente:
        cancele-as na Agenda.
      </Alert>

      <form
        onSubmit={(e) => void submit(e)}
        noValidate
        className="space-y-3 rounded-xl border bg-card p-4 shadow-sm"
        aria-label={editing ? 'Editar período' : 'Novo período'}
      >
        <h2 className="font-semibold">{editing ? 'Editar período' : 'Novo período'}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="Data inicial" error={errors.starts_on}>
            {(p) => (
              <Input
                {...p}
                id="fer-inicio"
                type="date"
                value={startsOn}
                onChange={(e) => setStartsOn(e.target.value)}
              />
            )}
          </FormField>
          <FormField
            label="Data final (opcional)"
            error={errors.ends_on}
            help="Deixe em branco para bloquear só um dia."
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
              placeholder="Ex.: Natal, férias de julho"
              onChange={(e) => setReason(e.target.value)}
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
            {busy ? 'Salvando…' : editing ? 'Salvar alterações' : 'Adicionar período'}
          </Button>
        </div>
      </form>

      <div aria-live="polite" className="space-y-2">
        {feedback ? (
          <Alert variant={feedback.ok ? 'success' : 'destructive'}>{feedback.text}</Alert>
        ) : null}
        {feedback?.lessons ? (
          <Alert variant="warning">
            Já existem {feedback.lessons}{' '}
            {feedback.lessons === 1 ? 'aula agendada' : 'aulas agendadas'} nesse período.
            Cancele-as na{' '}
            <Link to="/app/professora/agenda" className="font-medium underline">
              Agenda
            </Link>{' '}
            (cancelada pela professora dá direito a reposição).
          </Alert>
        ) : null}
      </div>

      {list.error ? (
        <ErrorState error={list.error} onRetry={list.refetch} />
      ) : !groups ? (
        <ListSkeleton />
      ) : list.data?.length === 0 ? (
        <EmptyState title="Nenhum período bloqueado">
          Adicione férias ou feriados acima.
        </EmptyState>
      ) : (
        <>
          <Group
            title="Atuais"
            items={groups.atuais}
            onEdit={startEdit}
            onDelete={setDeleting}
          />
          <Group
            title="Próximos"
            items={groups.futuras}
            onEdit={startEdit}
            onDelete={setDeleting}
          />
          <Group
            title="Passados"
            items={groups.passadas}
            onEdit={startEdit}
            onDelete={setDeleting}
          />
        </>
      )}

      {deleting ? (
        <ConfirmDialog
          title="Excluir período"
          description={`Excluir o período ${formatBlockedRange(deleting.starts_on, deleting.ends_on)}${deleting.reason ? ` (${deleting.reason})` : ''}? Ao gerar aulas de novo, esses dias voltam a receber aulas.`}
          confirmLabel="Excluir"
          onConfirm={async () => {
            await deleteBlockedDate(deleting.id)
            if (editing?.id === deleting.id) reset()
            list.refetch()
          }}
          onClose={() => setDeleting(null)}
        />
      ) : null}
    </div>
  )
}

function Group({
  title,
  items,
  onEdit,
  onDelete,
}: {
  title: string
  items: BlockedDate[]
  onEdit: (b: BlockedDate) => void
  onDelete: (b: BlockedDate) => void
}) {
  if (items.length === 0) return null
  return (
    <section className="space-y-2" aria-label={title}>
      <h2 className="text-lg font-semibold">{title}</h2>
      <ul className="space-y-2">
        {items.map((b) => {
          const range = formatBlockedRange(b.starts_on, b.ends_on)
          return (
            <li
              key={b.id}
              className="flex items-center gap-3 rounded-xl border bg-card p-3 shadow-sm"
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium">{range}</p>
                {b.reason ? (
                  <p className="text-sm break-words text-muted-foreground">{b.reason}</p>
                ) : null}
              </div>
              <Button variant="outline" size="sm" onClick={() => onEdit(b)}>
                <Pencil aria-hidden="true" />
                Editar<span className="sr-only"> {range}</span>
              </Button>
              <Button variant="outline" size="sm" onClick={() => onDelete(b)}>
                <Trash2 aria-hidden="true" />
                Excluir<span className="sr-only"> {range}</span>
              </Button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
