export type Countdown = {
  /** Milissegundos restantes (0 se já começou). */
  totalMs: number
  days: number
  hours: number
  minutes: number
  /** true se o início já passou. */
  started: boolean
}

const MIN = 60_000

export function getCountdown(startsAt: string | Date, now: Date): Countdown {
  const start = typeof startsAt === 'string' ? new Date(startsAt) : startsAt
  const diff = start.getTime() - now.getTime()
  if (!(diff > 0)) return { totalMs: 0, days: 0, hours: 0, minutes: 0, started: true }
  // Minutos arredondados para cima: faltando 30 s mostra "1 min", não "0 min".
  const totalMinutes = Math.ceil(diff / MIN)
  const days = Math.floor(totalMinutes / 1440)
  const hours = Math.floor((totalMinutes % 1440) / 60)
  const minutes = totalMinutes % 60
  return { totalMs: diff, days, hours, minutes, started: false }
}

/** "2 dias, 3 h e 10 min" | "3 h e 10 min" | "10 min" | "Agora". */
export function formatCountdown(c: Countdown): string {
  if (c.started) return 'Agora'
  const parts: string[] = []
  if (c.days > 0) parts.push(`${c.days} ${c.days === 1 ? 'dia' : 'dias'}`)
  if (c.hours > 0) parts.push(`${c.hours} h`)
  if (c.minutes > 0 || parts.length === 0) parts.push(`${c.minutes} min`)
  if (parts.length === 1) return parts[0] ?? ''
  const last = parts[parts.length - 1]
  return `${parts.slice(0, -1).join(', ')} e ${last}`
}

/** Intervalo de atualização sugerido: 1 s nos últimos 5 min, 30 s no resto. */
export function tickIntervalMs(c: Countdown): number {
  return !c.started && c.totalMs <= 5 * MIN ? 1000 : 30_000
}
