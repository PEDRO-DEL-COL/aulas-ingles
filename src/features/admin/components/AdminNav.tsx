import { Ellipsis, KeyRound, Scale, Tags, UsersRound } from 'lucide-react'

import { AreaNav, type AreaNavItem } from '@/components/app/AreaNav'

const items: AreaNavItem[] = [
  { to: '/app/admin/usuarios', label: 'Usuários', icon: UsersRound },
  { to: '/app/admin/planos', label: 'Planos', icon: Tags },
  { to: '/app/admin/politicas', label: 'Políticas', icon: Scale },
  { to: '/app/admin/configuracoes', label: 'Pix e contato', icon: KeyRound },
  { to: '/app/admin/mais', label: 'Mais', icon: Ellipsis },
]

export function AdminNav() {
  return <AreaNav items={items} />
}
