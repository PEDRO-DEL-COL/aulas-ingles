import { createContext } from 'react'

import type { ResolvedSiteInfo } from '@/lib/publicSite'

export const PublicSiteContext = createContext<ResolvedSiteInfo | null>(null)
