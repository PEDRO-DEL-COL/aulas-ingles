import { useAuth } from '@/lib/auth/useAuth'

export function Greeting() {
  const { profile, user } = useAuth()
  const first = (profile?.full_name || user?.email || '').split(' ')[0]
  return <h1 className="text-2xl font-bold">Olá, {first}</h1>
}
