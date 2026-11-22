import { ArrowDown, ArrowUp, Plus } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'

import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog } from '@/components/ui/dialog'
import { Input, Textarea } from '@/components/ui/field'
import { ConfirmDialog } from '@/features/professora/components/ConfirmDialog'
import { FormField } from '@/features/professora/components/FormField'
import {
  BIO_MAX,
  HEADLINE_MAX,
  ITEMS_MAX,
  NAME_MAX,
  POSITION_MAX,
  TESTIMONIAL_BODY_MAX,
  TESTIMONIAL_CONTEXT_MAX,
  TESTIMONIAL_NAME_MAX,
  emptyTestimonialForm,
  linesToText,
  validateProfile,
  validateTestimonial,
  type ProfileForm,
  type TestimonialForm,
} from '@/features/professora/siteContent'
import {
  createTestimonial,
  deleteTestimonial,
  getTeacherProfile,
  listTestimonials,
  saveTeacherProfile,
  updateTestimonial,
  type TeacherProfile,
  type Testimonial,
} from '@/features/professora/siteContentApi'
import {
  EmptyState,
  ErrorState,
  ListSkeleton,
  PageHeader,
} from '@/features/shared/components/StateViews'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useQuery } from '@/lib/data/useQuery'

type Feedback = { ok: boolean; text: string } | null

function errText(e: unknown): string {
  return e instanceof Error ? e.message : 'Não foi possível concluir.'
}

function formFromProfile(p: TeacherProfile | null): ProfileForm {
  return {
    display_name: p?.display_name ?? '',
    headline: p?.headline ?? '',
    bio: p?.bio ?? '',
    education: linesToText(p?.education ?? []),
    experience: linesToText(p?.experience ?? []),
    certifications: linesToText(p?.certifications ?? []),
    languages: linesToText(p?.languages ?? []),
    photo_url: p?.photo_url ?? '',
    published: p?.published ?? false,
  }
}

const LIST_HELP = `Um item por linha (até ${ITEMS_MAX}).`

function ProfileSection({
  profile,
  onSaved,
}: {
  profile: TeacherProfile | null
  onSaved: () => void
}) {
  const [form, setForm] = useState<ProfileForm>(() => formFromProfile(profile))
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState<Feedback>(null)
  const [photoBroken, setPhotoBroken] = useState(false)

  const set = <K extends keyof ProfileForm>(key: K, value: ProfileForm[K]) => {
    setForm((f) => ({ ...f, [key]: value }))
    setFeedback(null)
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    const result = validateProfile(form)
    if (!result.ok) {
      setFeedback({ ok: false, text: result.error })
      return
    }
    setBusy(true)
    setFeedback(null)
    try {
      await saveTeacherProfile(result.value)
      setFeedback({ ok: true, text: 'Currículo salvo.' })
      onSaved()
    } catch (err) {
      setFeedback({ ok: false, text: errText(err) })
    } finally {
      setBusy(false)
    }
  }

  const photo = form.photo_url.trim()
  const showPhoto = /^https:\/\/\S+$/.test(photo) && !photoBroken

  return (
    <Card>
      <h2 className="text-lg font-semibold">Sobre você (currículo)</h2>
      <form className="space-y-4" onSubmit={(e) => void submit(e)} noValidate>
        <FormField label="Nome de exibição">
          {(p) => (
            <Input
              {...p}
              value={form.display_name}
              maxLength={NAME_MAX}
              onChange={(e) => set('display_name', e.target.value)}
            />
          )}
        </FormField>
        <FormField label="Chamada (frase curta)">
          {(p) => (
            <Input
              {...p}
              value={form.headline}
              maxLength={HEADLINE_MAX}
              placeholder="Ex.: Professora de inglês para adultos"
              onChange={(e) => set('headline', e.target.value)}
            />
          )}
        </FormField>
        <FormField label="Apresentação" help={`${form.bio.length}/${BIO_MAX}`}>
          {(p) => (
            <Textarea
              {...p}
              className="min-h-32"
              value={form.bio}
              maxLength={BIO_MAX}
              onChange={(e) => set('bio', e.target.value)}
            />
          )}
        </FormField>
        <FormField label="Formação" help={LIST_HELP}>
          {(p) => (
            <Textarea
              {...p}
              value={form.education}
              onChange={(e) => set('education', e.target.value)}
            />
          )}
        </FormField>
        <FormField label="Experiência" help={LIST_HELP}>
          {(p) => (
            <Textarea
              {...p}
              value={form.experience}
              onChange={(e) => set('experience', e.target.value)}
            />
          )}
        </FormField>
        <FormField label="Certificações" help={LIST_HELP}>
          {(p) => (
            <Textarea
              {...p}
              value={form.certifications}
              onChange={(e) => set('certifications', e.target.value)}
            />
          )}
        </FormField>
        <FormField label="Idiomas" help={LIST_HELP}>
          {(p) => (
            <Textarea
              {...p}
              value={form.languages}
              onChange={(e) => set('languages', e.target.value)}
            />
          )}
        </FormField>
        <FormField
          label="Link da foto (opcional)"
          help="Endereço https:// de uma imagem pública. A foto não é guardada aqui."
        >
          {(p) => (
            <Input
              {...p}
              type="url"
              inputMode="url"
              value={form.photo_url}
              placeholder="https://"
              onChange={(e) => {
                setPhotoBroken(false)
                set('photo_url', e.target.value)
              }}
            />
          )}
        </FormField>
        {showPhoto ? (
          <img
            src={photo}
            alt="Prévia da foto"
            className="size-20 rounded-full border object-cover"
            referrerPolicy="no-referrer"
            onError={() => setPhotoBroken(true)}
          />
        ) : photo !== '' && photoBroken ? (
          <p className="text-xs text-destructive">
            Não foi possível carregar a imagem desse link.
          </p>
        ) : null}

        <label className="flex items-start gap-3 rounded-lg border bg-muted/40 p-3">
          <input
            type="checkbox"
            role="switch"
            className="mt-1 size-4 shrink-0"
            checked={form.published}
            onChange={(e) => set('published', e.target.checked)}
          />
          <span className="text-sm">
            <span className="block font-medium">Publicar na página inicial</span>
            <span className="block text-muted-foreground">
              Desligado, a página inicial mostra um exemplo no lugar do seu currículo.
              Ligado, mostra o que está acima.
            </span>
          </span>
        </label>

        {feedback ? (
          <Alert variant={feedback.ok ? 'success' : 'destructive'}>{feedback.text}</Alert>
        ) : null}
        <Button type="submit" disabled={busy}>
          {busy ? 'Salvando…' : 'Salvar currículo'}
        </Button>
      </form>
    </Card>
  )
}

