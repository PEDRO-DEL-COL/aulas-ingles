import { useState } from 'react'
import { Link } from 'react-router'

import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { formatBRL } from '@/lib/format'
import { useQuery } from '@/lib/data/useQuery'
import { listInvoices, notifyPaid } from '@/features/aluno/api'
import { useAluno } from '@/features/aluno/AlunoContext'
import {
  EmptyState,
  ErrorState,
  ListSkeleton,
  PageHeader,
} from '@/features/shared/components/StateViews'
import { InvoiceStatusBadge } from '@/features/aluno/components/StatusBadges'
import {
  formatDateOnly,
  formatDateTime,
  formatReferenceMonth,
} from '@/features/shared/datetime'
import { PREVIEW_UNAVAILABLE } from '@/features/aluno/preview'
import { isPayable, type Invoice } from '@/features/aluno/invoices'

function title(i: Invoice): string {
  if (i.description) return i.description
  if (i.reference_month)
    return `Mensalidade de ${formatReferenceMonth(i.reference_month)}`
  return 'Cobrança'
}

export default function Financeiro() {
  useDocumentTitle('Financeiro')
  const { student, timezone, readOnly } = useAluno()
  const { data, error, loading, refetch } = useQuery(`invoices:${student.id}`, () =>
    listInvoices(student.id),
  )
  const [busyId, setBusyId] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})

  async function sendNotice(id: string) {
    if (readOnly) return
    setBusyId(id)
    setErrors((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
    try {
      await notifyPaid(id)
      refetch()
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Não foi possível enviar o aviso.'
      setErrors((prev) => ({ ...prev, [id]: message }))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div>
      <PageHeader title="Financeiro" description="Suas mensalidades e pagamentos." />
      {error ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : loading && !data ? (
        <ListSkeleton />
      ) : !data || data.length === 0 ? (
        <EmptyState title="Nenhuma cobrança por enquanto">
          Quando a professora lançar uma cobrança, ela aparece aqui.
        </EmptyState>
      ) : (
        <ul className="space-y-3">
          {data.map((i) => {
            const payable = isPayable(i.effective_status)
            return (
              <li key={i.id}>
                <Card>
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="font-semibold first-letter:uppercase">{title(i)}</h2>
                    <InvoiceStatusBadge status={i.effective_status} />
                  </div>
                  <p className="text-2xl font-bold">{formatBRL(i.amount_cents / 100)}</p>
                  <p className="text-sm text-muted-foreground">
                    Vencimento: {formatDateOnly(i.due_date)}
                    {i.paid_at ? ` · Pago em ${formatDateTime(i.paid_at, timezone)}` : ''}
                  </p>

                  {payable ? (
                    <div className="space-y-2">
                      <Button asChild className="w-full sm:w-auto">
                        <Link to={`/app/aluno/financeiro/${i.id}/pix`}>
                          Pagar via Pix
                        </Link>
                      </Button>
                      {i.student_notified_paid_at ? (
                        <p className="text-sm text-success">
                          Aviso enviado em{' '}
                          {formatDateTime(i.student_notified_paid_at, timezone)}. A
                          professora vai conferir e confirmar o pagamento.
                        </p>
                      ) : (
                        <div>
                          <Button
                            variant="outline"
                            className="w-full sm:w-auto"
                            disabled={readOnly || busyId === i.id}
                            onClick={() => void sendNotice(i.id)}
                          >
                            {busyId === i.id ? 'Enviando…' : 'Já paguei'}
                          </Button>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {readOnly
                              ? PREVIEW_UNAVAILABLE
                              : 'Isso apenas avisa a professora. O pagamento só é confirmado por ela.'}
                          </p>
                        </div>
                      )}
                      {errors[i.id] ? (
                        <Alert variant="destructive">{errors[i.id]}</Alert>
                      ) : null}
                    </div>
                  ) : null}
                </Card>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
