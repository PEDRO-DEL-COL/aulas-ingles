import { ExternalLink, Pencil, Plus, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'

import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Input, Label, Select, Textarea } from '@/components/ui/field'
import { safeExternalUrl } from '@/features/aluno/lessons'
import { MATERIAL_TYPES } from '@/features/aluno/components/materialTypes'
import { listStudents } from '@/features/professora/api'
import {
  validateMaterialForm,
  type MaterialFormErrors,
  type MaterialTarget,
} from '@/features/professora/blocked'
import { ConfirmDialog } from '@/features/professora/components/ConfirmDialog'
import { FormField } from '@/features/professora/components/FormField'
import {
  createMaterial,
  deleteMaterial,
  listAllMaterials,
  listStudentLessonsForPicker,
  updateMaterial,
  type MaterialWithTarget,
} from '@/features/professora/materialsApi'
import { useProfileId } from '@/features/professora/useProfileId'
import { useTimezone } from '@/features/professora/useTimezone'
import {
  EmptyState,
  ErrorState,
  ListSkeleton,
  PageHeader,
} from '@/features/shared/components/StateViews'
import { formatDate, formatDateTime } from '@/features/shared/datetime'
import { friendlyError } from '@/features/shared/errors'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useQuery } from '@/lib/data/useQuery'

type Filter = 'todos' | 'geral' | 'aluno' | 'aula'
type MaterialType = MaterialWithTarget['type']

function kindOf(m: MaterialWithTarget): 'geral' | 'aluno' | 'aula' {
  if (m.lesson_id) return 'aula'
  if (m.student_id) return 'aluno'
  return 'geral'
}