function TestimonialDialog({
  initial,
  nextPosition,
  onSaved,
  onClose,
}: {
  initial: Testimonial | null
  nextPosition: number
  onSaved: () => void
  onClose: () => void
}) {
  const [form, setForm] = useState<TestimonialForm>(() =>
    initial
      ? {
          author_name: initial.author_name,
          author_context: initial.author_context ?? '',
          body: initial.body,
          rating: initial.rating?.toString() ?? '',
          position: String(initial.position),
        }
      : emptyTestimonialForm(nextPosition),
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const set = <K extends keyof TestimonialForm>(key: K, value: TestimonialForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  async function submit(e: FormEvent) {
    e.preventDefault()
    const result = validateTestimonial(form)
    if (!result.ok) {
      setError(result.error)
      return
    }
    setBusy(true)
    setError(null)
    try {
      if (initial) await updateTestimonial(initial.id, result.value)
      else await createTestimonial(result.value)
      onSaved()
      onClose()
    } catch (err) {
      setError(errText(err))
      setBusy(false)
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={initial ? 'Editar depoimento' : 'Novo depoimento'}
      dismissible={!busy}
    >
      <form className="space-y-4" onSubmit={(e) => void submit(e)} noValidate>
        {initial ? null : (
          <Alert variant="warning">
            O depoimento nasce como rascunho. Só publique com autorização do aluno.
          </Alert>
        )}
        <FormField label="Nome">
          {(p) => (
            <Input
              {...p}
              value={form.author_name}
              maxLength={TESTIMONIAL_NAME_MAX}
              onChange={(e) => set('author_name', e.target.value)}
            />
          )}
        </FormField>
        <FormField label="Complemento (opcional)" help="Ex.: Aluna desde 2024">
          {(p) => (
            <Input
              {...p}
              value={form.author_context}
              maxLength={TESTIMONIAL_CONTEXT_MAX}
              onChange={(e) => set('author_context', e.target.value)}
            />
          )}
        </FormField>
        <FormField
          label="Depoimento"
          help={`${form.body.length}/${TESTIMONIAL_BODY_MAX}`}
        >
          {(p) => (
            <Textarea
              {...p}
              value={form.body}
              maxLength={TESTIMONIAL_BODY_MAX}
              onChange={(e) => set('body', e.target.value)}
            />
          )}
        </FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Nota (1 a 5, opcional)">
            {(p) => (
              <Input
                {...p}
                type="number"
                inputMode="numeric"
                min={1}
                max={5}
                value={form.rating}
                onChange={(e) => set('rating', e.target.value)}
              />
            )}
          </FormField>
          <FormField label="Ordem" help="Menor aparece primeiro.">
            {(p) => (
              <Input
                {...p}
                type="number"
                inputMode="numeric"
                min={0}
                max={POSITION_MAX}
                value={form.position}
                onChange={(e) => set('position', e.target.value)}
              />
            )}
          </FormField>
        </div>
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

function TestimonialsSection() {
  const list = useQuery('prof-testimonials', listTestimonials)
  const [editing, setEditing] = useState<Testimonial | 'new' | null>(null)
  const [deleting, setDeleting] = useState<Testimonial | null>(null)
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState<Feedback>(null)

  const all = list.data
  const publishedCount = all ? all.filter((t) => t.published).length : 0

  async function run(action: () => Promise<void>, okText: string) {
    setBusy(true)
    setFeedback(null)
    try {
      await action()
      setFeedback({ ok: true, text: okText })
    } catch (e) {
      setFeedback({ ok: false, text: errText(e) })
    } finally {
      setBusy(false)
      list.refetch()
    }
  }

  function move(index: number, delta: -1 | 1) {
    if (!all) return
    const target = index + delta
    if (target < 0 || target >= all.length) return
    const order = [...all]
    const item = order.splice(index, 1)
    order.splice(target, 0, ...item)
    void run(async () => {
      for (const [i, t] of order.entries()) {
        if (t.position !== i) await updateTestimonial(t.id, { position: i })
      }
    }, 'Ordem atualizada.')
  }

  return (
    <section className="space-y-3" aria-labelledby="depoimentos-titulo">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 id="depoimentos-titulo" className="text-lg font-semibold">
            Depoimentos
          </h2>
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {all ? `${publishedCount} publicados` : ' '}
          </p>
        </div>
        <Button size="sm" onClick={() => setEditing('new')}>
          <Plus aria-hidden="true" />
          Novo depoimento
        </Button>
      </div>
      <Alert variant="warning">
        Só publique com autorização do aluno. Todo depoimento novo começa como rascunho e
        só aparece na página inicial depois que você publicar.
      </Alert>

      {feedback ? (
        <Alert variant={feedback.ok ? 'success' : 'destructive'}>{feedback.text}</Alert>
      ) : null}

      {list.error ? (
        <ErrorState error={list.error} onRetry={list.refetch} />
      ) : !all ? (
        <ListSkeleton rows={2} />
      ) : all.length === 0 ? (
        <EmptyState title="Nenhum depoimento ainda">
          Use “Novo depoimento” para cadastrar o primeiro.
        </EmptyState>
      ) : (
        <ul className="space-y-3">
          {all.map((t, i) => (
            <li key={t.id}>
              <Card>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-semibold break-words">{t.author_name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {[
                        t.author_context,
                        t.rating ? `Nota ${t.rating}/5` : null,
                        `Ordem ${t.position}`,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  </div>
                  <Badge tone={t.published ? 'success' : 'muted'}>
                    {t.published ? 'Publicado' : 'Rascunho'}
                  </Badge>
                </div>
                <p className="rounded-md bg-muted p-3 text-sm break-words whitespace-pre-wrap">
                  {t.body}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant={t.published ? 'outline' : 'default'}
                    disabled={busy}
                    onClick={() =>
                      void run(
                        () => updateTestimonial(t.id, { published: !t.published }),
                        t.published ? 'Depoimento ocultado.' : 'Depoimento publicado.',
                      )
                    }
                  >
                    {t.published ? 'Ocultar' : 'Publicar'}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => setEditing(t)}
                  >
                    Editar
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-9"
                    aria-label={`Subir ${t.author_name}`}
                    disabled={busy || i === 0}
                    onClick={() => move(i, -1)}
                  >
                    <ArrowUp aria-hidden="true" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-9"
                    aria-label={`Descer ${t.author_name}`}
                    disabled={busy || i === all.length - 1}
                    onClick={() => move(i, 1)}
                  >
                    <ArrowDown aria-hidden="true" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    disabled={busy}
                    onClick={() => setDeleting(t)}
                  >
                    Excluir
                  </Button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {editing ? (
        <TestimonialDialog
          initial={editing === 'new' ? null : editing}
          nextPosition={all ? Math.min(all.length, POSITION_MAX) : 0}
          onSaved={list.refetch}
          onClose={() => setEditing(null)}
        />
      ) : null}
      {deleting ? (
        <ConfirmDialog
          title="Excluir depoimento?"
          description={`Excluir o depoimento de "${deleting.author_name}" é permanente. Se só quer tirá-lo da página inicial, prefira Ocultar.`}
          confirmLabel="Excluir depoimento"
          onConfirm={async () => {
            await deleteTestimonial(deleting.id)
            list.refetch()
          }}
          onClose={() => setDeleting(null)}
        />
      ) : null}
    </section>
  )
}

export default function SitePublico() {
  useDocumentTitle('Site')
  const profile = useQuery('prof-teacher-profile', getTeacherProfile)

  return (
    <div className="space-y-6">
      <Link
        to="/app/professora/mais"
        className="inline-block text-sm font-medium text-primary underline-offset-4 hover:underline"
      >
        Voltar para Mais
      </Link>
      <PageHeader
        title="Site: sobre e depoimentos"
        description="O que aparece na página inicial: seu currículo e os depoimentos dos alunos."
      />

      {profile.error ? (
        <ErrorState error={profile.error} onRetry={profile.refetch} />
      ) : profile.data === undefined ? (
        <ListSkeleton rows={2} />
      ) : (
        <ProfileSection profile={profile.data} onSaved={profile.refetch} />
      )}

      <TestimonialsSection />
    </div>
  )
}
