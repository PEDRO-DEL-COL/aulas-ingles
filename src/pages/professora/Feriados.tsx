import { Pencil, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'

import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/field'
import {
  blockPreviewMessage,
  canceledSummaryTitle,
  classifyBlockedDates,
  formatBlockedRange,
  validateBlockedDateForm,
  type BlockedDateFormErrors,
  type BlockedDateFormValues,
} from '@/features/professora/blocked'
import {
  countCanceledByBlockedDate,
  countScheduledLessonsInRange,
  deleteBlockedDate,
  listBlockedDates,
  listLessonsCanceledByBlock,
  saveBlockedDate,
  type BlockedDate,
} from '@/features/professora/blockedDatesApi'
import { ConfirmDialog } from '@/features/professora/components/ConfirmDialog'
import { MakeupToScheduleList } from '@/features/professora/components/MakeupToScheduleList'
import { FormField } from '@/features/professora/components/FormField'
import type { LessonWithStudent } from '@/features/professora/lessons'
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
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null)
  const [canceled, setCanceled] = useState<LessonWithStudent[] | null>(null)
  const [confirmSave, setConfirmSave] = useState<{
    values: BlockedDateFormValues
    count: number
  } | null>(null)
  const counts = useQuery('prof-feriados-contagem', countCanceledByBlockedDate)

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
    setCanceled(null)
    if (Object.keys(found).length > 0) return
    setBusy(true)
    try {
      let count = 0
      try {
        count = await countScheduledLessonsInRange(
          startsOn,
          endsOn === '' ? startsOn : endsOn,
          timezone,
        )
      } catch {
        count = 0
      }
      if (count > 0) {
        setConfirmSave({ values, count })
        return
      }
      await persist(values)
    } catch (err) {
      setFeedback({ ok: false, text: friendlyError(err) })
    } finally {
      setBusy(false)
    }
  }

  async function persist(values: BlockedDateFormValues) {
    const id = await saveBlockedDate(values, editing?.id)
    let affected: LessonWithStudent[] = []
    try {
      affected = await listLessonsCanceledByBlock(id)
    } catch {
      affected = []
    }
    setFeedback({ ok: true, text: 'Período salvo.' })
    setCanceled(affected)
    reset()
    list.refetch()
    counts.refetch()
  }

  const groups = list.data
    ? classifyBlockedDates(list.data, dayKey(new Date(), timezone))
    : null

  return (
    <div className="space-y-4">
      <PageHeader
        title="Férias e feriados"
        description="Dias bloqueados não recebem aulas na geração recorrente."
      />

      <Alert variant="info">
        As aulas já agendadas nesse período são canceladas automaticamente como
        &quot;cancelada pela professora&quot;, com direito a reposição (não contam no
        limite mensal do aluno). Excluir o período não reativa essas aulas: elas continuam
        canceladas e a reposição segue valendo.
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
      </div>

      {canceled && canceled.length > 0 ? (
        <section
          aria-label="Aulas canceladas automaticamente"
          className="space-y-3 rounded-xl border bg-card p-4 shadow-sm"
        >
          <h2 className="font-semibold">{canceledSummaryTitle(canceled.length)}</h2>
          <p className="text-sm text-muted-foreground">
            Agende a reposição de cada uma abaixo.
          </p>
          <MakeupToScheduleList
            lessons={canceled.filter((l) => l.status === 'cancelada_professora')}
            timezone={timezone}
            showReason={false}
            onChanged={() => {
              const id = canceled[0]?.blocked_date_id
              if (id) {
                void listLessonsCanceledByBlock(id)
                  .then(setCanceled)
                  .catch(() => undefined)
              }
            }}
          />
        </section>
      ) : null}

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
            counts={counts.data}
          />
          <Group
            title="Próximos"
            items={groups.futuras}
            onEdit={startEdit}
            onDelete={setDeleting}
            counts={counts.data}
          />
          <Group
            title="Passados"
            items={groups.passadas}
            onEdit={startEdit}
            onDelete={setDeleting}
            counts={counts.data}
          />
        </>
      )}

      {confirmSave ? (
        <ConfirmDialog
          title="Cancelar aulas do período"
          description={blockPreviewMessage(confirmSave.count)}
          confirmLabel="Salvar e cancelar aulas"
          onConfirm={() => persist(confirmSave.values)}
          onClose={() => setConfirmSave(null)}
        />
      ) : null}

      {deleting ? (
        <ConfirmDialog
          title="Excluir período"
          description={`Excluir o período ${formatBlockedRange(deleting.starts_on, deleting.ends_on)}${deleting.reason ? ` (${deleting.reason})` : ''}? Ao gerar aulas de novo, esses dias voltam a receber aulas; as aulas já canceladas por ele continuam canceladas.`}
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
  counts,
}: {
  title: string
  items: BlockedDate[]
  onEdit: (b: BlockedDate) => void
  onDelete: (b: BlockedDate) => void
  counts?: Map<string, number>
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
                {counts?.get(b.id) ? (
                  <p className="text-sm text-muted-foreground">
                    {counts.get(b.id)}{' '}
                    {counts.get(b.id) === 1 ? 'aula cancelada' : 'aulas canceladas'}
                  </p>
                ) : null}
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
