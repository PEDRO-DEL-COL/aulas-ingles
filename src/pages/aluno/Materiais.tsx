import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useQuery } from '@/lib/data/useQuery'
import { listMaterials, type Material } from '@/features/aluno/api'
import { useAluno } from '@/features/aluno/AlunoContext'
import {
  EmptyState,
  ErrorState,
  ListSkeleton,
  PageHeader,
} from '@/features/shared/components/StateViews'
import { MaterialItem } from '@/features/aluno/components/MaterialItem'
import { MATERIAL_TYPES } from '@/features/aluno/components/materialTypes'

const ORDER: Material['type'][] = ['drive', 'pdf', 'audio', 'video', 'link', 'outro']

export default function Materiais() {
  useDocumentTitle('Materiais')
  const { student, readOnly } = useAluno()
  const { data, error, loading, refetch } = useQuery(
    `materiais:${student.id}:${readOnly}`,
    () => listMaterials(readOnly ? student.id : undefined),
  )

  return (
    <div>
      <PageHeader title="Materiais" description="Links e arquivos para estudar." />
      {error ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : loading && !data ? (
        <ListSkeleton />
      ) : !data || data.length === 0 ? (
        <EmptyState title="Nenhum material por enquanto">
          Os materiais indicados pela professora aparecem aqui.
        </EmptyState>
      ) : (
        <div className="space-y-5">
          {ORDER.map((type) => {
            const items = data.filter((m) => m.type === type)
            if (items.length === 0) return null
            return (
              <section key={type} aria-labelledby={`mat-${type}`}>
                <h2
                  id={`mat-${type}`}
                  className="mb-2 text-sm font-semibold text-muted-foreground"
                >
                  {MATERIAL_TYPES[type].label}
                </h2>
                <ul className="space-y-2">
                  {items.map((m) => (
                    <li key={m.id}>
                      <MaterialItem material={m} />
                    </li>
                  ))}
                </ul>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
