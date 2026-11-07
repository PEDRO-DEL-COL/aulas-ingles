import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'

import { homePathForRole, resolveAccess, type UserRole } from '@/lib/auth/access'
import { useAuth } from '@/lib/auth/useAuth'

import { LoadingScreen, ProfileErrorScreen, UnconfiguredNotice } from './AuthScreen'

/** Guarda de rota por papel. Não importa supabase-js (só o contexto). */
export function RequireRole({
  roles,
  children,
}: {
  roles: readonly UserRole[]
  children: ReactNode
}) {
  const { status, profile, profileError } = useAuth()
  const location = useLocation()

  if (status === 'loading') return <LoadingScreen />
  if (status === 'unconfigured') return <UnconfiguredNotice />
  if (status === 'signed_out') {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname + location.search }}
      />
    )
  }
  if (profileError) return <ProfileErrorScreen />

  const from = location.pathname + location.search
  switch (resolveAccess(profile, roles)) {
    case 'allowed':
      return <>{children}</>
    case 'not_released':
      return <Navigate to="/acesso-nao-liberado" replace />
    case 'needs_terms':
      return <Navigate to="/termos/aceite" replace state={{ from }} />
    case 'forbidden':
      return (
        <Navigate to={homePathForRole(profile?.role) ?? '/acesso-nao-liberado'} replace />
      )
  }
}

/** Index de /app: manda cada papel para a sua área. */
export function AppHomeRedirect() {
  const { profile } = useAuth()
  return (
    <Navigate to={homePathForRole(profile?.role) ?? '/acesso-nao-liberado'} replace />
  )
}
