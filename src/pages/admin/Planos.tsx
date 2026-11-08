import { useRef, useState, type FormEvent } from 'react'

import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Input, Select, Textarea } from '@/components/ui/field'
import {
  createBenefit,
  deleteBenefit,
  listAllPlanBenefitLabels,
  listBenefits,
  listPlanBenefits,
  moveItem,
  renameBenefit,
  setPlanBenefits,
  validateBenefitLabel,
  type BenefitRow,
} from '@/features/admin/benefits'
import { deletePlan, listPlans, savePlan, type PlanRow } from '@/features/admin/settings'
import {
  centsToInput,
  validatePlanForm,
  type BillingModel,
  type PlanFormErrors,
  type PlanFormValues,
} from '@/features/admin/validation'
import { ConfirmDialog } from '@/features/professora/components/ConfirmDialog'
import { FormField } from '@/features/professora/components/FormField'
import {
  EmptyState,
  ErrorState,
  ListSkeleton,
  PageHeader,
} from '@/features/shared/components/StateViews'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useQuery } from '@/lib/data/useQuery'
import { formatBRL } from '@/lib/format'

const MODEL_LABEL: Record<BillingModel, string> = {
  mensalidade: 'Mensalidade',
  pacote: 'Pacote de aulas',
  avulsa: 'Aula avulsa',
}

function planSummary(p: PlanRow): string {
  const parts: string[] = []
  if (p.billing_model === 'mensalidade' && p.lessons_per_month)
    parts.push(`${p.lessons_per_month} aula(s) por mês`)
  if (p.billing_model === 'pacote' && p.lessons_in_package)
    parts.push(`${p.lessons_in_package} aula(s) no pacote`)
  parts.push(`${p.lesson_duration_minutes} min por aula`)
  return parts.join(' · ')
}

function emptyForm(): PlanFormValues {
  return {
    name: '',
    billing_model: 'mensalidade',
    lessons_per_month: '',
    lessons_in_package: '',
    lesson_duration_minutes: '50',
    price: '',
    description: '',
    active: true,
  }
}

function formFromPlan(p: PlanRow): PlanFormValues {
  return {
    name: p.name,
    billing_model: p.billing_model,
    lessons_per_month: p.lessons_per_month?.toString() ?? '',
    lessons_in_package: p.lessons_in_package?.toString() ?? '',
    lesson_duration_minutes: String(p.lesson_duration_minutes),
    price: centsToInput(p.price_cents),
    description: p.description ?? '',
    active: p.active,
  }
}

function BenefitsPicker({
  catalog,
  selected,
  onChange,
  onCreated,
  disabled,
}: {
  catalog: BenefitRow[]
  selected: string[]
  onChange: (ids: string[]) => void
  onCreated: () => void
  disabled: boolean
}) {
  const [newLabel, setNewLabel] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const byId = new Map(catalog.map((b) => [b.id, b]))
  const chosen = selected.filter((id) => byId.has(id))

  function toggle(id: string, on: boolean) {
    onChange(on ? [...selected, id] : selected.filter((x) => x !== id))
  }

  async function add() {
    const check = validateBenefitLabel(
      newLabel,
      catalog.map((b) => b.label),
    )
    if (check.error !== undefined) {
      setError(check.error)
      return
    }
    setError(null)
    setBusy(true)
    try {
      const created = await createBenefit(check.value)
      onChange([...selected, created.id])
      setNewLabel('')
      onCreated()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível criar a vantagem.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <fieldset className="space-y-3 rounded-lg border p-3" disabled={disabled}>
      <legend className="px-1 text-sm font-medium">Vantagens</legend>
      {catalog.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhuma vantagem cadastrada ainda. Crie a primeira abaixo.
        </p>
      ) : (
        <ul className="space-y-1">
          {catalog.map((b) => (
            <li key={b.id}>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-0.5 size-4"
                  checked={selected.includes(b.id)}
                  onChange={(e) => toggle(b.id, e.target.checked)}
                />
                {b.label}
              </label>
            </li>
          ))}
        </ul>
      )}

      {chosen.length > 1 ? (
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Ordem de exibição</p>
          <ol className="space-y-1">
            {chosen.map((id, i) => {
              const label = byId.get(id)?.label ?? ''
              return (
                <li
                  key={id}
                  className="flex items-center gap-2 rounded-md border px-2 py-1 text-sm"
                >
                  <span className="min-w-0 flex-1 truncate">
                    {i + 1}. {label}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-8 px-2"
                    disabled={i === 0}
                    aria-label={`Subir "${label}"`}
                    onClick={() => onChange(moveItem(chosen, i, -1))}
                  >
                    ↑
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-8 px-2"
                    disabled={i === chosen.length - 1}
                    aria-label={`Descer "${label}"`}
                    onClick={() => onChange(moveItem(chosen, i, 1))}
                  >
                    ↓
                  </Button>
                </li>
              )
            })}
          </ol>
        </div>
      ) : null}

      <FormField
        label="Nova vantagem"
        error={error ?? undefined}
        help="Até 120 caracteres."
      >
        {(p) => (
          <div className="flex gap-2">
            <Input
              {...p}
              value={newLabel}
              maxLength={120}
              onChange={(e) => setNewLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  void add()
                }
              }}
            />
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => void add()}
            >
              {busy ? 'Criando…' : 'Adicionar'}
            </Button>
          </div>
        )}
      </FormField>
    </fieldset>
  )
}

