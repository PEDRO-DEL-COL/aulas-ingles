import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router'

import { AppShell } from '@/components/app/AppShell'
import { AlunoNav } from '@/features/aluno/components/AlunoNav'
import { EmptyState, ListSkeleton } from '@/features/shared/components/StateViews'
import { AlunoProvider } from '@/features/aluno/AlunoProvider'

const Inicio = lazy(() => import('@/pages/aluno/Inicio'))
const Agenda = lazy(() => import('@/pages/aluno/Agenda'))
const Historico = lazy(() => import('@/pages/aluno/Historico'))
const AulaDetalhe = lazy(() => import('@/pages/aluno/AulaDetalhe'))
const Materiais = lazy(() => import('@/pages/aluno/Materiais'))
const Financeiro = lazy(() => import('@/pages/aluno/Financeiro'))
const PagarPix = lazy(() => import('@/pages/aluno/PagarPix'))
const Perfil = lazy(() => import('@/pages/aluno/Perfil'))

export default function AlunoArea() {
  return (
    <AppShell nav={<AlunoNav />}>
      <AlunoProvider>
        <Suspense fallback={<ListSkeleton />}>
          <Routes>
            <Route index element={<Inicio />} />
            <Route path="agenda" element={<Agenda />} />
            <Route path="historico" element={<Historico />} />
            <Route path="aulas/:id" element={<AulaDetalhe />} />
            <Route path="materiais" element={<Materiais />} />
            <Route path="financeiro" element={<Financeiro />} />
            <Route path="financeiro/:invoiceId/pix" element={<PagarPix />} />
            <Route path="perfil" element={<Perfil />} />
            <Route
              path="*"
              element={
                <EmptyState title="Página não encontrada">
                  Use o menu para voltar a uma tela da área do aluno.
                </EmptyState>
              }
            />
          </Routes>
        </Suspense>
      </AlunoProvider>
    </AppShell>
  )
}
