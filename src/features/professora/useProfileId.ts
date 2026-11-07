import { useAuth } from '@/lib/auth/useAuth'

export function useProfileId(): string | null {
  const { profile, user } = useAuth()
  return profile?.id ?? user?.id ?? null
}