function BenefitsCatalog({
  onClose,
  onChanged,
}: {
  onClose: () => void
  onChanged: () => void
}) {
  const catalog = useQuery('benefits-catalog', listBenefits)
  const [editing, setEditing] = useState<{ id: string; label: string } | null>(null)
  const [deleting, setDeleting] = useState<BenefitRow | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const list = catalog.data ?? []

  async function saveRename() {
    if (!editing) return
    const check = validateBenefitLabel(
      editing.label,
      list.filter((b) => b.id !== editing.id).map((b) => b.label),
    )
    if (check.error !== undefined) {
      setError(check.error)
      return
    }
    setError(null)
    setBusy(true)
    try {
      await renameBenefit(editing.id, check.value)
      setEditing(null)
      catalog.refetch()
      onChanged()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível renomear.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Dialog
        open
        onClose={onClose}
        title="Catálogo de vantagens"
        className="max-h-[90dvh] max-w-lg overflow-y-auto"
      >
        {catalog.error ? (
          <ErrorState error={catalog.error} onRetry={catalog.refetch} />
        ) : !catalog.data ? (
          <ListSkeleton rows={2} />
        ) : list.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma vantagem cadastrada. Crie vantagens ao editar um plano.
          </p>
        ) : (
          <ul className="space-y-2">
            {list.map((b) => (
              <li key={b.id} className="rounded-lg border p-2">
                {editing?.id === b.id ? (
                  <div className="space-y-2">
                    <FormField label="Texto da vantagem">
                      {(p) => (
                        <Input
                          {...p}
                          value={editing.label}
                          maxLength={120}
                          onChange={(e) =>
                            setEditing({ id: b.id, label: e.target.value })
                          }
                        />
                      )}
                    </FormField>
                    <div className="flex gap-2">
                      <Button disabled={busy} onClick={() => void saveRename()}>
                        {busy ? 'Salvando…' : 'Salvar'}
                      </Button>
                      <Button
                        variant="outline"
                        disabled={busy}
                        onClick={() => {
                          setEditing(null)
                          setError(null)
                        }}
                      >
                        Cancelar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="min-w-0 text-sm">{b.label}</span>
                    <span className="flex gap-2">
                      <Button
                        variant="outline"
                        className="h-8"
                        onClick={() => {
                          setError(null)
                          setEditing({ id: b.id, label: b.label })
                        }}
                      >
                        Renomear<span className="sr-only"> {b.label}</span>
                      </Button>
                      <Button
                        variant="outline"
                        className="h-8"
                        onClick={() => {
                          setError(null)
                          setDeleting(b)
                        }}
                      >
                        Excluir<span className="sr-only"> {b.label}</span>
                      </Button>
                    </span>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
        {error ? <Alert variant="destructive">{error}</Alert> : null}
        <div className="flex justify-end">
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
        </div>
      </Dialog>
      {deleting ? (
        <ConfirmDialog
          title="Excluir vantagem?"
          description={`Excluir "${deleting.label}" remove esta vantagem de todos os planos. Isso não pode ser desfeito.`}
          confirmLabel="Excluir vantagem"
          onConfirm={async () => {
            await deleteBenefit(deleting.id)
            catalog.refetch()
            onChanged()
          }}
          onClose={() => setDeleting(null)}
        />
      ) : null}
    </>
  )
}

function PlanForm({
  plan,
  onSaved,
  onClose,
}: {
  plan: PlanRow | null
  onSaved: () => void
  onClose: () => void
}) {
  const [values, setValues] = useState<PlanFormValues>(() =>
    plan ? formFromPlan(plan) : emptyForm(),
  )
  const [errors, setErrors] = useState<PlanFormErrors>({})
  const [busy, setBusy] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const catalog = useQuery('benefits-catalog', listBenefits)
  const planId = plan?.id
  const current = useQuery(`plan-benefits:${planId ?? 'new'}`, () =>
    planId ? listPlanBenefits(planId) : Promise.resolve<string[]>([]),
  )
  // null = a pessoa não mexeu: vale o que veio do banco.
  const [selectedEdit, setSelectedEdit] = useState<string[] | null>(null)
  const selected = selectedEdit ?? current.data ?? []
  const benefitsReady = !!catalog.data && !!current.data
  // Evita criar o plano de novo se só a gravação das vantagens falhou.
  const savedId = useRef<string | undefined>(planId)

  function set<K extends keyof PlanFormValues>(key: K, value: PlanFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }))
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    setSubmitError(null)
    const result = validatePlanForm(values)
    setErrors(result.errors)
    if (!result.values) return
    setBusy(true)
    try {
      const saved = await savePlan(result.values, savedId.current)
      savedId.current = saved.id
      await setPlanBenefits(saved.id, selected)
      onSaved()
      onClose()
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : 'Não foi possível salvar o plano.',
      )
      setBusy(false)
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={plan ? 'Editar plano' : 'Novo plano'}
      dismissible={!busy}
      className="max-h-[90dvh] max-w-lg overflow-y-auto"
    >
      <form onSubmit={(e) => void submit(e)} noValidate className="space-y-3">
        <FormField label="Nome do plano" error={errors.name}>
          {(p) => (
            <Input
              {...p}
              value={values.name}
              maxLength={120}
              onChange={(e) => set('name', e.target.value)}
            />
          )}
        </FormField>
        <FormField label="Modelo de cobrança" error={errors.billing_model}>
          {(p) => (
            <Select
              {...p}
              value={values.billing_model}
              onChange={(e) => set('billing_model', e.target.value as BillingModel)}
            >
              <option value="mensalidade">Mensalidade</option>
              <option value="pacote">Pacote de aulas</option>
              <option value="avulsa">Aula avulsa</option>
            </Select>
          )}
        </FormField>
        {values.billing_model === 'mensalidade' ? (
          <FormField label="Aulas por mês" error={errors.lessons_per_month}>
            {(p) => (
              <Input
                {...p}
                inputMode="numeric"
                value={values.lessons_per_month}
                onChange={(e) => set('lessons_per_month', e.target.value)}
              />
            )}
          </FormField>
        ) : null}
        {values.billing_model === 'pacote' ? (
          <FormField label="Aulas no pacote" error={errors.lessons_in_package}>
            {(p) => (
              <Input
                {...p}
                inputMode="numeric"
                value={values.lessons_in_package}
                onChange={(e) => set('lessons_in_package', e.target.value)}
              />
            )}
          </FormField>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField
            label="Duração da aula (minutos)"
            error={errors.lesson_duration_minutes}
            help="De 5 a 480."
          >
            {(p) => (
              <Input
                {...p}
                inputMode="numeric"
                value={values.lesson_duration_minutes}
                onChange={(e) => set('lesson_duration_minutes', e.target.value)}
              />
            )}
          </FormField>
          <FormField label="Valor (R$)" error={errors.price} help="Ex.: 480,00">
            {(p) => (
              <Input
                {...p}
                inputMode="decimal"
                value={values.price}
                onChange={(e) => set('price', e.target.value)}
              />
            )}
          </FormField>
        </div>
        <FormField label="Descrição (opcional)" error={errors.description}>
          {(p) => (
            <Textarea
              {...p}
              value={values.description}
              maxLength={1000}
              onChange={(e) => set('description', e.target.value)}
            />
          )}
        </FormField>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="size-4"
            checked={values.active}
            onChange={(e) => set('active', e.target.checked)}
          />
          Plano ativo (disponível para novas fichas)
        </label>
        {catalog.error || current.error ? (
          <Alert variant="destructive">
            Não foi possível carregar as vantagens. Feche e tente de novo.
          </Alert>
        ) : catalog.data ? (
          <BenefitsPicker
            catalog={catalog.data}
            selected={selected}
            onChange={setSelectedEdit}
            onCreated={catalog.refetch}
            disabled={busy || !benefitsReady}
          />
        ) : (
          <p className="text-sm text-muted-foreground">Carregando vantagens…</p>
        )}
        {submitError ? <Alert variant="destructive">{submitError}</Alert> : null}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={busy || !benefitsReady}>
            {busy ? 'Salvando…' : 'Salvar plano'}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}

export default function Planos() {
  useDocumentTitle('Planos e valores')
  const plans = useQuery('admin-planos', listPlans)
  const [editing, setEditing] = useState<PlanRow | 'new' | null>(null)
  const [deleting, setDeleting] = useState<PlanRow | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [catalogOpen, setCatalogOpen] = useState(false)
  const planBenefits = useQuery('admin-plan-benefit-labels', listAllPlanBenefitLabels)

  async function toggleActive(p: PlanRow) {
    setActionError(null)
    setBusyId(p.id)
    try {
      await savePlan(
        {
          name: p.name,
          billing_model: p.billing_model,
          lessons_per_month: p.lessons_per_month,
          lessons_in_package: p.lessons_in_package,
          lesson_duration_minutes: p.lesson_duration_minutes,
          price_cents: p.price_cents,
          currency: p.currency,
          description: p.description,
          active: !p.active,
        },
        p.id,
      )
      plans.refetch()
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Não foi possível salvar.')
    } finally {
      setBusyId(null)
    }
  }

  const list = plans.data ?? []

  return (
    <div className="space-y-4">
      <PageHeader
        title="Planos e valores"
        description="Estes são os planos usados nas fichas dos alunos e nas cobranças. Os planos exibidos na página inicial do site ficam em src/config/brand.ts e são apenas divulgação."
      />

      <div className="flex flex-wrap gap-2">
        <Button
          onClick={() => {
            setActionError(null)
            setEditing('new')
          }}
        >
          Novo plano
        </Button>
        <Button variant="outline" onClick={() => setCatalogOpen(true)}>
          Catálogo de vantagens
        </Button>
      </div>

      {actionError ? <Alert variant="destructive">{actionError}</Alert> : null}

      {plans.error ? (
        <ErrorState error={plans.error} onRetry={plans.refetch} />
      ) : !plans.data ? (
        <ListSkeleton />
      ) : list.length === 0 ? (
        <EmptyState title="Nenhum plano ainda">
          Crie o primeiro plano para poder vinculá-lo às fichas dos alunos.
        </EmptyState>
      ) : (
        <ul className="space-y-3">
          {list.map((p) => (
            <li key={p.id} className="space-y-3 rounded-xl border bg-card p-3 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold">{p.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {MODEL_LABEL[p.billing_model]} · {planSummary(p)}
                  </p>
                </div>
                <p className="text-lg font-semibold">{formatBRL(p.price_cents / 100)}</p>
              </div>
              {p.description ? <p className="text-sm">{p.description}</p> : null}
              {(planBenefits.data?.[p.id] ?? []).length > 0 ? (
                <ul className="list-disc space-y-0.5 pl-5 text-sm">
                  {(planBenefits.data?.[p.id] ?? []).map((label) => (
                    <li key={label}>{label}</li>
                  ))}
                </ul>
              ) : null}
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={p.active ? 'success' : 'muted'}>
                  {p.active ? 'Ativo' : 'Inativo'}
                </Badge>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => setEditing(p)}>
                  Editar<span className="sr-only"> {p.name}</span>
                </Button>
                <Button
                  variant="outline"
                  disabled={busyId === p.id}
                  onClick={() => void toggleActive(p)}
                >
                  {p.active ? 'Desativar' : 'Ativar'}
                  <span className="sr-only"> {p.name}</span>
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setActionError(null)
                    setDeleting(p)
                  }}
                >
                  Excluir<span className="sr-only"> {p.name}</span>
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {editing ? (
        <PlanForm
          plan={editing === 'new' ? null : editing}
          onSaved={() => {
            plans.refetch()
            planBenefits.refetch()
          }}
          onClose={() => setEditing(null)}
        />
      ) : null}

      {catalogOpen ? (
        <BenefitsCatalog
          onClose={() => setCatalogOpen(false)}
          onChanged={planBenefits.refetch}
        />
      ) : null}

      {deleting ? (
        <ConfirmDialog
          title="Excluir plano?"
          description={`Excluir "${deleting.name}" é permanente e os alunos que usam este plano ficam sem plano. Se você só quer parar de oferecê-lo, prefira desativar.`}
          confirmLabel="Excluir plano"
          onConfirm={async () => {
            await deletePlan(deleting.id)
            plans.refetch()
          }}
          onClose={() => setDeleting(null)}
        />
      ) : null}
    </div>
  )
}
