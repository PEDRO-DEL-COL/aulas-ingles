import { useRef, type KeyboardEvent } from 'react'
import { useNavigate } from 'react-router'

import { homePathForRole } from '@/lib/auth/access'
import { useViewAs } from '@/lib/auth/useViewAs'
import { VIEW_AS_OPTIONS, type ViewAsRole } from '@/lib/auth/viewAs'
import { cn } from '@/lib/utils'

/**
 * Seletor "Ver como" (só admin real): 3 posições com pílula deslizante.
 * Só muda a visualização no front; o papel real e a RLS não mudam.
 */
export function ViewAsSwitcher({ className }: { className?: string }) {
  const { canViewAs, viewAs, setViewAs } = useViewAs()
  const navigate = useNavigate()
  const refs = useRef<(HTMLButtonElement | null)[]>([])

  if (!canViewAs) return null

  const index = Math.max(
    0,
    VIEW_AS_OPTIONS.findIndex((o) => o.value === viewAs),
  )

  function choose(next: ViewAsRole) {
    if (next === viewAs) return
    setViewAs(next)
    void navigate(homePathForRole(next) ?? '/app')
  }

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    const last = VIEW_AS_OPTIONS.length - 1
    let target = index
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown')
      target = index === last ? 0 : index + 1
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp')
      target = index === 0 ? last : index - 1
    else if (e.key === 'Home') target = 0
    else if (e.key === 'End') target = last
    else return
    e.preventDefault()
    refs.current[target]?.focus()
    choose(VIEW_AS_OPTIONS[target]!.value)
  }

  return (
    <div
      role="radiogroup"
      aria-label="Ver como"
      className={cn(
        'relative grid w-[14.5rem] grid-cols-3 rounded-full border bg-lavender p-0.5 text-xs font-medium',
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="absolute inset-y-0.5 left-0.5 w-[calc((100%-0.25rem)/3)] rounded-full bg-primary shadow-xs transition-transform duration-200 ease-out motion-reduce:transition-none"
        style={{ transform: `translateX(${index * 100}%)` }}
      />
      {VIEW_AS_OPTIONS.map((o, i) => {
        const checked = i === index
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[i] = el
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={checked ? 0 : -1}
            onClick={() => choose(o.value)}
            onKeyDown={onKeyDown}
            className={cn(
              'relative z-10 truncate rounded-full px-1 py-1 transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 motion-reduce:transition-none',
              checked
                ? 'text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
