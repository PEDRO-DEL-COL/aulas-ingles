import { useMemo, type ReactNode } from 'react'

import { useAuth } from '@/lib/auth/useAuth'
import { useQuery } from '@/lib/data/useQuery'

import { getMyStudent, getSettings } from './api'
import { AlunoContext, type AlunoValue } from './AlunoContext'
import { ErrorState, ListSkeleton } from './components/StateViews'
import { safeTimezone } from './datetime'
import { EmptyState } from './components/StateViews'

/** Carrega a ficha do aluno e as configurações uma vez para toda a área. */
export function AlunoProvider({ children }: { children: ReactNode }) {
  const { profile, user } = useAuth()
  const profileId = profile?.id ?? user?.id ?? ''
  const { data, error, loading, refetch } = useQuery(`aluno:${profileId}`, async () => {
    const [student, settings] = await Promise.all([
      getMyStudent(profileId),
      getSettings(),
    ])
    return { student, settings }
  })
  const timezone = safeTimezone(profile?.timezone)

  const value = useMemo<AlunoValue | null>(
    () =>
      data?.student ? { student: data.student, settings: data.settings, timezone } : null,
    [data, timezone],
  )

  if (value)
    return <AlunoContext.Provider value={value}>{children}</AlunoContext.Provider>
  if (error) return <ErrorState error={error} onRetry={refetch} />
  if (loading) return <ListSkeleton />
  return (
    <EmptyState title="Ficha de aluno não encontrada">
      Não encontramos a sua ficha. Fale com a professora para conferir o seu cadastro.
    </EmptyState>
  )
}
