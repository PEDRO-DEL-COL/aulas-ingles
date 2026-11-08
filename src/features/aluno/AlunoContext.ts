import { createContext, useContext } from 'react'

import type { Settings, StudentRecord } from './lessons'

export type AlunoValue = {
  student: StudentRecord
  settings: Settings
  /** Fuso do perfil (padrão America/Sao_Paulo). */
  timezone: string
  /** true na pré-visualização do admin: nenhuma ação de escrita é permitida. */
  readOnly: boolean
}

export const AlunoContext = createContext<AlunoValue | undefined>(undefined)

export function useAluno(): AlunoValue {
  const value = useContext(AlunoContext)
  if (!value) throw new Error('useAluno precisa estar dentro de <AlunoProvider>.')
  return value
}
