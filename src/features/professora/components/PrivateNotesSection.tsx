import { EyeOff, Pencil, Plus, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'

import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardTitle } from '@/components/ui/card'
import { Dialog } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/field'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/features/shared/components/StateViews'
import { formatDateTime } from '@/features/shared/datetime'
import { useQuery } from '@/lib/data/useQuery'

import {
  deletePrivateNote,
  listPrivateNotes,
  savePrivateNote,
  type PrivateNote,
} from '../api'
import { useProfileId } from '../useProfileId'
import { ConfirmDialog } from './ConfirmDialog'
import { FormField } from './FormField'

function NoteDialog({
  studentId,
  note,
  onClose,
  onSaved,
}: {
  studentId: string
  note: PrivateNote | null
  onClose: () => void
  onSaved: () => void
}) {
  const profileId = useProfileId()
  const [body, setBody] = useState(note?.body ?? '')
  const [fieldError, setFieldError] = useState<string | undefined>()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (body.trim() === '') {
      setFieldError('Escreva a anotação.')
      return
    }
    setFieldError(undefined)
    setBusy(true)
    setError(null)
    try {
      await savePrivateNote(note?.id ?? null, { studentId, body, profileId })
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
      title={note ? 'Editar anotação' : 'Nova anotação'}
      dismissible={!busy}
    >
      <form onSubmit={(e) => void submit(e)} noValidate className="space-y-3">
        <Alert variant="info" role="note">
          Visível só para você. O aluno nunca vê esta anotação.
        </Alert>
        <FormField label="Anotação" error={fieldError}>
          {(p) => (
            <Textarea
              {...p}
              value={body}
              maxLength={8000}
              className="min-h-32"
              onChange={(e) => setBody(e.target.value)}
            />
          )}
        </FormField>
        {error ? <Alert variant="destructive">{error}</Alert> : null}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? 'Salvando…' : 'Salvar'}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}

export function PrivateNotesSection({
  studentId,
  timezone,
}: {
  studentId: string
  timezone: string
}) {
  const notes = useQuery(`prof-notas:${studentId}`, () => listPrivateNotes(studentId))
  const [editing, setEditing] = useState<PrivateNote | 'new' | null>(null)
  const [removing, setRemoving] = useState<PrivateNote | null>(null)

  return (
    <Card>
      <div className="flex items-center justify-between gap-2">
        <CardTitle>Anotações privadas</CardTitle>
        <Button size="sm" variant="outline" onClick={() => setEditing('new')}>
          <Plus aria-hidden="true" />
          Adicionar
        </Button>
      </div>
      <CardDescription className="flex items-center gap-1.5">
        <EyeOff aria-hidden="true" className="size-4" />
        Visível só para você.
      </CardDescription>
      {notes.error ? (
        <ErrorState error={notes.error} onRetry={notes.refetch} />
      ) : !notes.data ? (
        <Skeleton className="h-16 w-full" />
      ) : notes.data.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma anotação ainda.</p>
      ) : (
        <ul className="space-y-3">
          {notes.data.map((n) => (
            <li key={n.id} className="rounded-lg border bg-background p-3">
              <p className="text-sm whitespace-pre-wrap">{n.body}</p>
              <div className="mt-2 flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">
                  {formatDateTime(n.created_at, timezone)}
                  {n.lesson_id ? ' (de uma aula)' : ''}
                </span>
                <span className="flex">
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Editar anotação"
                    onClick={() => setEditing(n)}
                  >
                    <Pencil aria-hidden="true" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Excluir anotação"
                    onClick={() => setRemoving(n)}
                  >
                    <Trash2 aria-hidden="true" />
                  </Button>
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
      {editing ? (
        <NoteDialog
          studentId={studentId}
          note={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={notes.refetch}
        />
      ) : null}
      {removing ? (
        <ConfirmDialog
          title="Excluir anotação?"
          description="Esta anotação será apagada definitivamente."
          confirmLabel="Excluir"
          onClose={() => setRemoving(null)}
          onConfirm={async () => {
            await deletePrivateNote(removing.id)
            notes.refetch()
          }}
        />
      ) : null}
    </Card>
  )
}
