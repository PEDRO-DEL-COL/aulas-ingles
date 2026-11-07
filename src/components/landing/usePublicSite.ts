import { useContext } from 'react'

import type { ResolvedSiteInfo } from '@/lib/publicSite'

import { PublicSiteContext } from './PublicSiteContext'

export function usePublicSite(): ResolvedSiteInfo {
  const value = useContext(PublicSiteContext)
  if (!value)
    throw new Error('usePublicSite precisa estar dentro de <PublicSiteProvider>.')
  return value
}