function normalize(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

export default function Materiais() {
  useDocumentTitle('Materiais')
  const timezone = useTimezone()
  const materials = useQuery('prof-materiais', listAllMaterials)
  const [filter, setFilter] = useState<Filter>('todos')
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<MaterialWithTarget | 'novo' | null>(null)
  const [deleting, setDeleting] = useState<MaterialWithTarget | null>(null)

  function targetLabel(m: MaterialWithTarget): string {
    const kind = kindOf(m)
    if (kind === 'geral') return 'Todos os alunos'
    if (kind === 'aluno') return `Aluno: ${m.student_name ?? 'sem nome'}`
    const day = m.lesson_starts_at
      ? formatDate(m.lesson_starts_at, timezone).slice(0, 5)
      : ''
    return `Aula${day ? ` de ${day}` : ''} · ${m.student_name ?? 'aluno'}`
  }

  const q = normalize(search.trim())
  const filtered = (materials.data ?? []).filter((m) => {
    if (filter !== 'todos' && kindOf(m) !== filter) return false
    if (q === '') return true
    return normalize(
      `${m.title} ${m.description ?? ''} ${m.student_name ?? ''}`,
    ).includes(q)
  })

  return (
    <div className="space-y-4">
      <PageHeader
        title="Materiais"
        description="Links de apostilas, áudios, vídeos e outros materiais para os alunos."
      />

      <Alert variant="info">
        Os arquivos ficam no Google Drive; aqui vai só o link. Antes de adicionar,
        compartilhe o arquivo no Drive com &quot;qualquer pessoa com o link&quot; ou com o
        e-mail do aluno, senão ele não conseguirá abrir.
      </Alert>

      <div className="flex justify-end">
        <Button onClick={() => setEditing('novo')}>
          <Plus aria-hidden="true" />
          Novo material
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-[1fr_12rem]">
        <div className="space-y-1.5">
          <Label htmlFor="mat-busca">Buscar</Label>
          <Input
            id="mat-busca"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Título, descrição ou aluno"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="mat-filtro">Mostrar</Label>
          <Select
            id="mat-filtro"
            value={filter}
            onChange={(e) => setFilter(e.target.value as Filter)}
          >
            <option value="todos">Todos</option>
            <option value="geral">Gerais</option>
            <option value="aluno">Por aluno</option>
            <option value="aula">Por aula</option>
          </Select>
        </div>
      </div>

      {materials.error ? (
        <ErrorState error={materials.error} onRetry={materials.refetch} />
      ) : !materials.data ? (
        <ListSkeleton />
      ) : materials.data.length === 0 ? (
        <EmptyState title="Nenhum material ainda">
          Toque em &quot;Novo material&quot; para adicionar o primeiro link.
        </EmptyState>
      ) : filtered.length === 0 ? (
        <EmptyState title="Nenhum material encontrado">
          Tente outra busca ou mude o filtro.
        </EmptyState>
      ) : (
        <ul className="space-y-2" aria-label="Materiais">
          {filtered.map((m) => {
            const { icon: Icon, label } = MATERIAL_TYPES[m.type]
            const href = safeExternalUrl(m.url)
            return (
              <li
                key={m.id}
                className="flex items-start gap-3 rounded-xl border bg-card p-3 text-card-foreground shadow-sm"
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-lavender text-primary">
                  <Icon aria-hidden={true} className="size-5" />
                </span>
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="font-medium break-words">{m.title}</p>
                  <div className="flex flex-wrap gap-1.5">
                    <Badge tone={kindOf(m) === 'geral' ? 'info' : 'muted'}>
                      {targetLabel(m)}
                    </Badge>
                    <Badge tone="outline">{label}</Badge>
                  </div>
                  {m.description ? (
                    <p className="line-clamp-2 text-sm text-muted-foreground">
                      {m.description}
                    </p>
                  ) : null}
                  <p className="text-xs text-muted-foreground">
                    Criado em {formatDateTime(m.created_at, timezone)}
                  </p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {href ? (
                      <Button asChild variant="outline" size="sm">
                        <a href={href} target="_blank" rel="noopener noreferrer">
                          <ExternalLink aria-hidden="true" />
                          Abrir
                          <span className="sr-only">{m.title} (abre em nova aba)</span>
                        </a>
                      </Button>
                    ) : (
                      <span className="self-center text-xs text-destructive">
                        Link inválido
                      </span>
                    )}
                    <Button variant="outline" size="sm" onClick={() => setEditing(m)}>
                      <Pencil aria-hidden="true" />
                      Editar<span className="sr-only"> {m.title}</span>
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setDeleting(m)}>
                      <Trash2 aria-hidden="true" />
                      Excluir<span className="sr-only"> {m.title}</span>
                    </Button>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {editing ? (
        <MaterialDialog
          key={editing === 'novo' ? 'novo' : editing.id}
          material={editing === 'novo' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            materials.refetch()
          }}
        />
      ) : null}

      {deleting ? (
        <ConfirmDialog
          title="Excluir material"
          description={`Excluir "${deleting.title}"? Os alunos deixam de ver este material. O arquivo no Google Drive não é apagado.`}
          confirmLabel="Excluir"
          onConfirm={async () => {
            await deleteMaterial(deleting.id)
            materials.refetch()
          }}
          onClose={() => setDeleting(null)}
        />
      ) : null}
    </div>
  )
}

function MaterialDialog({
  material,
  onClose,
  onSaved,
}: {
  material: MaterialWithTarget | null
  onClose: () => void
  onSaved: () => void
}) {
  const profileId = useProfileId()
  const timezone = useTimezone()
  const isEdit = material !== null
  const [title, setTitle] = useState(material?.title ?? '')
  const [type, setType] = useState<MaterialType>(material?.type ?? 'drive')
  const [url, setUrl] = useState(material?.url ?? '')
  const [description, setDescription] = useState(material?.description ?? '')
  const [targetKind, setTargetKind] = useState('geral')
  const [studentId, setStudentId] = useState('')
  const [lessonId, setLessonId] = useState('')
  const [errors, setErrors] = useState<MaterialFormErrors>({})
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const students = useQuery('prof-materiais-alunos', listStudents)
  const needsLessons = !isEdit && targetKind === 'aula' && studentId !== ''
  const lessons = useQuery(`prof-materiais-aulas:${needsLessons ? studentId : ''}`, () =>
    needsLessons ? listStudentLessonsForPicker(studentId) : Promise.resolve([]),
  )

  async function submit(e: FormEvent) {
    e.preventDefault()
    const found = validateMaterialForm({
      title,
      url,
      description,
      targetKind: isEdit ? 'geral' : targetKind,
      studentId,
      lessonId,
    })
    setErrors(found)
    setFormError(null)
    if (Object.keys(found).length > 0) return
    setBusy(true)
    try {
      if (material) {
        await updateMaterial(material.id, { title, type, url, description })
      } else {
        const target: MaterialTarget =
          targetKind === 'aluno'
            ? { kind: 'aluno', studentId }
            : targetKind === 'aula'
              ? { kind: 'aula', lessonId }
              : { kind: 'geral' }
        await createMaterial({ title, type, url, description, target }, profileId)
      }
      onSaved()
    } catch (err) {
      setFormError(friendlyError(err))
      setBusy(false)
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={isEdit ? 'Editar material' : 'Novo material'}
      dismissible={!busy}
    >
      <form onSubmit={(e) => void submit(e)} className="space-y-3" noValidate>
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
        <FormField
          label="Link do Google Drive (ou outro)"
          error={errors.url}
          help='No Drive, compartilhe o arquivo com "qualquer pessoa com o link" ou com o e-mail do aluno.'
        >
          {(p) => (
            <Input
              {...p}
              type="url"
              inputMode="url"
              placeholder="https://drive.google.com/..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          )}
        </FormField>
        <FormField label="Tipo">
          {(p) => (
            <Select
              {...p}
              value={type}
              onChange={(e) => setType(e.target.value as MaterialType)}
            >
              {(Object.keys(MATERIAL_TYPES) as MaterialType[]).map((t) => (
                <option key={t} value={t}>
                  {MATERIAL_TYPES[t].label}
                </option>
              ))}
            </Select>
          )}
        </FormField>
        <FormField label="Descrição (opcional)" error={errors.description}>
          {(p) => (
            <Textarea
              {...p}
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          )}
        </FormField>

        {isEdit ? (
          <p className="text-sm text-muted-foreground">
            Para mudar para quem é o material, exclua e crie de novo.
          </p>
        ) : (
          <>
            <FormField label="Para quem?" error={errors.targetKind}>
              {(p) => (
                <Select
                  {...p}
                  value={targetKind}
                  onChange={(e) => {
                    setTargetKind(e.target.value)
                    setLessonId('')
                  }}
                >
                  <option value="geral">Geral para todos os alunos</option>
                  <option value="aluno">Um aluno</option>
                  <option value="aula">Uma aula</option>
                </Select>
              )}
            </FormField>
            {targetKind !== 'geral' ? (
              <FormField label="Aluno" error={errors.studentId}>
                {(p) => (
                  <Select
                    {...p}
                    value={studentId}
                    disabled={!students.data}
                    onChange={(e) => {
                      setStudentId(e.target.value)
                      setLessonId('')
                    }}
                  >
                    <option value="">
                      {students.data ? 'Escolha o aluno' : 'Carregando…'}
                    </option>
                    {(students.data ?? []).map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.full_name}
                      </option>
                    ))}
                  </Select>
                )}
              </FormField>
            ) : null}
            {targetKind === 'aula' && studentId !== '' ? (
              <FormField label="Aula" error={errors.lessonId}>
                {(p) => (
                  <Select
                    {...p}
                    value={lessonId}
                    disabled={!lessons.data}
                    onChange={(e) => setLessonId(e.target.value)}
                  >
                    <option value="">
                      {lessons.data
                        ? lessons.data.length === 0
                          ? 'Este aluno não tem aulas'
                          : 'Escolha a aula'
                        : 'Carregando…'}
                    </option>
                    {(lessons.data ?? []).map((l) => (
                      <option key={l.id} value={l.id}>
                        {formatDateTime(l.starts_at, timezone)}
                      </option>
                    ))}
                  </Select>
                )}
              </FormField>
            ) : null}
          </>
        )}

        {formError ? <Alert variant="destructive">{formError}</Alert> : null}
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
