import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'

import { homePathForRole, resolveAccessAs, type UserRole } from '@/lib/auth/access'
import { useAuth } from '@/lib/auth/useAuth'
import { useViewAs } from '@/lib/auth/useViewAs'

import { LoadingScreen, ProfileErrorScreen, UnconfiguredNotice } from './AuthScreen'

/**
 * Guarda de rota por papel EFETIVO (admin pode "ver como" outro papel).
 * Liberação e termos continuam pelo perfil real. Não importa supabase-js (só o contexto).
 */
export function RequireRole({
  roles,
  children,
}: {
  roles: readonly UserRole[]
  children: ReactNode
}) {
  const { status, profile, profileError } = useAuth()
  const { role: effectiveRole } = useViewAs()
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
  switch (resolveAccessAs(profile, effectiveRole, roles)) {
    case 'allowed':
      return <>{children}</>
    case 'not_released':
      return <Navigate to="/acesso-nao-liberado" replace />
    case 'needs_terms':
      return <Navigate to="/termos/aceite" replace state={{ from }} />
    case 'forbidden':
      return (
        <Navigate
          to={homePathForRole(effectiveRole ?? profile?.role) ?? '/acesso-nao-liberado'}
          replace
        />
      )
  }
}

/** Index de /app: manda cada papel (efetivo) para a sua área. */
export function AppHomeRedirect() {
  const { profile } = useAuth()
  const { role } = useViewAs()
  return (
    <Navigate
      to={homePathForRole(role ?? profile?.role) ?? '/acesso-nao-liberado'}
      replace
    />
  )
}
