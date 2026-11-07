import { lazy } from 'react'
import { createBrowserRouter } from 'react-router'

import { AppHomeRedirect, RequireRole } from '@/components/auth/RequireRole'
import { RootLayout } from '@/components/layout/RootLayout'

const Landing = lazy(() => import('@/pages/Landing'))
const Privacidade = lazy(() => import('@/pages/Privacidade'))
// Tudo que precisa de login fica sob AuthLayout (único ponto que importa o supabase-js).
const AuthLayout = lazy(() => import('@/components/auth/AuthLayout'))
const Login = lazy(() => import('@/pages/Login'))
const Callback = lazy(() => import('@/pages/auth/Callback'))
const AcessoNaoLiberado = lazy(() => import('@/pages/auth/AcessoNaoLiberado'))
const AceiteTermos = lazy(() => import('@/pages/termos/AceiteTermos'))
const AlunoArea = lazy(() => import('@/pages/app/AlunoArea'))
const ProfessoraArea = lazy(() => import('@/pages/app/ProfessoraArea'))
const AdminArea = lazy(() => import('@/pages/app/AdminArea'))
const NotFound = lazy(() => import('@/pages/NotFound'))

export const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [
      { index: true, element: <Landing /> },
      { path: 'privacidade', element: <Privacidade /> },
      {
        element: <AuthLayout />,
        children: [
          { path: 'login', element: <Login /> },
          { path: 'auth/callback', element: <Callback /> },
          { path: 'acesso-nao-liberado', element: <AcessoNaoLiberado /> },
          { path: 'termos/aceite', element: <AceiteTermos /> },
          {
            path: 'app',
            children: [
              {
                index: true,
                element: (
                  <RequireRole roles={['aluno', 'professora', 'admin']}>
                    <AppHomeRedirect />
                  </RequireRole>
                ),
              },
              {
                path: 'aluno/*',
                element: (
                  <RequireRole roles={['aluno']}>
                    <AlunoArea />
                  </RequireRole>
                ),
              },
              {
                path: 'professora/*',
                element: (
                  <RequireRole roles={['professora', 'admin']}>
                    <ProfessoraArea />
                  </RequireRole>
                ),
              },
              {
                path: 'admin/*',
                element: (
                  <RequireRole roles={['admin']}>
                    <AdminArea />
                  </RequireRole>
                ),
              },
            ],
          },
        ],
      },
      { path: '*', element: <NotFound /> },
    ],
  },
])
