import { Ban, MessageCircle, Plus, Undo2, CircleCheck } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router'

import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog } from '@/components/ui/dialog'
import { Input, Label, Select, Textarea } from '@/components/ui/field'
import { InvoiceStatusBadge } from '@/features/aluno/components/StatusBadges'
import { isPayable } from '@/features/aluno/invoices'
import { ConfirmDialog } from '@/features/professora/components/ConfirmDialog'
import { FormField } from '@/features/professora/components/FormField'
import {
  buildPaymentReminder,
  filterInvoices,
  groupInvoices,
  invoiceDefaultsFromPlan,
  invoiceTitle,
  currentMonthInput,
  validateInvoiceForm,
  type BillingModel,
  type InvoiceAdmin,
  type InvoiceFormErrors,
  type InvoiceFormValues,
  type InvoiceStatusFilter,
  type InvoiceStudent,
  type PlanLite,
} from '@/features/professora/finance'
import {
  createInvoice,
  listInvoicesAdmin,
  listPlansForBilling,
  listStudentsForBilling,
  updateInvoiceStatus,
} from '@/features/professora/financeApi'
import { whatsappNumber } from '@/features/professora/validation'
import {
  EmptyState,
  ErrorState,
  ListSkeleton,
} from '@/features/shared/components/StateViews'
import { dayKey, formatDateOnly } from '@/features/shared/datetime'
import { brand } from '@/config/brand'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useQuery } from '@/lib/data/useQuery'
import { formatBRL } from '@/lib/format'
import { buildWhatsAppLink } from '@/lib/whatsapp'

const TABS: { value: InvoiceStatusFilter; label: string }[] = [
  { value: 'atrasadas', label: 'Atrasadas' },
  { value: 'abertas', label: 'Em aberto' },
  { value: 'pagas', label: 'Pagas' },
  { value: 'canceladas', label: 'Canceladas' },
  { value: 'todas', label: 'Todas' },
]

const MODEL_LABEL: Record<BillingModel, string> = {
  mensalidade: 'Mensalidade',
  pacote: 'Pacote de aulas',
  avulsa: 'Aula avulsa',
}

function sumCents(list: readonly InvoiceAdmin[]): number {
  return list.reduce((acc, i) => acc + i.amount_cents, 0)
}

