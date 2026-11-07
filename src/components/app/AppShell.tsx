import type { ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import { brand } from '@/config/brand'
import { useAuth } from '@/lib/auth/useAuth'

/**
 * Layout da área logada. `nav` recebe a navegação (links) de cada área;
 * no celular fica fixa embaixo, a partir de md vira barra horizontal sob o cabeçalho.
 */
export function AppShell({ children, nav }: { children: ReactNode; nav?: ReactNode }) {
  const { profile, user, signOut } = useAuth()
  const name = profile?.full_name || user?.email || ''

  return (
    <div className="flex min-h-svh flex-col bg-background text-foreground">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <span className="truncate font-semibold">{brand.name}</span>
          <div className="flex items-center gap-3">
            <span className="hidden max-w-[16rem] truncate text-sm text-muted-foreground sm:inline">
              {name}
            </span>
            <Button variant="outline" size="sm" onClick={() => void signOut()}>
              Sair
            </Button>
          </div>
        </div>
        {nav ? (
          <nav
            aria-label="Principal"
            className="mx-auto hidden max-w-5xl px-4 pb-2 md:block"
          >
            {nav}
          </nav>
        ) : null}
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 p-4 pb-24 md:pb-6">
        {children}
      </main>
      {nav ? (
        <nav
          aria-label="Principal"
          className="fixed inset-x-0 bottom-0 border-t bg-card p-2 md:hidden"
        >
          {nav}
        </nav>
      ) : null}
    </div>
  )
}
