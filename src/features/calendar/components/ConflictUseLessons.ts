import { useEffect, useState } from 'react'

import type { LessonWithStudent } from '@/features/professora/lessons'
import { rangeUtc } from '@/features/professora/tz'
import { friendlyError } from '@/features/shared/errors'

import { listLessonsInRange } from '../api'

type Loaded = { key: string; lessons: LessonWithStudent[]; error: string | null }

export function isActiveLesson(l: Pick<LessonWithStudent, 'status'>): boolean {
  return l.status === 'agendada' || l.status === 'reposicao'
}

/**
 * Aulas agendadas/reposição entre duas datas locais (inclusive). `from` ou `to` null = parado.
 * `loading` fica true até a resposta da janela atual chegar.
 */
export function useActiveLessons(
  from: string | null,
  to: string | null,
  timezone: string,
): { loading: boolean; error: string | null; lessons: LessonWithStudent[] } {
  const key = from && to ? `${from}|${to}|${timezone}` : ''
  const [loaded, setLoaded] = useState<Loaded | null>(null)

  useEffect(() => {
    if (!from || !to) return
    let cancelled = false
    const { start, end } = rangeUtc(from, to, timezone)
    listLessonsInRange(start, end)
      .then((rows) => {
        if (!cancelled)
          setLoaded({ key, lessons: rows.filter(isActiveLesson), error: null })
      })
      .catch((e: unknown) => {
        if (!cancelled)
          setLoaded({
            key,
            lessons: [],
            error: friendlyError(e, 'Não foi possível verificar as aulas do período.'),
          })
      })
    return () => {
      cancelled = true
    }
  }, [from, to, timezone, key])

  if (!key) return { loading: false, error: null, lessons: [] }
  if (loaded?.key !== key) return { loading: true, error: null, lessons: [] }
  return { loading: false, error: loaded.error, lessons: loaded.lessons }
}
