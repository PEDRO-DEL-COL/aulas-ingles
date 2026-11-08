import { useContext } from 'react'

import { ViewAsContext, type ViewAsValue } from './ViewAsContext'

export function useViewAs(): ViewAsValue {
  const value = useContext(ViewAsContext)
  if (!value) throw new Error('useViewAs precisa estar dentro de <ViewAsProvider>.')
  return value
}
