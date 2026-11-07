import { Link, Navigate } from 'react-router'

import {
  AuthScreen,
  LoadingScreen,
  UnconfiguredNotice,
} from '@/components/auth/AuthScreen'
import { Button } from '@/components/ui/button'
import { popReturnTo } from '@/lib/auth/returnTo'
import { useAuth } from '@/lib/auth/useAuth'

function readOAuthError(): string | null {
  const query = new URLSearchParams(window.location.search)
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  return (
    query.get('error_description') ??
    hash.get('error_description') ??
    query.get('error') ??
    hash.get('error')
  )
}

export default function Callback() {
  const { status } = useAuth()

  if (status === 'unconfigured') return <UnconfiguredNotice />

  const oauthError = readOAuthError()
  const failed = oauthError !== null || status === 'signed_out'

  if (failed) {
    return (
      <AuthScreen title="Não foi possível entrar">
        <p role="alert" className="text-muted-foreground">
          O login com Google não foi concluído. Se você cancelou, tudo bem: é só tentar de
          novo.
        </p>
        {oauthError && import.meta.env.DEV ? (
          <p className="rounded-md bg-muted p-3 text-muted-foreground">{oauthError}</p>
        ) : null}
        <Button asChild>
          <Link to="/login">Voltar ao login</Link>
        </Button>
      </AuthScreen>
    )
  }

  if (status === 'loading') return <LoadingScreen label="Entrando…" />
  return <Navigate to={popReturnTo()} replace />
}
