import type { ReactNode } from 'react'
import { Link } from 'react-router'

import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth/useAuth'

export function LoadingScreen({ label = 'Carregando…' }: { label?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-svh items-center justify-center bg-background p-6 text-muted-foreground"
    >
      {label}
    </div>
  )
}

/** Cartão centralizado usado pelas telas de login, aviso e erro. */
export function AuthScreen({
  title,
  children,
  footer,
}: {
  title: string
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <main className="flex min-h-svh items-center justify-center bg-background p-4">
      <div className="w-full max-w-md rounded-xl border bg-card p-6 text-card-foreground shadow-sm">
        <h1 className="text-2xl font-bold">{title}</h1>
        <div className="mt-3 space-y-4 text-sm leading-relaxed">{children}</div>
        {footer ? <div className="mt-6 border-t pt-4 text-sm">{footer}</div> : null}
      </div>
    </main>
  )
}

export function UnconfiguredNotice() {
  return (
    <AuthScreen
      title="Login ainda não configurado"
      footer={
        <Link to="/" className="text-primary underline underline-offset-4">
          Voltar ao site
        </Link>
      }
    >
      <p className="text-muted-foreground">
        Login ainda não configurado neste ambiente. A área restrita fica disponível depois
        que o Supabase for conectado.
      </p>
      {import.meta.env.DEV ? (
        <p className="rounded-md bg-muted p-3 text-muted-foreground">
          Em desenvolvimento: defina <code>VITE_SUPABASE_URL</code> e{' '}
          <code>VITE_SUPABASE_ANON_KEY</code> no arquivo <code>.env</code> (veja{' '}
          <code>.env.example</code>) e reinicie o servidor.
        </p>
      ) : null}
    </AuthScreen>
  )
}

export function ProfileErrorScreen() {
  const { refreshProfile, signOut, profileError } = useAuth()
  return (
    <AuthScreen title="Algo deu errado">
      <p role="alert" className="text-muted-foreground">
        {profileError ?? 'Não foi possível carregar o seu perfil.'}
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button onClick={() => void refreshProfile()}>Tentar de novo</Button>
        <Button variant="outline" onClick={() => void signOut()}>
          Sair
        </Button>
      </div>
    </AuthScreen>
  )
}
