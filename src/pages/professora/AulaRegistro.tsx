import { ArrowLeft, EyeOff, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardTitle } from '@/components/ui/card'
import { Input, Select, Textarea } from '@/components/ui/field'
import { Skeleton } from '@/components/ui/skeleton'
import { safeExternalUrl } from '@/features/aluno/lessons'
import {
  addMaterial,
  deletePrivateNote,
  getLessonRecord,
  removeMaterial,
  savePrivateNote,
  saveLessonNote,
  setLessonStatus,
  type LessonRecord,
  type Material,
} from '@/features/professora/api'
import { FormField } from '@/features/professora/components/FormField'
import { TeacherStatusBadge } from '@/features/professora/components/TeacherStatusBadge'
import { useProfileId } from '@/features/professora/useProfileId'
import { useTimezone } from '@/features/professora/useTimezone'
import { isValidHttpUrl } from '@/features/professora/validation'
import { EmptyState, ErrorState } from '@/features/shared/components/StateViews'
import { formatDateTimeLong } from '@/features/shared/datetime'
import { friendlyError } from '@/features/shared/errors'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useQuery } from '@/lib/data/useQuery'

const MATERIAL_LABEL: Record<Material['type'], string> = {
  drive: 'Google Drive',
  pdf: 'PDF',
  audio: 'Áudio',
  video: 'Vídeo',
  link: 'Link',
  outro: 'Outro',
}

type Feedback = { ok: boolean; text: string } | null

function FeedbackAlert({ feedback }: { feedback: Feedback }) {
  if (!feedback) return null
  return (
    <Alert variant={feedback.ok ? 'success' : 'destructive'}>
      <AlertDescription>{feedback.text}</AlertDescription>
    </Alert>
  )
}

