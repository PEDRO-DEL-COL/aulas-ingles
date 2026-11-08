import { createContext } from 'react'

import type { UserRole } from './access'
import type { ViewAsRole } from './viewAs'

export type ViewAsValue = {
  /** true só para admin real: mostra o seletor e o aviso. */
  canViewAs: boolean
  /** Papel escolhido no seletor ('admin' = visão normal). Para não-admin, sempre 'admin' (ignorado). */
  viewAs: ViewAsRole
  /** Papel que decide telas e menus (real para não-admin). */
  role: UserRole | undefined
  /** true quando um admin está vendo como aluno/professora. */
  previewing: boolean
  setViewAs: (role: ViewAsRole) => void
  /** Aluno escolhido para pré-visualizar a área do aluno (somente leitura). */
  previewStudentId: string | null
  setPreviewStudentId: (id: string | null) => void
}

export const ViewAsContext = createContext<ViewAsValue | undefined>(undefined)
