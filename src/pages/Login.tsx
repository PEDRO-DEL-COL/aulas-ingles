import { useState } from 'react'
import { Link, Navigate, useLocation } from 'react-router'

import {
  AuthScreen,
  LoadingScreen,
  UnconfiguredNotice,
} from '@/components/auth/AuthScreen'
import { Button } from '@/components/ui/button'
import { returnFromState, stashReturnTo } from '@/lib/auth/returnTo'
import { useAuth } from '@/lib/auth/useAuth'

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5">
      <path
        fill="#4285F4"
        d="M22.5 12.27c0-.8-.07-1.56-.2-2.3H12v4.35h5.9a5.05 5.05 0 0 1-2.19 3.31v2.75h3.54c2.07-1.91 3.25-4.72 3.25-8.11z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.67l-3.54-2.75c-.98.66-2.24 1.05-3.74 1.05-2.87 0-5.3-1.94-6.17-4.55H2.17v2.84A11 11 0 0 0 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.83 14.08a6.6 6.6 0 0 1 0-4.16V7.08H2.17a11 11 0 0 0 0 9.84l3.66-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 5.37c1.62 0 3.07.56 4.21 1.65l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.17 7.08l3.66 2.84C6.7 7.31 9.13 5.37 12 5.37z"
      />
    </svg>
  )
}

export default function Login() {
  const { status, signInWithGoogle } = useAuth()
  const location = useLocation()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (status === 'loading') return <LoadingScreen />
  if (status === 'signed_in') {
    return <Navigate to={returnFromState(location.state)} replace />
  }
  if (status === 'unconfigured') return <UnconfiguredNotice />

  async function handleClick() {
    setBusy(true)
    setError(null)
    stashReturnTo(returnFromState(location.state))
    const result = await signInWithGoogle()
    if (result.error) {
      setError(result.error)
      setBusy(false)
    }
  }

  return (
    <AuthScreen
      title="Entrar"
      footer={
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          <Link to="/" className="text-primary underline underline-offset-4">
            Voltar ao site
          </Link>
          <Link to="/privacidade" className="text-primary underline underline-offset-4">
            Privacidade e termos
          </Link>
        </div>
      }
    >
      <p className="text-muted-foreground">
        O acesso é só para alunos cadastrados pela professora. Você precisa de uma conta
        Google com o mesmo e-mail que ela cadastrou.
      </p>
      <Button
        size="lg"
        className="w-full"
        onClick={() => void handleClick()}
        disabled={busy}
      >
        <span className="rounded-full bg-white p-0.5">
          <GoogleIcon />
        </span>
        {busy ? 'Abrindo o Google…' : 'Entrar com Google'}
      </Button>
      {error ? (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      ) : null}
    </AuthScreen>
  )
}
