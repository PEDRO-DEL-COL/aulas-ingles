import { safeTimezone } from '@/features/shared/datetime'
import { useAuth } from '@/lib/auth/useAuth'

/** Fuso do perfil da professora (padrão America/Sao_Paulo). */
export function useTimezone(): string {
  const { profile } = useAuth()
  return safeTimezone(profile?.timezone)
}
