import { CalendarDays, House, Users } from 'lucide-react'
import type { ComponentType } from 'react'
import { NavLink } from 'react-router'

import { cn } from '@/lib/utils'

const items: {
  to: string
  label: string
  end?: boolean
  icon: ComponentType<{ className?: string; 'aria-hidden'?: boolean }>
}[] = [
  { to: '/app/professora', label: 'Hoje', end: true, icon: House },
  { to: '/app/professora/agenda', label: 'Agenda', icon: CalendarDays },
  { to: '/app/professora/alunos', label: 'Alunos', icon: Users },
]

export function ProfessoraNav() {
  return (
    <ul className="mx-auto flex max-w-5xl items-stretch justify-between gap-1 md:justify-start md:gap-2">
      {items.map(({ to, label, end, icon: Icon }) => (
        <li key={to} className="flex-1 md:flex-none">
          <NavLink
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center gap-0.5 rounded-lg px-1 py-1.5 text-[11px] font-medium text-muted-foreground transition-colors outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 md:flex-row md:gap-2 md:px-3 md:text-sm',
                isActive && 'bg-lavender text-primary',
              )
            }
          >
            <Icon aria-hidden={true} className="size-5" />
            {label}
          </NavLink>
        </li>
      ))}
    </ul>
  )
}
