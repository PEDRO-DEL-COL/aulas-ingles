import { useCallback, useEffect, useRef, useState } from 'react'

import { listMakeupOrigins } from '@/features/professora/api'
import type { LessonWithStudent } from '@/features/professora/lessons'
import { rangeUtc } from '@/features/professora/tz'
import { DEFAULT_TIMEZONE } from '@/features/shared/datetime'

import {
  addException,
  deleteException,
  getTeacherTimezone,
  listLessonsInRange,
  loadAvailabilityData,
  type ExceptionInput,
} from './api'
import type { AvailabilityData, AvailabilityException } from './engine'

export type CalendarData = {
  availability: AvailabilityData
  lessons: LessonWithStudent[]
  /** Aulas canceladas que já têm reposição agendada. */
  withMakeup: Set<string>
}

export type CalendarDataResult = {
  data: CalendarData | undefined
  timezone: string
  /** true só na primeira carga (sem dados nenhuns). */
  initialLoading: boolean
  /** true enquanto recarrega mantendo os dados antigos na tela. */
  refreshing: boolean
  error: unknown
  refetch: () => void
  /** Cria a exceção (otimista). Devolve a linha criada; reverte e lança se falhar. */
  createException: (input: ExceptionInput) => Promise<AvailabilityException>
  /** Remove a exceção (otimista). Reverte e lança se falhar. */
  removeException: (id: string) => Promise<void>
}

function nowIso() {
  return new Date().toISOString()
}

/**
 * Carrega disponibilidade + aulas + fuso para a janela [from, to] (datas "AAAA-MM-DD").
 * Ao mudar a janela, os dados antigos continuam na tela até os novos chegarem.
 */
export function useCalendarData(from: string, to: string): CalendarDataResult {
  const [timezone, setTimezone] = useState<string | null>(null)
  const [data, setData] = useState<CalendarData | undefined>(undefined)
  const [error, setError] = useState<unknown>(null)
  const [tick, setTick] = useState(0)
  const [loadedKey, setLoadedKey] = useState('')
  const seq = useRef(0)

  useEffect(() => {
    let active = true
    getTeacherTimezone()
      .then((tz) => {
        if (active) setTimezone(tz)
      })
      .catch(() => {
        if (active) setTimezone(DEFAULT_TIMEZONE)
      })
    return () => {
      active = false
    }
  }, [])

  const key = `${from}|${to}|${timezone ?? ''}|${tick}`

  useEffect(() => {
    if (!timezone) return
    const mine = ++seq.current
    const { start, end } = rangeUtc(from, to, timezone)
    void (async () => {
      try {
        const [availability, lessons] = await Promise.all([
          loadAvailabilityData(from, to),
          listLessonsInRange(start, end),
        ])
        const cancelled = lessons
          .filter(
            (l) => l.status === 'cancelada_aluno' || l.status === 'cancelada_professora',
          )
          .map((l) => l.id)
        const withMakeup = await listMakeupOrigins(cancelled).catch(
          () => new Set<string>(),
        )
        if (mine !== seq.current) return
        setData({ availability, lessons, withMakeup })
        setError(null)
      } catch (e) {
        if (mine !== seq.current) return
        setError(e)
      } finally {
        if (mine === seq.current) setLoadedKey(key)
      }
    })()
  }, [from, to, timezone, key])

  const refetch = useCallback(() => setTick((t) => t + 1), [])

  const patchExceptions = useCallback(
    (fn: (list: AvailabilityException[]) => AvailabilityException[]) => {
      setData((prev) =>
        prev
          ? {
              ...prev,
              availability: {
                ...prev.availability,
                exceptions: fn(prev.availability.exceptions),
              },
            }
          : prev,
      )
    },
    [],
  )

  const createException = useCallback(
    async (input: ExceptionInput) => {
      const tempId = `tmp-${Math.random().toString(36).slice(2)}`
      const closed = input.kind === 'fechado'
      const draft: AvailabilityException = {
        id: tempId,
        on_date: input.on_date,
        kind: input.kind,
        start_time: closed ? null : (input.start_time ?? null),
        end_time: closed ? null : (input.end_time ?? null),
        reason: input.reason?.trim() ? input.reason.trim() : null,
        created_at: nowIso(),
        updated_at: nowIso(),
      }
      patchExceptions((l) => [...l, draft])
      try {
        const id = await addException(input)
        const saved = { ...draft, id }
        patchExceptions((l) => l.map((e) => (e.id === tempId ? saved : e)))
        return saved
      } catch (e) {
        patchExceptions((l) => l.filter((x) => x.id !== tempId))
        throw e
      }
    },
    [patchExceptions],
  )

  const removeException = useCallback(
    async (id: string) => {
      let removed: AvailabilityException | undefined
      patchExceptions((l) => {
        removed = l.find((e) => e.id === id)
        return l.filter((e) => e.id !== id)
      })
      try {
        await deleteException(id)
      } catch (e) {
        const back = removed
        if (back) patchExceptions((l) => [...l, back])
        throw e
      }
    },
    [patchExceptions],
  )

  return {
    data,
    timezone: timezone ?? DEFAULT_TIMEZONE,
    initialLoading: !data && !error,
    refreshing: timezone !== null && loadedKey !== key,
    error,
    refetch,
    createException,
    removeException,
  }
}
