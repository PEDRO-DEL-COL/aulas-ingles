import { useState } from 'react'
import { Link, Navigate, useLocation } from 'react-router'

import {
  AuthScreen,
  LoadingScreen,
  ProfileErrorScreen,
  UnconfiguredNotice,
} from '@/components/auth/AuthScreen'
import { Button } from '@/components/ui/button'
import { CURRENT_TERMS_VERSION } from '@/config/legal'
import { homePathForRole, isReleased, needsTerms } from '@/lib/auth/access'
import { returnFromState } from '@/lib/auth/returnTo'
import { useAuth } from '@/lib/auth/useAuth'
import { getSupabase } from '@/lib/supabase'

export default function AceiteTermos() {
  const { status, profile, profileError, refreshProfile, signOut } = useAuth()
  const location = useLocation()
  const [checked, setChecked] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (status === 'loading') return <LoadingScreen />
  if (status === 'unconfigured') return <UnconfiguredNotice />
  if (status === 'signed_out') return <Navigate to="/login" replace />
  if (profileError) return <ProfileErrorScreen />
  if (!profile || !isReleased(profile))
    return <Navigate to="/acesso-nao-liberado" replace />
  if (!needsTerms(profile)) {
    const from = returnFromState(location.state)
    return (
      <Navigate
        to={from === '/app' ? (homePathForRole(profile.role) ?? '/app') : from}
        replace
      />
    )
  }

  async function handleAccept() {
    setBusy(true)
    setError(null)
    try {
      const { error: rpcError } = await getSupabase().rpc('accept_terms', {
        p_version: CURRENT_TERMS_VERSION,
      })
      if (rpcError) throw rpcError
      await refreshProfile() // o render seguinte redireciona
    } catch {
      setError('Não foi possível registrar o aceite. Tente de novo.')
      setBusy(false)
    }
  }

  return (
    <AuthScreen title="Termos e privacidade">
      <p>
        Para usar a área restrita, precisamos do seu aceite. Em resumo: guardamos apenas
        os dados necessários para as aulas (nome, contato, histórico de aulas e
        financeiro), só você e a professora têm acesso a eles, e você pode pedir correção
        ou exclusão quando quiser.
      </p>
      <p>
        Leia o texto completo na{' '}
        <Link
          to="/privacidade"
          target="_blank"
          className="text-primary underline underline-offset-4"
        >
          política de privacidade e termos
        </Link>
        .
      </p>
      <p className="rounded-md bg-muted p-3 text-muted-foreground">
        Aluno menor de idade: o consentimento do responsável é registrado pela professora
        na ficha do aluno.
      </p>
      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => setChecked(e.target.checked)}
          className="mt-0.5 size-5 shrink-0 accent-primary"
        />
        <span>Li e aceito os termos e a política de privacidade.</span>
      </label>
      {error ? (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      ) : null}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button onClick={() => void handleAccept()} disabled={!checked || busy}>
          {busy ? 'Registrando…' : 'Aceitar e continuar'}
        </Button>
        <Button variant="outline" onClick={() => void signOut()} disabled={busy}>
          Sair
        </Button>
      </div>
    </AuthScreen>
  )
}
