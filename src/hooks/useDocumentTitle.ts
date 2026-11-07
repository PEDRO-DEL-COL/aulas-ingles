import { useEffect } from 'react'

import { brand } from '@/config/brand'

/** Atualiza <title> e meta description da página atual. */
export function useDocumentTitle(title?: string, description?: string) {
  useEffect(() => {
    document.title = title
      ? `${title} | ${brand.name}`
      : `${brand.name} | ${brand.tagline}`
    if (description) {
      document
        .querySelector('meta[name="description"]')
        ?.setAttribute('content', description)
    }
  }, [title, description])
}
