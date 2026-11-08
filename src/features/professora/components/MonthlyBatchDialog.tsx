import { useState } from 'react'

import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/field'
import {
  batchActionLabel,
  defaultBatchMonth,
  summarizeBatch,
  validateBatchForm,
  type BatchAction,
  type BatchFormErrors,
  type BatchRow,
} from '@/features/professora/finance'
import {
  generateMonthlyInvoices,
  previewMonthlyInvoices,
} from '@/features/professora/financeApi'
import { formatDateOnly } from '@/features/shared/datetime'
import { getSettings } from '@/features/admin/settings'
import { useQuery } from '@/lib/data/useQuery'
import { formatBRL } from '@/lib/format'

import { FormField } from './FormField'

const GROUPS: { action: BatchAction; title: string }[] = [
  { action: 'criar', title: 'Serão criadas' },
  { action: 'ja_existe', title: 'Já existem' },
  { action: 'sem_plano', title: 'Sem plano' },
  { action: 'plano_inativo', title: 'Plano inativo' },
  { action: 'nao_mensal', title: 'Pacote/avulsa' },
]

export function MonthlyBatchDialog({
  now,
  onClose,
  onDone,
}: {
  now: Date
  onClose: () => void
  onDone: () => void
}) {
  const [month, setMonth] = useState(() => defaultBatchMonth(now))
  const settings = useQuery('batch-settings', getSettings)
  // null = a professora não mexeu: vale o padrão do admin (10 enquanto carrega/se falhar).
  const [dueDayEdit, setDueDayEdit] = useState<string | null>(null)
  const defaultDay = settings.data?.default_due_day ?? 10
  const dueDay = dueDayEdit ?? String(defaultDay)
  const [errors, setErrors] = useState<BatchFormErrors>({})
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  // A prévia guarda os parâmetros usados: mudou mês/dia => desatualizada.
  const [preview, setPreview] = useState<{
    rows: BatchRow[]
    month: string
    dueDay: number
  } | null>(null)
  const [created, setCreated] = useState<number | null>(null)

  const parsed = validateBatchForm({ month, dueDay })
  const valid = 'data' in parsed ? parsed.data : null
  const stale =
    preview !== null &&
    (!valid || valid.month !== preview.month || valid.dueDay !== preview.dueDay)
  const summary = preview ? summarizeBatch(preview.rows) : null

  async function runPreview() {
    setError(null)
    if (!valid) {
      setErrors('errors' in parsed ? parsed.errors : {})
      return
    }
    setErrors({})
    setBusy(true)
    try {
      const rows = await previewMonthlyInvoices(valid.month, valid.dueDay)
      setPreview({ rows, month: valid.month, dueDay: valid.dueDay })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível gerar a prévia.')
    } finally {
      setBusy(false)
    }
  }

  async function runGenerate() {
    if (!preview || stale) return
    setError(null)
    setBusy(true)
    try {
      const rows = await generateMonthlyInvoices(preview.month, preview.dueDay)
      setCreated(summarizeBatch(rows).counts.criada)
      setPreview(null)
      onDone()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível gerar as mensalidades.')
    } finally {
      setBusy(false)
    }
  }

  const toCreate = summary?.counts.criar ?? 0

  return (
    <Dialog
      open
      onClose={onClose}
      title="Gerar mensalidades do mês"
      dismissible={!busy}
      className="max-w-lg"
    >
      {created !== null ? (
        <div className="space-y-3">
          <Alert>
            {created === 0
              ? 'Nenhuma mensalidade nova: tudo já estava lançado.'
              : created === 1
                ? '1 mensalidade criada.'
                : `${created} mensalidades criadas.`}
          </Alert>
          <div className="flex justify-end">
            <Button onClick={onClose}>Fechar</Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Cria a mensalidade do mês para os alunos ativos com plano de mensalidade
            ativo, usando o valor do plano e o pagador padrão do aluno. Pacotes e aulas
            avulsas continuam sendo lançados um a um em &quot;Nova cobrança&quot;. Rodar
            de novo não duplica nada.
          </p>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Mês de referência" error={errors.month}>
              {(p) => (
                <Input
                  {...p}
                  type="month"
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                />
              )}
            </FormField>
            <FormField
              label="Dia de vencimento"
              error={errors.dueDay}
              help="Padrão definido pelo admin em Políticas. Mudar aqui vale só para este lote."
            >
              {(p) => (
                <Input
                  {...p}
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={31}
                  value={dueDay}
                  onChange={(e) => setDueDayEdit(e.target.value)}
                />
              )}
            </FormField>
          </div>

          {error ? <Alert variant="destructive">{error}</Alert> : null}

          {preview && summary ? (
            <div className="space-y-3">
              {stale ? (
                <Alert variant="destructive">
                  Mês ou dia mudou. Veja a prévia de novo antes de gerar.
                </Alert>
              ) : null}
              {GROUPS.map((g) => {
                const rows = preview.rows.filter((r) => r.action === g.action)
                if (rows.length === 0) return null
                return (
                  <section key={g.action} className="space-y-1">
                    <h3 className="text-sm font-semibold">
                      {g.title}: {rows.length}
                      {g.action === 'criar'
                        ? ` · ${formatBRL(summary.totalCents / 100)}`
                        : ''}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {batchActionLabel(g.action)}
                    </p>
                    <ul className="divide-y rounded-lg border text-sm">
                      {rows.map((r) => (
                        <li
                          key={r.student_id}
                          className="flex items-baseline justify-between gap-3 px-3 py-2"
                        >
                          <span className="min-w-0">
                            <span className="block truncate font-medium">
                              {r.student_name}
                            </span>
                            {r.plan_name ? (
                              <span className="block truncate text-xs text-muted-foreground">
                                {r.plan_name}
                              </span>
                            ) : null}
                          </span>
                          {r.amount_cents != null ? (
                            <span className="shrink-0 text-right">
                              <span className="block">
                                {formatBRL(r.amount_cents / 100)}
                              </span>
                              <span className="block text-xs text-muted-foreground">
                                vence {formatDateOnly(r.due_date)}
                              </span>
                            </span>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </section>
                )
              })}
              {preview.rows.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum aluno ativo.</p>
              ) : null}
            </div>
          ) : null}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" disabled={busy} onClick={onClose}>
              Cancelar
            </Button>
            <Button variant="outline" disabled={busy} onClick={() => void runPreview()}>
              {busy && !preview ? 'Carregando…' : 'Ver prévia'}
            </Button>
            <Button
              disabled={busy || !preview || stale || toCreate === 0}
              onClick={() => void runGenerate()}
            >
              {busy && preview
                ? 'Gerando…'
                : `Gerar ${toCreate} ${toCreate === 1 ? 'mensalidade' : 'mensalidades'}`}
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  )
}
