import { CalendarDays, House, ShieldCheck, Users } from 'lucide-react'

import { AreaNav, type AreaNavItem } from '@/components/app/AreaNav'
import { useAuth } from '@/lib/auth/useAuth'

const items: AreaNavItem[] = [
  { to: '/app/professora', label: 'Hoje', end: true, icon: House },
  { to: '/app/professora/agenda', label: 'Agenda', icon: CalendarDays },
  { to: '/app/professora/alunos', label: 'Alunos', icon: Users },
]

const adminItem: AreaNavItem = { to: '/app/admin', label: 'Admin', icon: ShieldCheck }

export function ProfessoraNav() {
  const { profile } = useAuth()
  return <AreaNav items={profile?.role === 'admin' ? [...items, adminItem] : items} />
}
