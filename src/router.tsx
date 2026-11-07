import { lazy } from 'react'
import { createBrowserRouter } from 'react-router'

import { RootLayout } from '@/components/layout/RootLayout'

const Landing = lazy(() => import('@/pages/Landing'))
const Privacidade = lazy(() => import('@/pages/Privacidade'))
const Login = lazy(() => import('@/pages/Login'))
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
      { path: 'login', element: <Login /> },
      { path: 'app/aluno/*', element: <AlunoArea /> },
      { path: 'app/professora/*', element: <ProfessoraArea /> },
      { path: 'app/admin/*', element: <AdminArea /> },
      { path: '*', element: <NotFound /> },
    ],
  },
])
