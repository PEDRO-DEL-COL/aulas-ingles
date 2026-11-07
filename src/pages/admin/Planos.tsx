import { useState, type FormEvent } from 'react'

import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Input, Select, Textarea } from '@/components/ui/field'
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
      await savePlan(result.values, plan?.id)
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
        {submitError ? <Alert variant="destructive">{submitError}</Alert> : null}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={busy}>
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

      <Button
        onClick={() => {
          setActionError(null)
          setEditing('new')
        }}
      >
        Novo plano
      </Button>

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
          onSaved={plans.refetch}
          onClose={() => setEditing(null)}
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
