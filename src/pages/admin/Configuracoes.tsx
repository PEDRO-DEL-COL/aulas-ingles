import { useState, type FormEvent } from 'react'

import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input, Select } from '@/components/ui/field'
import { getSettings, updateSettings, type SettingsRow } from '@/features/admin/settings'
import {
  validatePixForm,
  type PixFormErrors,
  type PixFormValues,
} from '@/features/admin/validation'
import { ConfirmDialog } from '@/features/professora/components/ConfirmDialog'
import { FormField } from '@/features/professora/components/FormField'
import { ErrorState, ListSkeleton, PageHeader } from '@/features/shared/components/StateViews'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useQuery } from '@/lib/data/useQuery'
import { buildPixPayload, type PixKeyType } from '@/lib/pix'

const TYPE_LABEL: Record<PixKeyType, string> = {
  cpf: 'CPF',
  cnpj: 'CNPJ',
  email: 'E-mail',
  telefone: 'Telefone',
  aleatoria: 'Chave aleatória',
}

function toForm(s: SettingsRow): PixFormValues {
  return {
    pix_key_type: s.pix_key_type ?? '',
    pix_key: s.pix_key ?? '',
    receiver_name: s.receiver_name ?? '',
    receiver_city: s.receiver_city ?? '',
    whatsapp_number: s.whatsapp_number ?? '',
  }
}

function PixForm({ settings, onSaved }: { settings: SettingsRow; onSaved: () => void }) {
  const [values, setValues] = useState<PixFormValues>(() => toForm(settings))
  const [errors, setErrors] = useState<PixFormErrors>({})
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null)
  const [clearing, setClearing] = useState(false)

  function set<K extends keyof PixFormValues>(key: K, value: PixFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }))
    setStatus(null)
  }

  async function persist(payload: Parameters<typeof updateSettings>[0], message: string) {
    const saved = await updateSettings(payload)
    setValues(toForm(saved))
    setErrors({})
    setStatus({ ok: true, message })
    onSaved()
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    setStatus(null)
    const result = validatePixForm(values)
    setErrors(result.errors)
    if (!result.values) return
    setBusy(true)
    try {
      await persist(result.values, 'Pix e contato salvos.')
    } catch (err) {
      setStatus({
        ok: false,
        message: err instanceof Error ? err.message : 'Não foi possível salvar.',
      })
    } finally {
      setBusy(false)
    }
  }

  async function clearPix() {
    await persist(
      { pix_key: null, pix_key_type: null, receiver_name: null, receiver_city: null },
      'Pix removido. Os alunos verão "Pix ainda não configurado".',
    )
  }

  const check = validatePixForm(values)
  const hasKey = values.pix_key.trim() !== ''
  const pixEmpty =
    !hasKey &&
    values.pix_key_type === '' &&
    values.receiver_name.trim() === '' &&
    values.receiver_city.trim() === ''

  let preview: { ok: boolean; message: string } | null = null
  if (check.values && check.values.pix_key && check.values.pix_key_type) {
    try {
      buildPixPayload({
        key: check.values.pix_key,
        receiverName: check.values.receiver_name ?? '',
        receiverCity: check.values.receiver_city ?? '',
        amount: 1,
        txid: '***',
      })
      preview = { ok: true, message: 'Código Pix de teste gerado com sucesso.' }
    } catch (err) {
      preview = {
        ok: false,
        message: err instanceof Error ? err.message : 'Não foi possível gerar o código Pix.',
      }
    }
  }

  return (
    <form onSubmit={(e) => void submit(e)} noValidate className="space-y-4">
      {pixEmpty ? (
        <Alert variant="warning">
          Sem chave, os alunos veem &quot;Pix ainda não configurado&quot;.
        </Alert>
      ) : null}

      <FormField label="Tipo da chave Pix" error={errors.pix_key_type}>
        {(p) => (
          <Select
            {...p}
            value={values.pix_key_type}
            onChange={(e) => set('pix_key_type', e.target.value as PixKeyType | '')}
          >
            <option value="">—</option>
            {(Object.keys(TYPE_LABEL) as PixKeyType[]).map((t) => (
              <option key={t} value={t}>
                {TYPE_LABEL[t]}
              </option>
            ))}
          </Select>
        )}
      </FormField>

      <FormField label="Chave Pix" error={errors.pix_key}>
        {(p) => (
          <Input
            {...p}
            autoComplete="off"
            maxLength={77}
            value={values.pix_key}
            onChange={(e) => set('pix_key', e.target.value)}
          />
        )}
      </FormField>

      <FormField
        label="Nome do recebedor"
        error={errors.receiver_name}
        help={`${values.receiver_name.length}/25 caracteres`}
      >
        {(p) => (
          <Input
            {...p}
            value={values.receiver_name}
            onChange={(e) => set('receiver_name', e.target.value)}
          />
        )}
      </FormField>

      <FormField
        label="Cidade do recebedor"
        error={errors.receiver_city}
        help={`${values.receiver_city.length}/15 caracteres`}
      >
        {(p) => (
          <Input
            {...p}
            value={values.receiver_city}
            onChange={(e) => set('receiver_city', e.target.value)}
          />
        )}
      </FormField>

      {preview ? (
        <Alert variant={preview.ok ? 'success' : 'destructive'}>{preview.message}</Alert>
      ) : null}

      <FormField
        label="WhatsApp da professora"
        error={errors.whatsapp_number}
        help="Com DDI e DDD, ex.: +55 11 99999-8888. Pode deixar em branco."
      >
        {(p) => (
          <Input
            {...p}
            type="tel"
            autoComplete="off"
            value={values.whatsapp_number}
            onChange={(e) => set('whatsapp_number', e.target.value)}
          />
        )}
      </FormField>

      {status ? (
        <Alert variant={status.ok ? 'success' : 'destructive'}>{status.message}</Alert>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button type="submit" disabled={busy}>
          {busy ? 'Salvando…' : 'Salvar'}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={() => setClearing(true)}
        >
          Limpar Pix
        </Button>
      </div>

      {clearing ? (
        <ConfirmDialog
          title="Limpar o Pix?"
          description="A chave, o tipo, o nome e a cidade do recebedor serão apagados. Os alunos deixam de ver o Pix até você configurar de novo. O WhatsApp não é alterado."
          confirmLabel="Limpar Pix"
          onConfirm={clearPix}
          onClose={() => setClearing(false)}
        />
      ) : null}
    </form>
  )
}

export default function Configuracoes() {
  useDocumentTitle('Pix e contato')
  const settings = useQuery('admin-settings', getSettings)

  return (
    <div className="space-y-4">
      <PageHeader
        title="Pix e contato"
        description="Dados usados para gerar o Pix dos alunos e o contato por WhatsApp."
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
        <PixForm settings={settings.data} onSaved={settings.refetch} />
      )}
    </div>
  )
}
