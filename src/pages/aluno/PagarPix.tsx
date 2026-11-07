import { ArrowLeft, Check, Copy } from 'lucide-react'
import { lazy, Suspense, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { brand } from '@/config/brand'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { formatBRL } from '@/lib/format'
import { useQuery } from '@/lib/data/useQuery'
import { buildPixPayload, buildTxid, normalizePixKey } from '@/lib/pix'
import { buildWhatsAppLink } from '@/lib/whatsapp'
import { listInvoices } from '@/features/aluno/api'
import { useAluno } from '@/features/aluno/AlunoContext'
import {
  EmptyState,
  ErrorState,
  ListSkeleton,
} from '@/features/aluno/components/StateViews'
import { formatDateOnly, referenceYYYYMM } from '@/features/aluno/datetime'
import { isPayable, type Invoice } from '@/features/aluno/invoices'
import type { Settings, StudentRecord } from '@/features/aluno/lessons'

// qrcode.react só é baixado nesta tela.
const PixQrCode = lazy(() => import('@/features/aluno/components/PixQrCode'))

type PixResult = { payload: string } | { error: string } | { notConfigured: true }

function buildPix(
  settings: Settings,
  student: StudentRecord,
  invoice: Invoice,
): PixResult {
  const key = settings.pix_key?.trim()
  if (!key) return { notConfigured: true }
  try {
    const normalized = settings.pix_key_type
      ? normalizePixKey(key, settings.pix_key_type)
      : key
    const payload = buildPixPayload({
      key: normalized,
      receiverName: settings.receiver_name ?? '',
      receiverCity: settings.receiver_city ?? '',
      amount: invoice.amount_cents / 100,
      txid:
        invoice.pix_txid ??
        buildTxid(
          student.id,
          referenceYYYYMM(invoice.reference_month ?? invoice.due_date),
        ),
    })
    return { payload }
  } catch (e) {
    return {
      error:
        e instanceof Error && e.message
          ? e.message
          : 'Não foi possível gerar o código Pix.',
    }
  }
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // Fallback para contextos sem a API (http, navegadores antigos).
    const area = document.createElement('textarea')
    area.value = text
    area.setAttribute('readonly', '')
    area.style.position = 'fixed'
    area.style.opacity = '0'
    document.body.appendChild(area)
    area.select()
    try {
      return document.execCommand('copy')
    } catch {
      return false
    } finally {
      document.body.removeChild(area)
    }
  }
}

function Back() {
  return (
    <Link
      to="/app/aluno/financeiro"
      className="inline-flex items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline"
    >
      <ArrowLeft aria-hidden="true" className="size-4" /> Financeiro
    </Link>
  )
}

export default function PagarPix() {
  useDocumentTitle('Pagar via Pix')
  const { invoiceId = '' } = useParams()
  const { student, settings } = useAluno()
  const { data, error, loading, refetch } = useQuery(`invoices:${student.id}`, () =>
    listInvoices(student.id),
  )
  const [copyState, setCopyState] = useState<'idle' | 'ok' | 'fail'>('idle')

  const invoice = data?.find((i) => i.id === invoiceId) ?? null
  const pix = useMemo<PixResult | null>(
    () => (invoice ? buildPix(settings, student, invoice) : null),
    [invoice, settings, student],
  )

  const whatsappNumber = settings.whatsapp_number || brand.whatsapp.number
  const whatsappLink = whatsappNumber
    ? buildWhatsAppLink(
        whatsappNumber,
        'Olá! Preciso de ajuda para pagar a minha aula via Pix.',
      )
    : null

  async function copy(payload: string) {
    const ok = await copyText(payload)
    setCopyState(ok ? 'ok' : 'fail')
    window.setTimeout(() => setCopyState('idle'), 3000)
  }

  let content
  if (error) content = <ErrorState error={error} onRetry={refetch} />
  else if (loading && !data) content = <ListSkeleton rows={2} />
  else if (!invoice || !pix) {
    content = (
      <EmptyState title="Cobrança não encontrada">
        Ela pode ter sido removida ou não pertencer à sua conta.
      </EmptyState>
    )
  } else if (!isPayable(invoice.effective_status)) {
    content = (
      <Alert variant="info">
        <AlertTitle>Esta cobrança não está em aberto</AlertTitle>
        <AlertDescription>Não é preciso pagar nada por ela.</AlertDescription>
      </Alert>
    )
  } else if ('notConfigured' in pix) {
    content = (
      <Alert variant="warning">
        <AlertTitle>Pix ainda não configurado</AlertTitle>
        <AlertDescription className="space-y-2">
          <p>
            A professora ainda não cadastrou a chave Pix. Fale com ela para combinar o
            pagamento.
          </p>
          {whatsappLink ? (
            <Button asChild variant="outline" size="sm">
              <a href={whatsappLink} target="_blank" rel="noopener noreferrer">
                Falar com a professora no WhatsApp
              </a>
            </Button>
          ) : null}
        </AlertDescription>
      </Alert>
    )
  } else if ('error' in pix) {
    content = (
      <Alert variant="destructive">
        <AlertTitle>Não foi possível gerar o Pix</AlertTitle>
        <AlertDescription>
          {pix.error} Fale com a professora para conferir os dados de recebimento.
        </AlertDescription>
      </Alert>
    )
  } else {
    content = (
      <Card className="items-center gap-4 text-center">
        <p className="text-sm text-muted-foreground">Valor a pagar</p>
        <p className="-mt-3 text-3xl font-bold">
          {formatBRL(invoice.amount_cents / 100)}
        </p>
        <p className="text-sm text-muted-foreground">
          Vencimento: {formatDateOnly(invoice.due_date)}
          {settings.receiver_name ? ` · Recebedor: ${settings.receiver_name}` : ''}
        </p>

        <Suspense fallback={<Skeleton className="size-56 rounded-xl" />}>
          <PixQrCode value={pix.payload} />
        </Suspense>

        <div className="w-full space-y-2 text-left">
          <p className="text-sm font-medium">Pix copia e cola</p>
          <p
            className="rounded-md bg-muted p-3 font-mono text-xs break-all select-all"
            data-testid="pix-code"
          >
            {pix.payload}
          </p>
          <Button className="w-full" onClick={() => void copy(pix.payload)}>
            {copyState === 'ok' ? (
              <Check aria-hidden="true" className="size-4" />
            ) : (
              <Copy aria-hidden="true" className="size-4" />
            )}
            {copyState === 'ok' ? 'Código copiado' : 'Copiar código'}
          </Button>
          <p role="status" aria-live="polite" className="min-h-5 text-sm">
            {copyState === 'ok' ? 'Código Pix copiado.' : null}
            {copyState === 'fail'
              ? 'Não foi possível copiar. Selecione o código acima e copie manualmente.'
              : null}
          </p>
        </div>

        <Alert variant="info" role="note" className="text-left">
          A confirmação do pagamento é manual: depois de pagar, volte ao Financeiro e
          toque em &quot;Já paguei&quot; para avisar a professora. Ela confere e confirma.
        </Alert>
      </Card>
    )
  }

  return (
    <div className="mx-auto max-w-md space-y-4">
      <Back />
      <h1 className="text-2xl font-bold">Pagar via Pix</h1>
      {content}
    </div>
  )
}
