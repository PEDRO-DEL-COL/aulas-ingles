import { Suspense } from 'react'
import { Outlet } from 'react-router'

function CarregandoPagina() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-svh items-center justify-center text-muted-foreground"
    >
      Carregando…
    </div>
  )
}

export function RootLayout() {
  return (
    <Suspense fallback={<CarregandoPagina />}>
      <Outlet />
    </Suspense>
  )
}
