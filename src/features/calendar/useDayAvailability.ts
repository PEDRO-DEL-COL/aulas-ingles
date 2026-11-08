import { useEffect, useState } from 'react'

import { loadAvailabilityData } from './api'
import type { AvailabilityData } from './engine'

type Loaded = { dateKey: string; data?: AvailabilityData; error?: unknown }

/**
 * Disponibilidade efetiva para uma data (padrões + exceções + bloqueios do dia).
 * `loading` fica true enquanto a data pedida ainda não chegou; `data` só vale para ela.
 */
export function useDayAvailability(dateKey: string): {
  data: AvailabilityData | undefined
  loading: boolean
  error: unknown
  retry: () => void
} {
  const [state, setState] = useState<Loaded | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return
    let active = true
    loadAvailabilityData(dateKey, dateKey)
      .then((data) => {
        if (active) setState({ dateKey, data })
      })
      .catch((error: unknown) => {
        if (active) setState({ dateKey, error })
      })
    return () => {
      active = false
    }
  }, [dateKey, tick])

  const current = state?.dateKey === dateKey ? state : null
  return {
    data: current?.data,
    loading: current === null && /^\d{4}-\d{2}-\d{2}$/.test(dateKey),
    error: current?.error ?? null,
    retry: () => {
      setState(null)
      setTick((t) => t + 1)
    },
  }
}
