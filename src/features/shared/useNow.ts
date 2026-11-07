import { useEffect, useState } from 'react'

/**
 * Relógio vivo. `delayFor(now)` devolve em ms quando atualizar de novo (padrão 30 s),
 * permitindo acelerar para 1 s nos últimos minutos. Limpa o timer ao desmontar.
 * `delayFor` deve ser estável (useCallback ou função de módulo).
 */
const DEFAULT_DELAY = () => 30_000

export function useNow(delayFor: (now: Date) => number = DEFAULT_DELAY): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    let id: number
    const schedule = (from: Date) => {
      id = window.setTimeout(() => {
        const next = new Date()
        setNow(next)
        schedule(next)
      }, delayFor(from))
    }
    schedule(new Date())
    return () => window.clearTimeout(id)
  }, [delayFor])
  return now
}