export default function Financeiro() {
  useDocumentTitle('Financeiro')
  const [params] = useSearchParams()
  const presetStudent = params.get('aluno') ?? ''

  const invoices = useQuery('prof-financeiro', () => listInvoicesAdmin())
  const students = useQuery('prof-fin-alunos', listStudentsForBilling)
  const plans = useQuery('prof-fin-planos', listPlansForBilling)

  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<InvoiceStatusFilter>('abertas')
  const [month, setMonth] = useState('')
  const [formOpen, setFormOpen] = useState(presetStudent !== '')
  const [confirm, setConfirm] = useState<{
    kind: 'pay' | 'undo' | 'cancel'
    invoice: InvoiceAdmin
  } | null>(null)
  const [now] = useState(() => new Date())

  const all = invoices.data
  const currentMonth = currentMonthInput(now)

  const summary = (() => {
    if (!all) return null
    const g = groupInvoices(all)
    const open = [...g.atrasadas, ...g.abertas, ...g.avisosJaPaguei]
    const overdue = open.filter((i) => i.effective_status === 'atrasado')
    const received = g.pagas.filter(
      (i) => i.paid_at && dayKey(i.paid_at).slice(0, 7) === currentMonth,
    )
    return {
      open: sumCents(open),
      overdue: sumCents(overdue),
      overdueCount: overdue.length,
      received: sumCents(received),
    }
  })()

  const filtered = all ? filterInvoices(all, { search, status: 'todas', month }) : []
  const groups = groupInvoices(filtered)
  const notices = groups.avisosJaPaguei
  const noticeIds = new Set(notices.map((i) => i.id))
  const list = filterInvoices(filtered, { status }).filter((i) => !noticeIds.has(i.id))

  async function runConfirm() {
    if (!confirm) return
    const { kind, invoice } = confirm
    await updateInvoiceStatus(
      invoice.id,
      kind === 'pay' ? 'pago' : kind === 'undo' ? 'em_aberto' : 'cancelado',
    )
    invoices.refetch()
  }

  const texts = {
    pay: {
      title: 'Marcar como pago?',
      confirmLabel: 'Marcar como pago',
      description: (i: InvoiceAdmin) =>
        `Confirme que o pagamento de ${formatBRL(i.amount_cents / 100)} de ${i.student?.full_name ?? 'aluno'} caiu no extrato.`,
    },
    undo: {
      title: 'Desfazer pagamento?',
      confirmLabel: 'Desfazer pagamento',
      description: (i: InvoiceAdmin) =>
        `A cobrança de ${i.student?.full_name ?? 'aluno'} volta para "em aberto".`,
    },
    cancel: {
      title: 'Cancelar cobrança?',
      confirmLabel: 'Cancelar cobrança',
      description: (i: InvoiceAdmin) =>
        `A cobrança de ${formatBRL(i.amount_cents / 100)} de ${i.student?.full_name ?? 'aluno'} será cancelada e deixa de valer.`,
    },
  } as const

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Financeiro</h1>
        <Button onClick={() => setFormOpen(true)}>
          <Plus aria-hidden="true" />
          Nova cobrança
        </Button>
      </header>

      {summary ? (
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <SummaryItem label="Em aberto" value={formatBRL(summary.open / 100)} />
          <SummaryItem
            label="Atrasado"
            value={formatBRL(summary.overdue / 100)}
            hint={
              summary.overdueCount > 0
                ? `${summary.overdueCount} ${summary.overdueCount === 1 ? 'cobrança' : 'cobranças'}`
                : undefined
            }
            tone={summary.overdue > 0 ? 'bad' : undefined}
          />
          <SummaryItem
            label="Recebido no mês"
            value={formatBRL(summary.received / 100)}
          />
        </dl>
      ) : null}

      {notices.length > 0 ? (
        <section
          aria-labelledby="avisos-titulo"
          className="space-y-3 rounded-xl border border-warning/40 bg-warning-soft p-3"
        >
          <div>
            <h2 id="avisos-titulo" className="font-semibold text-warning">
              Avisos de &quot;Já paguei&quot; ({notices.length})
            </h2>
            <p className="text-sm text-warning">
              Confira o extrato e marque como pago quando o dinheiro cair.
            </p>
          </div>
          <ul className="space-y-3">
            {notices.map((i) => (
              <li key={i.id}>
                <InvoiceCard
                  invoice={i}
                  onAction={(kind) => setConfirm({ kind, invoice: i })}
                />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-[1fr_12rem]">
        <div className="space-y-1.5">
          <Label htmlFor="fin-busca">Buscar por aluno</Label>
          <Input
            id="fin-busca"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="fin-mes">Mês</Label>
          <Input
            id="fin-mes"
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
        </div>
      </div>

      <div role="group" aria-label="Situação" className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Button
            key={t.value}
            size="sm"
            variant={status === t.value ? 'default' : 'outline'}
            aria-pressed={status === t.value}
            onClick={() => setStatus(t.value)}
          >
            {t.label}
          </Button>
        ))}
      </div>

      {invoices.error ? (
        <ErrorState error={invoices.error} onRetry={invoices.refetch} />
      ) : !all ? (
        <ListSkeleton />
      ) : list.length === 0 ? (
        <EmptyState title="Nenhuma cobrança por aqui">
          {all.length === 0
            ? 'Toque em "Nova cobrança" para lançar a primeira.'
            : 'Tente outra aba, busca ou mês.'}
        </EmptyState>
      ) : (
        <ul className="space-y-3">
          {list.map((i) => (
            <li key={i.id}>
              <InvoiceCard
                invoice={i}
                onAction={(kind) => setConfirm({ kind, invoice: i })}
              />
            </li>
          ))}
        </ul>
      )}

      {confirm ? (
        <ConfirmDialog
          title={texts[confirm.kind].title}
          description={texts[confirm.kind].description(confirm.invoice)}
          confirmLabel={texts[confirm.kind].confirmLabel}
          onConfirm={runConfirm}
          onClose={() => setConfirm(null)}
        />
      ) : null}

      {formOpen ? (
        <NewInvoiceDialog
          students={students.data}
          plans={plans.data}
          loadError={students.error ?? plans.error}
          presetStudent={presetStudent}
          now={now}
          onClose={() => setFormOpen(false)}
          onCreated={() => {
            setFormOpen(false)
            invoices.refetch()
          }}
        />
      ) : null}
    </div>
  )
}

function SummaryItem({
  label,
  value,
  hint,
  tone,
}: {
  label: string
  value: string
  hint?: string
  tone?: 'bad'
}) {
  return (
    <Card className="gap-1">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className={`text-xl font-bold ${tone === 'bad' ? 'text-destructive' : ''}`}>
        {value}
        {hint ? (
          <span className="ml-2 text-sm font-normal text-muted-foreground">{hint}</span>
        ) : null}
      </dd>
    </Card>
  )
}

function InvoiceCard({
  invoice: i,
  onAction,
}: {
  invoice: InvoiceAdmin
  onAction: (kind: 'pay' | 'undo' | 'cancel') => void
}) {
  const payable = isPayable(i.effective_status)
  const phone = whatsappNumber(i.payer?.phone) ?? whatsappNumber(i.student?.phone) ?? null
  const reminderHref =
    phone && i.student
      ? buildWhatsAppLink(
          phone,
          buildPaymentReminder({
            studentName: i.student.full_name,
            amountCents: i.amount_cents,
            dueDate: i.due_date,
            referenceMonth: i.billing_model === 'mensalidade' ? i.reference_month : null,
            businessName: brand.name,
          }),
        )
      : null

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold">{i.student?.full_name ?? 'Aluno'}</p>
          <p className="text-sm text-muted-foreground">
            {invoiceTitle(i)}
            {i.description ? ` · ${i.description}` : ''}
          </p>
          {i.payer && i.payer.id !== i.student?.id ? (
            <p className="text-xs text-muted-foreground">Pagador: {i.payer.name}</p>
          ) : null}
        </div>
        <InvoiceStatusBadge status={i.effective_status} />
      </div>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-lg font-bold">{formatBRL(i.amount_cents / 100)}</p>
        <p className="text-sm text-muted-foreground">
          Vence em {formatDateOnly(i.due_date)}
        </p>
      </div>
      {payable && i.student_notified_paid_at ? (
        <p className="text-sm text-warning">O aluno avisou que já pagou.</p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {payable ? (
          <Button size="sm" onClick={() => onAction('pay')}>
            <CircleCheck aria-hidden="true" />
            Marcar como pago
          </Button>
        ) : null}
        {i.effective_status === 'pago' ? (
          <Button size="sm" variant="outline" onClick={() => onAction('undo')}>
            <Undo2 aria-hidden="true" />
            Desfazer pagamento
          </Button>
        ) : null}
        {payable ? (
          reminderHref ? (
            <Button size="sm" variant="outline" asChild>
              <a href={reminderHref} target="_blank" rel="noopener noreferrer">
                <MessageCircle aria-hidden="true" />
                Lembrete WhatsApp
              </a>
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              disabled
              title="Cadastre um telefone do aluno ou do pagador para enviar o lembrete."
            >
              <MessageCircle aria-hidden="true" />
              Sem telefone
            </Button>
          )
        ) : null}
        {payable ? (
          <Button size="sm" variant="ghost" onClick={() => onAction('cancel')}>
            <Ban aria-hidden="true" />
            Cancelar cobrança
          </Button>
        ) : null}
      </div>
    </Card>
  )
}

function NewInvoiceDialog({
  students,
  plans,
  loadError,
  presetStudent,
  now,
  onClose,
  onCreated,
}: {
  students: InvoiceStudent[] | undefined
  plans: PlanLite[] | undefined
  loadError: unknown
  presetStudent: string
  now: Date
  onClose: () => void
  onCreated: () => void
}) {
  const [values, setValues] = useState<InvoiceFormValues>(() => ({
    student_id: '',
    payer_id: '',
    plan_id: '',
    billing_model: 'mensalidade',
    amount: '',
    reference_month: currentMonthInput(now),
    lessons_count: '',
    description: '',
    due_date: dayKey(now),
    status: 'em_aberto',
  }))
  const [errors, setErrors] = useState<InvoiceFormErrors>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [presetApplied, setPresetApplied] = useState(false)

  function patch(p: Partial<InvoiceFormValues>) {
    setValues((v) => ({ ...v, ...p }))
  }

  function applyPlan(planId: string, list: PlanLite[] | undefined) {
    const plan = list?.find((x) => x.id === planId)
    if (plan) patch(invoiceDefaultsFromPlan(plan, now))
    else patch({ plan_id: '' })
  }

  function chooseStudent(id: string, list: InvoiceStudent[] | undefined) {
    const s = list?.find((x) => x.id === id)
    patch({ student_id: id, payer_id: s?.default_payer_id ?? '' })
    if (s?.plan_id) applyPlan(s.plan_id, plans)
  }

  // Aplica ?aluno=<id> assim que os alunos e planos chegam (uma vez).
  if (!presetApplied && presetStudent && students && plans) {
    setPresetApplied(true)
    if (students.some((s) => s.id === presetStudent))
      chooseStudent(presetStudent, students)
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    setSubmitError(null)
    const result = validateInvoiceForm(values)
    if ('errors' in result) {
      setErrors(result.errors)
      return
    }
    setErrors({})
    setBusy(true)
    try {
      await createInvoice(result.data)
      onCreated()
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : 'Não foi possível criar a cobrança.',
      )
      setBusy(false)
    }
  }

  const model = values.billing_model

  return (
    <Dialog open onClose={onClose} title="Nova cobrança" dismissible={!busy}>
      {loadError ? (
        <Alert variant="destructive">
          Não foi possível carregar alunos e planos. Feche e tente de novo.
        </Alert>
      ) : null}
      <form onSubmit={(e) => void submit(e)} noValidate className="space-y-3">
        <FormField label="Aluno" error={errors.student_id}>
          {(p) => (
            <Select
              {...p}
              value={values.student_id}
              onChange={(e) => chooseStudent(e.target.value, students)}
            >
              <option value="">Escolha…</option>
              {students?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name}
                </option>
              ))}
            </Select>
          )}
        </FormField>

        <FormField label="Plano (opcional)" help="Preenche modelo, valor e aulas.">
          {(p) => (
            <Select
              {...p}
              value={values.plan_id}
              onChange={(e) => applyPlan(e.target.value, plans)}
            >
              <option value="">Sem plano</option>
              {plans?.map((pl) => (
                <option key={pl.id} value={pl.id}>
                  {pl.name}
                </option>
              ))}
            </Select>
          )}
        </FormField>

        <FormField label="Modelo">
          {(p) => (
            <Select
              {...p}
              value={model}
              onChange={(e) => patch({ billing_model: e.target.value as BillingModel })}
            >
              {(Object.keys(MODEL_LABEL) as BillingModel[]).map((m) => (
                <option key={m} value={m}>
                  {MODEL_LABEL[m]}
                </option>
              ))}
            </Select>
          )}
        </FormField>

        <FormField label="Valor (R$)" error={errors.amount}>
          {(p) => (
            <Input
              {...p}
              inputMode="decimal"
              placeholder="150,00"
              value={values.amount}
              onChange={(e) => patch({ amount: e.target.value })}
            />
          )}
        </FormField>

        {model === 'mensalidade' ? (
          <FormField label="Mês de referência" error={errors.reference_month}>
            {(p) => (
              <Input
                {...p}
                type="month"
                value={values.reference_month}
                onChange={(e) => patch({ reference_month: e.target.value })}
              />
            )}
          </FormField>
        ) : null}

        {model === 'pacote' || model === 'avulsa' ? (
          <FormField
            label={
              model === 'pacote'
                ? 'Quantidade de aulas'
                : 'Quantidade de aulas (opcional)'
            }
            error={errors.lessons_count}
          >
            {(p) => (
              <Input
                {...p}
                inputMode="numeric"
                value={values.lessons_count}
                onChange={(e) => patch({ lessons_count: e.target.value })}
              />
            )}
          </FormField>
        ) : null}

        <FormField label="Descrição (opcional)" error={errors.description}>
          {(p) => (
            <Textarea
              {...p}
              rows={2}
              value={values.description}
              onChange={(e) => patch({ description: e.target.value })}
            />
          )}
        </FormField>

        <FormField label="Vencimento" error={errors.due_date}>
          {(p) => (
            <Input
              {...p}
              type="date"
              value={values.due_date}
              onChange={(e) => patch({ due_date: e.target.value })}
            />
          )}
        </FormField>

        <FormField label="Situação inicial">
          {(p) => (
            <Select
              {...p}
              value={values.status}
              onChange={(e) => patch({ status: e.target.value as 'em_aberto' | 'pago' })}
            >
              <option value="em_aberto">Em aberto</option>
              <option value="pago">Já pago</option>
            </Select>
          )}
        </FormField>

        {submitError ? <Alert variant="destructive">{submitError}</Alert> : null}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? 'Salvando…' : 'Criar cobrança'}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
