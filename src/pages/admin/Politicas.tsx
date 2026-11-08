import { useState, type FormEvent } from 'react'

import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input, Textarea } from '@/components/ui/field'
import { getSettings, updateSettings, type SettingsRow } from '@/features/admin/settings'
import {
  validatePolicyForm,
  type PolicyFormErrors,
  type PolicyFormValues,
} from '@/features/admin/validation'
import { FormField } from '@/features/professora/components/FormField'
import {
  ErrorState,
  ListSkeleton,
  PageHeader,
} from '@/features/shared/components/StateViews'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useQuery } from '@/lib/data/useQuery'

function toForm(s: SettingsRow): PolicyFormValues {
  return {
    cancellation_min_hours: String(s.cancellation_min_hours),
    late_cancel_band_enabled: s.late_cancel_band_enabled,
    late_cancel_band_min_hours: String(s.late_cancel_band_min_hours),
    max_makeups_per_month: String(s.max_makeups_per_month),
    default_due_day: String(s.default_due_day),
    cancellation_policy_text: s.cancellation_policy_text ?? '',
  }
}

function summarize(v: PolicyFormValues): string | null {
  const { values } = validatePolicyForm(v)
  if (!values) return null
  const min = values.cancellation_min_hours
  const parts = [`Cancelando com ${min} h ou mais: com reposição.`]
  if (values.late_cancel_band_enabled) {
    const band = values.late_cancel_band_min_hours
    parts.push(`Entre ${band} h e ${min} h: a professora decide.`)
    parts.push(`Menos de ${band} h ou falta: sem reposição.`)
  } else {
    parts.push(`Menos de ${min} h ou falta: sem reposição.`)
  }
  const n = values.max_makeups_per_month
  parts.push(
    n === 0
      ? 'Não há reposições por mês.'
      : `Até ${n} ${n === 1 ? 'reposição' : 'reposições'} por mês.`,
  )
  return parts.join(' ')
}

function PolicyForm({
  settings,
  onSaved,
}: {
  settings: SettingsRow
  onSaved: () => void
}) {
  const [values, setValues] = useState<PolicyFormValues>(() => toForm(settings))
  const [errors, setErrors] = useState<PolicyFormErrors>({})
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null)

  function set<K extends keyof PolicyFormValues>(key: K, value: PolicyFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }))
    setStatus(null)
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    setStatus(null)
    const result = validatePolicyForm(values)
    setErrors(result.errors)
    if (!result.values) return
    setBusy(true)
    try {
      const saved = await updateSettings(result.values)
      setValues(toForm(saved))
      setStatus({ ok: true, message: 'Políticas salvas.' })
      onSaved()
    } catch (err) {
      setStatus({
        ok: false,
        message: err instanceof Error ? err.message : 'Não foi possível salvar.',
      })
    } finally {
      setBusy(false)
    }
  }

  const summary = summarize(values)
  const text = values.cancellation_policy_text

  return (
    <form onSubmit={(e) => void submit(e)} noValidate className="space-y-4">
      <FormField
        label="Antecedência mínima para cancelar com reposição (horas)"
        error={errors.cancellation_min_hours}
        help="De 0 a 720."
      >
        {(p) => (
          <Input
            {...p}
            inputMode="numeric"
            value={values.cancellation_min_hours}
            onChange={(e) => set('cancellation_min_hours', e.target.value)}
          />
        )}
      </FormField>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="size-4"
          checked={values.late_cancel_band_enabled}
          onChange={(e) => set('late_cancel_band_enabled', e.target.checked)}
        />
        Usar faixa intermediária (a critério da professora)
      </label>

      {values.late_cancel_band_enabled ? (
        <FormField
          label="Início da faixa intermediária (horas de antecedência)"
          error={errors.late_cancel_band_min_hours}
          help="Precisa ser menor que a antecedência mínima. Cancelamentos entre este valor e a antecedência mínima ficam para a professora decidir."
        >
          {(p) => (
            <Input
              {...p}
              inputMode="numeric"
              value={values.late_cancel_band_min_hours}
              onChange={(e) => set('late_cancel_band_min_hours', e.target.value)}
            />
          )}
        </FormField>
      ) : null}

      <FormField
        label="Máximo de reposições por mês (por aluno)"
        error={errors.max_makeups_per_month}
        help="De 0 a 31."
      >
        {(p) => (
          <Input
            {...p}
            inputMode="numeric"
            value={values.max_makeups_per_month}
            onChange={(e) => set('max_makeups_per_month', e.target.value)}
          />
        )}
      </FormField>

      <FormField
        label="Dia de vencimento padrão das mensalidades"
        error={errors.default_due_day}
        help="De 1 a 31. Em meses mais curtos, vence no último dia do mês. A professora ainda pode mudar o dia ao gerar um lote."
      >
        {(p) => (
          <Input
            {...p}
            inputMode="numeric"
            value={values.default_due_day}
            onChange={(e) => set('default_due_day', e.target.value)}
          />
        )}
      </FormField>

      <FormField
        label="Texto da política (mostrado aos alunos)"
        error={errors.cancellation_policy_text}
        help={`${text.length}/4000 caracteres`}
      >
        {(p) => (
          <Textarea
            {...p}
            className="min-h-40"
            value={text}
            onChange={(e) => set('cancellation_policy_text', e.target.value)}
          />
        )}
      </FormField>

      <section
        aria-labelledby="resumo-politica"
        className="rounded-xl border bg-card p-3"
      >
        <h2 id="resumo-politica" className="text-sm font-semibold">
          Resumo
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {summary ?? 'Corrija os campos acima para ver o resumo.'}
        </p>
      </section>

      {status ? (
        <Alert variant={status.ok ? 'success' : 'destructive'}>{status.message}</Alert>
      ) : null}

      <Button type="submit" disabled={busy}>
        {busy ? 'Salvando…' : 'Salvar'}
      </Button>
    </form>
  )
}

export default function Politicas() {
  useDocumentTitle('Políticas do negócio')
  const settings = useQuery('admin-settings', getSettings)

  return (
    <div className="space-y-4">
      <PageHeader
        title="Políticas do negócio"
        description="Regras de cancelamento e reposição aplicadas aos alunos."
      />
      {settings.error ? (
        <ErrorState error={settings.error} onRetry={settings.refetch} />
      ) : !settings.data && settings.loading ? (
        <ListSkeleton rows={2} />
      ) : !settings.data ? (
        <Alert variant="warning">
          As configurações ainda não foram criadas no banco. Aplique as migrations e tente
          de novo.
        </Alert>
      ) : (
        <PolicyForm settings={settings.data} onSaved={settings.refetch} />
      )}
    </div>
  )
}
