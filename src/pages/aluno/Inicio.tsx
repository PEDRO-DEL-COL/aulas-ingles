import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router'

import { Card, CardDescription, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatBRL } from '@/lib/format'
import { Greeting } from '@/components/app/Greeting'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useQuery } from '@/lib/data/useQuery'
import { listInvoices, listLessons, makeupsUsed } from '@/features/aluno/api'
import { useAluno } from '@/features/aluno/AlunoContext'
import { monthStartKey, formatDateOnly } from '@/features/shared/datetime'
import { useNow } from '@/features/shared/useNow'
import { pickNextInvoice } from '@/features/aluno/invoices'
import { pickNextLesson } from '@/features/aluno/lessons'
import { EmptyState, ErrorState } from '@/features/shared/components/StateViews'
import { InvoiceStatusBadge } from '@/features/aluno/components/StatusBadges'
import { NextLessonCard } from '@/features/aluno/components/NextLessonCard'

export default function Inicio() {
  useDocumentTitle('Início')
  const { student, settings } = useAluno()
  const now = useNow()

  const lessons = useQuery(`lessons:${student.id}`, () => listLessons(student.id))
  const invoices = useQuery(`invoices:${student.id}`, () => listInvoices(student.id))
  const makeups = useQuery(`makeups:${student.id}`, () =>
    makeupsUsed(student.id, monthStartKey(now)),
  )

  const next = lessons.data ? pickNextLesson(lessons.data, now) : null
  const nextInvoice = invoices.data ? pickNextInvoice(invoices.data) : null

  return (
    <div className="space-y-4">
      <Greeting />

      {lessons.error ? (
        <ErrorState error={lessons.error} onRetry={lessons.refetch} />
      ) : !lessons.data ? (
        <Skeleton className="h-52 w-full rounded-xl" />
      ) : next ? (
        <NextLessonCard key={next.id} lesson={next} />
      ) : (
        <EmptyState title="Nenhuma aula agendada ainda">
          Quando a professora marcar a sua próxima aula, ela aparece aqui.
        </EmptyState>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Card>
          <CardTitle>Próxima cobrança</CardTitle>
          {invoices.error ? (
            <ErrorState error={invoices.error} onRetry={invoices.refetch} />
          ) : !invoices.data ? (
            <Skeleton className="h-12 w-full" />
          ) : nextInvoice ? (
            <>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xl font-bold">
                  {formatBRL(nextInvoice.amount_cents / 100)}
                </span>
                <InvoiceStatusBadge status={nextInvoice.effective_status} />
              </div>
              <CardDescription>
                Vence em {formatDateOnly(nextInvoice.due_date)}
              </CardDescription>
            </>
          ) : (
            <CardDescription>Nenhuma cobrança em aberto.</CardDescription>
          )}
          <Link
            to="/app/aluno/financeiro"
            className="mt-auto inline-flex items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            Ver financeiro <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        </Card>

        <Card>
          <CardTitle>Reposições do mês</CardTitle>
          {makeups.error ? (
            <ErrorState error={makeups.error} onRetry={makeups.refetch} />
          ) : makeups.data === undefined ? (
            <Skeleton className="h-12 w-full" />
          ) : (
            <>
              <p className="text-xl font-bold">
                {makeups.data} de {settings.max_makeups_per_month}
              </p>
              <CardDescription>
                {makeups.data >= settings.max_makeups_per_month
                  ? 'Você já usou todas as reposições deste mês.'
                  : 'reposições usadas neste mês.'}
              </CardDescription>
            </>
          )}
        </Card>
      </div>
    </div>
  )
}
