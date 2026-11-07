import { useEffect, useMemo, useState, type ReactNode } from 'react'

import { brand } from '@/config/brand'
import {
  fetchPublicSiteInfo,
  readCachedSiteInfo,
  resolveSiteInfo,
  type PublicSiteInfo,
  type SiteFallback,
} from '@/lib/publicSite'

import { PublicSiteContext } from './PublicSiteContext'

const fallback: SiteFallback = {
  whatsappNumber: brand.whatsapp.number,
  message: brand.whatsapp.message,
  plans: brand.plans,
}

// Uma única busca por carregamento da página (StrictMode/navegação não repetem).
let inflight: Promise<PublicSiteInfo | null> | null = null
function loadOnce() {
  inflight ??= fetchPublicSiteInfo()
  return inflight
}

/**
 * Estado inicial síncrono (cache ou fallback): renderiza na hora, sem esqueleto.
 * Quando a busca chega com dados válidos, troca para os do banco.
 */
export function PublicSiteProvider({ children }: { children: ReactNode }) {
  const [remote, setRemote] = useState<PublicSiteInfo | null>(readCachedSiteInfo)

  useEffect(() => {
    let active = true
    void loadOnce().then((info) => {
      if (active && info) setRemote(info)
    })
    return () => {
      active = false
    }
  }, [])

  const value = useMemo(() => resolveSiteInfo(remote, fallback), [remote])
  return <PublicSiteContext.Provider value={value}>{children}</PublicSiteContext.Provider>
}
