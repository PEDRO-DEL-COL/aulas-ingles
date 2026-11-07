import { ArrowLeft } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router'

import { Skeleton } from '@/components/ui/skeleton'
import { getStudent, listActivePlans } from '@/features/professora/api'
import { GuardianPayerSection } from '@/features/professora/components/GuardianPayerSection'
import { PrivateNotesSection } from '@/features/professora/components/PrivateNotesSection'
import { RecentLessonsSection } from '@/features/professora/components/RecentLessonsSection'
import { SchedulesSection } from '@/features/professora/components/SchedulesSection'
import { StudentForm } from '@/features/professora/components/StudentForm'
import { useTimezone } from '@/features/professora/useTimezone'
import { EmptyState, ErrorState } from '@/features/shared/components/StateViews'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useQuery } from '@/lib/data/useQuery'

const BACK = (
  <Link
    to="/app/professora/alunos"
    className="inline-flex items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline"
  >
    <ArrowLeft aria-hidden="true" className="size-4" />
    Alunos
  </Link>
)

export default function AlunoFicha() {
  const { id } = useParams()
  const navigate = useNavigate()
  const timezone = useTimezone()
  useDocumentTitle(id ? 'Ficha do aluno' : 'Novo aluno')

  const plans = useQuery('prof-planos', listActivePlans)
  const student = useQuery(`prof-aluno:${id ?? 'novo'}`, async () =>
    id ? getStudent(id) : null,
  )

  const error = plans.error ?? student.error
  const retry = () => {
    plans.refetch()
    student.refetch()
  }

  return (
    <div className="space-y-4">
      {BACK}
      <h1 className="text-2xl font-bold">
        {id ? (student.data?.full_name ?? 'Ficha do aluno') : 'Novo aluno'}
      </h1>

      {error ? (
        <ErrorState error={error} onRetry={retry} />
      ) : !plans.data || student.data === undefined ? (
        <div role="status" className="space-y-3">
          <span className="sr-only">Carregando…</span>
          <Skeleton className="h-64 w-full rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
      ) : id && student.data === null ? (
        <EmptyState title="Aluno não encontrado">
          A ficha pode ter sido removida. Volte para a lista de alunos.
        </EmptyState>
      ) : (
        <>
          <StudentForm
            student={student.data}
            plans={plans.data}
            timezone={timezone}
            onSaved={(saved) => {
              if (!id)
                void navigate(`/app/professora/alunos/${saved.id}`, { replace: true })
              else student.refetch()
            }}
          />
          {student.data ? (
            <>
              <Link
                to={`/app/professora/financeiro?aluno=${student.data.id}`}
                className="inline-block text-sm font-medium text-primary underline-offset-4 hover:underline"
              >
                Lançar cobrança para este aluno
              </Link>
              <SchedulesSection studentId={student.data.id} timezone={timezone} />
              <GuardianPayerSection
                studentId={student.data.id}
                defaultPayerId={student.data.default_payer_id}
                onStudentChanged={student.refetch}
              />
              <PrivateNotesSection studentId={student.data.id} timezone={timezone} />
              <RecentLessonsSection studentId={student.data.id} timezone={timezone} />
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Depois de cadastrar, você poderá definir horários fixos, responsáveis e
              anotações.
            </p>
          )}
        </>
      )}
    </div>
  )
}
