import { useCallback, useMemo, useState, type ReactNode } from 'react'

import { useAuth } from './useAuth'
import { ViewAsContext, type ViewAsValue } from './ViewAsContext'
import {
  canUseViewAs,
  effectiveRole,
  parseStudentId,
  parseViewAs,
  readStored,
  VIEW_AS_STORAGE_KEY,
  VIEW_AS_STUDENT_KEY,
  writeStored,
  type ViewAsRole,
} from './viewAs'

/** Estado do "Ver como". Fica dentro do AuthProvider (precisa do papel real). */
export function ViewAsProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth()
  const [chosen, setChosen] = useState<ViewAsRole>(() =>
    parseViewAs(readStored(VIEW_AS_STORAGE_KEY)),
  )
  const [studentId, setStudentId] = useState<string | null>(() =>
    parseStudentId(readStored(VIEW_AS_STUDENT_KEY)),
  )

  const setViewAs = useCallback((role: ViewAsRole) => {
    setChosen(role)
    writeStored(VIEW_AS_STORAGE_KEY, role)
  }, [])

  const setPreviewStudentId = useCallback((id: string | null) => {
    const valid = parseStudentId(id)
    setStudentId(valid)
    writeStored(VIEW_AS_STUDENT_KEY, valid)
  }, [])

  const value = useMemo<ViewAsValue>(() => {
    const canViewAs = canUseViewAs(profile)
    const viewAs = canViewAs ? chosen : 'admin'
    return {
      canViewAs,
      viewAs,
      role: effectiveRole(profile, viewAs),
      previewing: canViewAs && viewAs !== 'admin',
      setViewAs,
      previewStudentId: canViewAs ? studentId : null,
      setPreviewStudentId,
    }
  }, [profile, chosen, studentId, setViewAs, setPreviewStudentId])

  return <ViewAsContext.Provider value={value}>{children}</ViewAsContext.Provider>
}
