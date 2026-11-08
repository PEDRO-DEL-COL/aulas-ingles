import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router'

import { AppShell } from '@/components/app/AppShell'
import { ProfessoraNav } from '@/features/professora/components/ProfessoraNav'
import { EmptyState, ListSkeleton } from '@/features/shared/components/StateViews'

const Hoje = lazy(() => import('@/pages/professora/Hoje'))
const Calendario = lazy(() => import('@/pages/professora/Calendario'))
const Alunos = lazy(() => import('@/pages/professora/Alunos'))
const AlunoFicha = lazy(() => import('@/pages/professora/AlunoFicha'))
const AulaRegistro = lazy(() => import('@/pages/professora/AulaRegistro'))
const Financeiro = lazy(() => import('@/pages/professora/Financeiro'))
const Materiais = lazy(() => import('@/pages/professora/Materiais'))
const Mais = lazy(() => import('@/pages/professora/Mais'))
const Interessados = lazy(() => import('@/pages/professora/Interessados'))
const Perfil = lazy(() => import('@/pages/professora/Perfil'))
const Planilhas = lazy(() => import('@/pages/professora/Planilhas'))

export default function ProfessoraArea() {
  return (
    <AppShell nav={<ProfessoraNav />}>
      <Suspense fallback={<ListSkeleton />}>
        <Routes>
          <Route index element={<Hoje />} />
          <Route path="calendario" element={<Calendario />} />
          <Route
            path="agenda"
            element={<Navigate to="/app/professora/calendario?visao=semana" replace />}
          />
          <Route path="alunos" element={<Alunos />} />
          <Route path="alunos/novo" element={<AlunoFicha />} />
          <Route path="alunos/:id" element={<AlunoFicha />} />
          <Route path="aulas/:id" element={<AulaRegistro />} />
          <Route path="financeiro" element={<Financeiro />} />
          <Route path="materiais" element={<Materiais />} />
          <Route
            path="feriados"
            element={<Navigate to="/app/professora/calendario?painel=feriados" replace />}
          />
          <Route path="mais" element={<Mais />} />
          <Route path="interessados" element={<Interessados />} />
          <Route path="perfil" element={<Perfil />} />
          <Route
            path="disponibilidade"
            element={<Navigate to="/app/professora/calendario?painel=horario" replace />}
          />
          <Route path="planilhas" element={<Planilhas />} />
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