function AttendanceCard({
  record,
  onChanged,
}: {
  record: LessonRecord
  onChanged: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState<Feedback>(null)
  const { status } = record.lesson
  const canMark =
    status === 'agendada' ||
    status === 'reposicao' ||
    status === 'realizada' ||
    status === 'falta_aluno'

  async function mark(next: 'realizada' | 'falta_aluno') {
    setBusy(true)
    setFeedback(null)
    try {
      await setLessonStatus(record.lesson.id, next)
      onChanged()
    } catch (e) {
      setFeedback({ ok: false, text: friendlyError(e) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <CardTitle>Presença</CardTitle>
      {canMark ? (
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            variant={status === 'realizada' ? 'default' : 'outline'}
            aria-pressed={status === 'realizada'}
            disabled={busy}
            onClick={() => void mark('realizada')}
          >
            Aula realizada
          </Button>
          <Button
            variant={status === 'falta_aluno' ? 'destructive' : 'outline'}
            aria-pressed={status === 'falta_aluno'}
            disabled={busy}
            onClick={() => void mark('falta_aluno')}
          >
            Falta do aluno
          </Button>
        </div>
      ) : (
        <CardDescription>
          Esta aula está cancelada; a presença não se aplica.
        </CardDescription>
      )}
      <FeedbackAlert feedback={feedback} />
    </Card>
  )
}

function NoteCard({ record, onSaved }: { record: LessonRecord; onSaved: () => void }) {
  const profileId = useProfileId()
  const [content, setContent] = useState(record.note?.content ?? '')
  const [summary, setSummary] = useState(record.note?.summary ?? '')
  const [homework, setHomework] = useState(record.note?.homework ?? '')
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState<Feedback>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setFeedback(null)
    try {
      await saveLessonNote(record.lesson.id, { content, summary, homework }, profileId)
      setFeedback({ ok: true, text: 'Registro salvo.' })
      onSaved()
    } catch (err) {
      setFeedback({ ok: false, text: friendlyError(err) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <CardTitle>Registro da aula</CardTitle>
      <CardDescription>O aluno vê este registro no histórico.</CardDescription>
      <form onSubmit={(e) => void submit(e)} className="space-y-3">
        <FormField label="Conteúdo estudado">
          {(p) => (
            <Textarea
              {...p}
              value={content}
              maxLength={8000}
              onChange={(e) => setContent(e.target.value)}
            />
          )}
        </FormField>
        <FormField label="Resumo">
          {(p) => (
            <Textarea
              {...p}
              value={summary}
              maxLength={4000}
              onChange={(e) => setSummary(e.target.value)}
            />
          )}
        </FormField>
        <FormField label="Tarefa de casa">
          {(p) => (
            <Textarea
              {...p}
              value={homework}
              maxLength={4000}
              onChange={(e) => setHomework(e.target.value)}
            />
          )}
        </FormField>
        <FeedbackAlert feedback={feedback} />
        <Button type="submit" disabled={busy} className="w-full sm:w-auto">
          {busy ? 'Salvando…' : 'Salvar registro'}
        </Button>
      </form>
    </Card>
  )
}

function PrivateNoteCard({
  record,
  onChanged,
}: {
  record: LessonRecord
  onChanged: () => void
}) {
  const profileId = useProfileId()
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState<Feedback>(null)

  async function add(e: FormEvent) {
    e.preventDefault()
    if (body.trim() === '') return
    setBusy(true)
    setFeedback(null)
    try {
      await savePrivateNote(null, {
        studentId: record.lesson.student_id,
        lessonId: record.lesson.id,
        body,
        profileId,
      })
      setBody('')
      onChanged()
    } catch (err) {
      setFeedback({ ok: false, text: friendlyError(err) })
    } finally {
      setBusy(false)
    }
  }

  async function remove(id: string) {
    try {
      await deletePrivateNote(id)
      onChanged()
    } catch (err) {
      setFeedback({ ok: false, text: friendlyError(err) })
    }
  }

  return (
    <Card>
      <CardTitle>Anotação privada</CardTitle>
      <CardDescription className="flex items-center gap-1.5">
        <EyeOff aria-hidden="true" className="size-4" />
        Visível só para você. Opcional.
      </CardDescription>
      {record.privateNotes.length > 0 ? (
        <ul className="space-y-2">
          {record.privateNotes.map((n) => (
            <li
              key={n.id}
              className="flex items-start justify-between gap-2 rounded-lg border bg-background p-3"
            >
              <p className="text-sm whitespace-pre-wrap">{n.body}</p>
              <Button
                size="icon"
                variant="ghost"
                aria-label="Excluir anotação"
                onClick={() => void remove(n.id)}
              >
                <Trash2 aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
      <form onSubmit={(e) => void add(e)} className="space-y-3">
        <FormField label="Nova anotação">
          {(p) => (
            <Textarea
              {...p}
              value={body}
              maxLength={8000}
              onChange={(e) => setBody(e.target.value)}
            />
          )}
        </FormField>
        <FeedbackAlert feedback={feedback} />
        <Button
          type="submit"
          variant="outline"
          disabled={busy || body.trim() === ''}
          className="w-full sm:w-auto"
        >
          {busy ? 'Salvando…' : 'Adicionar anotação'}
        </Button>
      </form>
    </Card>
  )
}

function MaterialsCard({
  record,
  onChanged,
}: {
  record: LessonRecord
  onChanged: () => void
}) {
  const profileId = useProfileId()
  const [title, setTitle] = useState('')
  const [type, setType] = useState<Material['type']>('link')
  const [url, setUrl] = useState('')
  const [errors, setErrors] = useState<{ title?: string; url?: string }>({})
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState<Feedback>(null)

  async function add(e: FormEvent) {
    e.preventDefault()
    const found: { title?: string; url?: string } = {}
    if (title.trim() === '') found.title = 'Informe o título.'
    if (!isValidHttpUrl(url)) found.url = 'Informe um link válido, começando com https://'
    setErrors(found)
    if (Object.keys(found).length > 0) return
    setBusy(true)
    setFeedback(null)
    try {
      await addMaterial({
        lessonId: record.lesson.id,
        studentId: record.lesson.student_id,
        title,
        type,
        url,
        profileId,
      })
      setTitle('')
      setUrl('')
      onChanged()
    } catch (err) {
      setFeedback({ ok: false, text: friendlyError(err) })
    } finally {
      setBusy(false)
    }
  }

  async function remove(id: string) {
    try {
      await removeMaterial(id)
      onChanged()
    } catch (err) {
      setFeedback({ ok: false, text: friendlyError(err) })
    }
  }

  return (
    <Card>
      <CardTitle>Materiais da aula</CardTitle>
      <CardDescription>
        Links do Drive, PDFs, áudios e outros. O aluno vê estes materiais.
      </CardDescription>
      {record.materials.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum material nesta aula.</p>
      ) : (
        <ul className="divide-y">
          {record.materials.map((m) => {
            const href = safeExternalUrl(m.url)
            return (
              <li key={m.id} className="flex items-center justify-between gap-2 py-2">
                <div className="min-w-0 text-sm">
                  <p className="truncate font-semibold">
                    {href ? (
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary underline-offset-4 hover:underline"
                      >
                        {m.title}
                        <span className="sr-only"> (abre em nova aba)</span>
                      </a>
                    ) : (
                      m.title
                    )}
                  </p>
                  <p className="text-muted-foreground">{MATERIAL_LABEL[m.type]}</p>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={`Remover ${m.title}`}
                  onClick={() => void remove(m.id)}
                >
                  <Trash2 aria-hidden="true" />
                </Button>
              </li>
            )
          })}
        </ul>
      )}
      <form onSubmit={(e) => void add(e)} noValidate className="space-y-3 border-t pt-3">
        <FormField label="Título" error={errors.title}>
          {(p) => (
            <Input
              {...p}
              value={title}
              maxLength={200}
              onChange={(e) => setTitle(e.target.value)}
            />
          )}
        </FormField>
        <FormField label="Tipo">
          {(p) => (
            <Select
              {...p}
              value={type}
              onChange={(e) => setType(e.target.value as Material['type'])}
            >
              {Object.entries(MATERIAL_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          )}
        </FormField>
        <FormField label="Link" error={errors.url}>
          {(p) => (
            <Input
              {...p}
              type="url"
              inputMode="url"
              value={url}
              placeholder="https://"
              onChange={(e) => setUrl(e.target.value)}
            />
          )}
        </FormField>
        <FeedbackAlert feedback={feedback} />
        <Button
          type="submit"
          variant="outline"
          disabled={busy}
          className="w-full sm:w-auto"
        >
          {busy ? 'Adicionando…' : 'Adicionar material'}
        </Button>
      </form>
    </Card>
  )
}

export default function AulaRegistro() {
  const { id = '' } = useParams()
  const timezone = useTimezone()
  useDocumentTitle('Registro da aula')
  const record = useQuery(`prof-aula:${id}`, () => getLessonRecord(id))

  return (
    <div className="space-y-4">
      <Link
        to="/app/professora/agenda"
        className="inline-flex items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        Agenda
      </Link>

      {record.error ? (
        <ErrorState error={record.error} onRetry={record.refetch} />
      ) : record.data === undefined ? (
        <div role="status" className="space-y-3">
          <span className="sr-only">Carregando…</span>
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      ) : record.data === null ? (
        <EmptyState title="Aula não encontrada">
          Ela pode ter sido removida. Volte para a agenda.
        </EmptyState>
      ) : (
        <>
          <header className="space-y-1">
            <h1 className="text-2xl font-bold">
              {record.data.student?.full_name ?? 'Registro da aula'}
            </h1>
            <p className="text-muted-foreground first-letter:uppercase">
              {formatDateTimeLong(record.data.lesson.starts_at, timezone)}
            </p>
            <TeacherStatusBadge status={record.data.lesson.status} />
          </header>
          <AttendanceCard record={record.data} onChanged={record.refetch} />
          <NoteCard record={record.data} onSaved={record.refetch} />
          <PrivateNoteCard record={record.data} onChanged={record.refetch} />
          <MaterialsCard record={record.data} onChanged={record.refetch} />
        </>
      )}
    </div>
  )
}
