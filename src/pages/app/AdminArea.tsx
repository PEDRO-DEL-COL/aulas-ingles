import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router'

import { AppShell } from '@/components/app/AppShell'
import { AdminNav } from '@/features/admin/components/AdminNav'
import { EmptyState, ListSkeleton } from '@/features/shared/components/StateViews'

const Usuarios = lazy(() => import('@/pages/admin/Usuarios'))
const Planos = lazy(() => import('@/pages/admin/Planos'))
const Politicas = lazy(() => import('@/pages/admin/Politicas'))
const Configuracoes = lazy(() => import('@/pages/admin/Configuracoes'))
const Mais = lazy(() => import('@/pages/admin/Mais'))
const Backup = lazy(() => import('@/pages/admin/Backup'))

/** Área do admin. As telas da professora ficam em /app/professora (o admin também acessa). */
export default function AdminArea() {
  return (
    <AppShell nav={<AdminNav />}>
      <Suspense fallback={<ListSkeleton />}>
        <Routes>
          <Route index element={<Navigate to="usuarios" replace />} />
          <Route path="usuarios" element={<Usuarios />} />
          <Route path="planos" element={<Planos />} />
          <Route path="politicas" element={<Politicas />} />
          <Route path="configuracoes" element={<Configuracoes />} />
          <Route path="mais" element={<Mais />} />
          <Route path="backup" element={<Backup />} />
          <Route
            path="*"
            element={
              <EmptyState title="Página não encontrada">
                Use o menu para voltar a uma tela da administração.
              </EmptyState>
            }
          />
        </Routes>
      </Suspense>
    </AppShell>
  )
}
