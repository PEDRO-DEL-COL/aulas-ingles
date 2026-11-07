import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router'

import { AppShell } from '@/components/app/AppShell'
import { ProfessoraNav } from '@/features/professora/components/ProfessoraNav'
import { EmptyState, ListSkeleton } from '@/features/shared/components/StateViews'

const Hoje = lazy(() => import('@/pages/professora/Hoje'))
const Agenda = lazy(() => import('@/pages/professora/Agenda'))
const Alunos = lazy(() => import('@/pages/professora/Alunos'))
const AlunoFicha = lazy(() => import('@/pages/professora/AlunoFicha'))
const AulaRegistro = lazy(() => import('@/pages/professora/AulaRegistro'))

export default function ProfessoraArea() {
  return (
    <AppShell nav={<ProfessoraNav />}>
      <Suspense fallback={<ListSkeleton />}>
        <Routes>
          <Route index element={<Hoje />} />
          <Route path="agenda" element={<Agenda />} />
          <Route path="alunos" element={<Alunos />} />
          <Route path="alunos/novo" element={<AlunoFicha />} />
          <Route path="alunos/:id" element={<AlunoFicha />} />
          <Route path="aulas/:id" element={<AulaRegistro />} />
          <Route
            path="*"
            element={
              <EmptyState title="Página não encontrada">
                Use o menu para voltar a uma tela da área da professora.
              </EmptyState>
            }
          />
        </Routes>
      </Suspense>
    </AppShell>
  )
}
