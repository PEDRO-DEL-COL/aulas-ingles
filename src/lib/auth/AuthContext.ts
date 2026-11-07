import type { Session, User } from '@supabase/supabase-js'
import { createContext } from 'react'

import type { Profile } from './access'

export type AuthStatus = 'loading' | 'unconfigured' | 'signed_out' | 'signed_in'

export type AuthValue = {
  status: AuthStatus
  session: Session | null
  user: User | null
  profile: Profile | null
  /** Mensagem em pt-BR quando falhou carregar o profile. */
  profileError: string | null
  signInWithGoogle: () => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

export const AuthContext = createContext<AuthValue | undefined>(undefined)
