import type { ComponentType } from 'react'
import { NavLink } from 'react-router'

import { cn } from '@/lib/utils'

export type AreaNavItem = {
  to: string
  label: string
  end?: boolean
  icon: ComponentType<{ className?: string; 'aria-hidden'?: boolean }>
}

/** Navegação de uma área logada (barra fixa embaixo no celular, horizontal a partir de md). */
export function AreaNav({ items }: { items: readonly AreaNavItem[] }) {
  return (
    <ul className="mx-auto flex max-w-5xl items-stretch justify-between gap-1 md:justify-start md:gap-2">
      {items.map(({ to, label, end, icon: Icon }) => (
        <li key={to} className="min-w-0 flex-1 md:flex-none">
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
            <Icon aria-hidden={true} className="size-5 shrink-0" />
            <span className="max-w-full truncate">{label}</span>
          </NavLink>
        </li>
      ))}
    </ul>
  )
}
