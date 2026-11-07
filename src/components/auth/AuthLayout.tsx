import { Suspense } from 'react'
import { Outlet } from 'react-router'

import { AuthProvider } from '@/lib/auth/AuthProvider'

import { LoadingScreen } from './AuthScreen'

/** Layout de rota que carrega o AuthProvider (e o supabase-js) só onde é preciso. */
export default function AuthLayout() {
  return (
    <AuthProvider>
      <Suspense fallback={<LoadingScreen />}>
        <Outlet />
      </Suspense>
    </AuthProvider>
  )
}
