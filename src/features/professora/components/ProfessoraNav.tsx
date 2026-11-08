import { CalendarDays, Ellipsis, House, Users, Wallet } from 'lucide-react'

import { AreaNav, type AreaNavItem } from '@/components/app/AreaNav'

// Cinco itens cabem na barra do celular; Materiais e (para o admin)
// a Administração ficam em "Mais".
const items: AreaNavItem[] = [
  { to: '/app/professora', label: 'Hoje', end: true, icon: House },
  { to: '/app/professora/calendario', label: 'Calendário', icon: CalendarDays },
  { to: '/app/professora/alunos', label: 'Alunos', icon: Users },
  { to: '/app/professora/financeiro', label: 'Financeiro', icon: Wallet },
  { to: '/app/professora/mais', label: 'Mais', icon: Ellipsis },
]

export function ProfessoraNav() {
  return <AreaNav items={items} />
}
