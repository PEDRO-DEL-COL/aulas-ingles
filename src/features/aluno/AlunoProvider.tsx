import { Eye, Search } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/field'
import { useAuth } from '@/lib/auth/useAuth'
import { useViewAs } from '@/lib/auth/useViewAs'
import { useQuery } from '@/lib/data/useQuery'
import {
  EmptyState,
  ErrorState,
  ListSkeleton,
  PageHeader,
} from '@/features/shared/components/StateViews'
import { safeTimezone } from '@/features/shared/datetime'

import { getMyStudent, getSettings, getStudentById, listStudentOptions } from './api'
import { AlunoContext, type AlunoValue } from './AlunoContext'
import { decideAlunoMode, filterStudents, STATUS_LABEL } from './preview'

/** Carrega a ficha do aluno e as configurações uma vez para toda a área. */
export function AlunoProvider({ children }: { children: ReactNode }) {
  const { canViewAs, role, previewStudentId } = useViewAs()
  const mode = decideAlunoMode({ canViewAs, role, previewStudentId })
  if (mode === 'preview-sem-aluno') return <StudentPicker />
  return (
    <AlunoLoader
      key={mode === 'preview' ? `preview:${previewStudentId}` : 'aluno'}
      previewStudentId={mode === 'preview' ? previewStudentId : null}
    >
      {children}
    </AlunoLoader>
  )
}

function AlunoLoader({
  previewStudentId,
  children,
}: {
  previewStudentId: string | null
  children: ReactNode
}) {
  const { profile, user } = useAuth()
  const { setPreviewStudentId } = useViewAs()
  const profileId = profile?.id ?? user?.id ?? ''
  const readOnly = previewStudentId !== null
  const { data, error, loading, refetch } = useQuery(
    readOnly ? `aluno-preview:${previewStudentId}` : `aluno:${profileId}`,
    async () => {
      const [student, settings] = await Promise.all([
        previewStudentId ? getStudentById(previewStudentId) : getMyStudent(profileId),
        getSettings(),
      ])
      return { student, settings }
    },
  )
  // Fuso do perfil logado (também na pré-visualização).
  const timezone = safeTimezone(profile?.timezone)

  const value = useMemo<AlunoValue | null>(
    () =>
      data?.student
        ? { student: data.student, settings: data.settings, timezone, readOnly }
        : null,
    [data, timezone, readOnly],
  )

  if (value)
    return (
      <AlunoContext.Provider value={value}>
        {readOnly ? (
          <PreviewBanner
            name={value.student.full_name}
            onChange={() => setPreviewStudentId(null)}
          />
        ) : null}
        {children}
      </AlunoContext.Provider>
    )
  if (error) return <ErrorState error={error} onRetry={refetch} />
  if (loading) return <ListSkeleton />
  if (readOnly) {
    // O aluno salvo não existe mais: volta ao seletor.
    return (
      <EmptyState title="Aluno não encontrado">
        <p>Esse aluno não existe mais. Escolha outro para pré-visualizar.</p>
        <Button className="mt-3" size="sm" onClick={() => setPreviewStudentId(null)}>
          Escolher aluno
        </Button>
      </EmptyState>
    )
  }
  return (
    <div className="rounded-xl border border-dashed bg-card p-8 text-center">
      <p className="text-lg font-semibold">Ficha de aluno não encontrada</p>
      <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
        Ainda não encontramos a sua ficha por aqui. Fale com a professora para conferir o
        seu cadastro e liberar o acesso.
      </p>
    </div>
  )
}

function PreviewBanner({ name, onChange }: { name: string; onChange: () => void }) {
  return (
    <div
      role="status"
      className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-sm"
    >
      <p className="flex items-center gap-2">
        <Eye aria-hidden="true" className="size-4 shrink-0 text-primary" />
        <span>
          Pré-visualizando a área de <strong>{name}</strong> · somente leitura
        </span>
      </p>
      <Button variant="outline" size="sm" onClick={onChange}>
        Trocar aluno
      </Button>
    </div>
  )
}

function StudentPicker() {
  const { setPreviewStudentId } = useViewAs()
  const [query, setQuery] = useState('')
  const { data, error, loading, refetch } = useQuery('aluno-preview:options', () =>
    listStudentOptions(),
  )
  const filtered = useMemo(() => filterStudents(data ?? [], query), [data, query])

  return (
    <div className="mx-auto max-w-md space-y-4">
      <PageHeader
        title="Escolha um aluno para pré-visualizar"
        description="Você verá a área exatamente como esse aluno vê, somente para leitura."
      />
      {error ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : loading && !data ? (
        <ListSkeleton />
      ) : !data || data.length === 0 ? (
        <EmptyState title="Nenhum aluno cadastrado">
          Cadastre um aluno para poder pré-visualizar a área dele.
        </EmptyState>
      ) : (
        <>
          <div className="relative">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              type="search"
              aria-label="Buscar aluno"
              placeholder="Buscar por nome ou e-mail"
              className="pl-9"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          {filtered.length === 0 ? (
            <EmptyState title="Nenhum aluno encontrado">
              Tente outro nome ou e-mail.
            </EmptyState>
          ) : (
            <ul className="space-y-2">
              {filtered.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => setPreviewStudentId(s.id)}
                    className="flex min-h-14 w-full items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3 text-left outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{s.full_name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {s.email}
                      </span>
                    </span>
                    <Badge tone={s.status === 'ativo' ? 'success' : 'muted'}>
                      {STATUS_LABEL[s.status]}
                    </Badge>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  )
}
