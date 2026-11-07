import type { Session } from '@supabase/supabase-js'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'

import { getSupabase, isSupabaseConfigured } from '@/lib/supabase'

import type { Profile } from './access'
import { AuthContext, type AuthStatus, type AuthValue } from './AuthContext'

type ProfileState = { userId: string; profile: Profile | null; error: string | null }

const PROFILE_ERROR =
  'Não foi possível carregar o seu perfil. Verifique a conexão e tente de novo.'

async function loadProfile(userId: string): Promise<ProfileState> {
  try {
    const { data, error } = await getSupabase()
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()
    if (error) return { userId, profile: null, error: PROFILE_ERROR }
    return { userId, profile: data, error: null }
  } catch {
    return { userId, profile: null, error: PROFILE_ERROR }
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [sessionReady, setSessionReady] = useState(!isSupabaseConfigured)
  const [profileState, setProfileState] = useState<ProfileState | null>(null)

  useEffect(() => {
    if (!isSupabaseConfigured) return
    const supabase = getSupabase()
    let active = true

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!active) return
        setSession(data.session)
        setSessionReady(true)
      })
      .catch(() => {
        if (!active) return
        setSession(null)
        setSessionReady(true)
      })

    // Não chamar o Supabase dentro deste callback (risco de deadlock): só atualiza estado.
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      if (!active) return
      setSession(next)
      setSessionReady(true)
    })

    return () => {
      active = false
      data.subscription.unsubscribe()
    }
  }, [])

  const user = session?.user ?? null
  const userId = user?.id ?? null

  useEffect(() => {
    if (!userId) return
    let active = true
    void loadProfile(userId).then((next) => {
      if (active) setProfileState(next)
    })
    return () => {
      active = false
    }
  }, [userId])

  const refreshProfile = useCallback(async () => {
    if (!userId) return
    setProfileState(null)
    setProfileState(await loadProfile(userId))
  }, [userId])

  const signInWithGoogle = useCallback(async () => {
    try {
      const { error } = await getSupabase().auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      })
      return { error: error ? 'Não foi possível iniciar o login com Google.' : null }
    } catch {
      return { error: 'Não foi possível iniciar o login com Google.' }
    }
  }, [])

  const signOut = useCallback(async () => {
    try {
      await getSupabase().auth.signOut()
    } finally {
      setSession(null)
      setProfileState(null)
    }
  }, [])

  const value = useMemo<AuthValue>(() => {
    const current = profileState && profileState.userId === userId ? profileState : null
    let status: AuthStatus
    if (!isSupabaseConfigured) status = 'unconfigured'
    else if (!sessionReady) status = 'loading'
    else if (!user) status = 'signed_out'
    else if (!current) status = 'loading'
    else status = 'signed_in'
    return {
      status,
      session,
      user,
      profile: current?.profile ?? null,
      profileError: current?.error ?? null,
      signInWithGoogle,
      signOut,
      refreshProfile,
    }
  }, [
    profileState,
    userId,
    sessionReady,
    user,
    session,
    signInWithGoogle,
    signOut,
    refreshProfile,
  ])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
