/** Formatação de datas no fuso do perfil, a partir de timestamptz (ISO em UTC). */

export const DEFAULT_TIMEZONE = 'America/Sao_Paulo'

/** Fusos oferecidos no perfil (o padrão vem primeiro). */
export const TIMEZONE_OPTIONS: readonly { value: string; label: string }[] = [
  { value: 'America/Sao_Paulo', label: 'Brasília (São Paulo)' },
  { value: 'America/Manaus', label: 'Manaus' },
  { value: 'America/Cuiaba', label: 'Cuiabá' },
  { value: 'America/Fortaleza', label: 'Fortaleza / Recife / Salvador' },
  { value: 'America/Rio_Branco', label: 'Rio Branco' },
  { value: 'America/Noronha', label: 'Fernando de Noronha' },
  { value: 'Europe/Lisbon', label: 'Lisboa' },
  { value: 'America/New_York', label: 'Nova York' },
  { value: 'Europe/London', label: 'Londres' },
]

/** Devolve o fuso se for válido para o Intl; senão, o padrão. */
export function safeTimezone(timezone: string | null | undefined): string {
  if (!timezone) return DEFAULT_TIMEZONE
  try {
    new Intl.DateTimeFormat('pt-BR', { timeZone: timezone })
    return timezone
  } catch {
    return DEFAULT_TIMEZONE
  }
}

function fmt(
  value: string | Date,
  timezone: string | null | undefined,
  options: Intl.DateTimeFormatOptions,
): string {
  const date = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('pt-BR', {
    ...options,
    timeZone: safeTimezone(timezone),
  }).format(date)
}

/** "14:30" */
export function formatTime(value: string | Date, timezone?: string | null): string {
  return fmt(value, timezone, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
}

/** "07/11/2026" */
export function formatDate(value: string | Date, timezone?: string | null): string {
  return fmt(value, timezone, { day: '2-digit', month: '2-digit', year: 'numeric' })
}

/** "sábado, 7 de novembro" */
export function formatDayLong(value: string | Date, timezone?: string | null): string {
  return fmt(value, timezone, { weekday: 'long', day: 'numeric', month: 'long' })
}

/** "sábado, 7 de novembro de 2026" */
export function formatDayFull(value: string | Date, timezone?: string | null): string {
  return fmt(value, timezone, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

/** "sábado, 7 de novembro, às 14:30" */
export function formatDateTimeLong(
  value: string | Date,
  timezone?: string | null,
): string {
  const day = formatDayLong(value, timezone)
  return day ? `${day}, às ${formatTime(value, timezone)}` : ''
}

/** "07/11/2026 às 14:30" */
export function formatDateTime(value: string | Date, timezone?: string | null): string {
  const d = formatDate(value, timezone)
  return d ? `${d} às ${formatTime(value, timezone)}` : ''
}

/** Chave de agrupamento por dia civil no fuso: "2026-11-07". */
export function dayKey(value: string | Date, timezone?: string | null): string {
  const date = typeof value === 'string' ? new Date(value) : value
  // en-CA formata como AAAA-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: safeTimezone(timezone),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

/**
 * Primeiro dia do mês civil de `now` no fuso: "2026-11-01".
 * O padrão é America/Sao_Paulo, o fuso que o banco usa para contar reposições.
 */
export function monthStartKey(now: Date, timezone: string = DEFAULT_TIMEZONE): string {
  return `${dayKey(now, timezone).slice(0, 7)}-01`
}

/** Data pura do banco ("2026-11-10") sem deslocamento de fuso: "10/11/2026". */
export function formatDateOnly(isoDate: string): string {
  const [y, m, d] = isoDate.split('-')
  if (!y || !m || !d) return isoDate
  return `${d.slice(0, 2)}/${m}/${y}`
}

/** Mês de referência ("2026-11-01") => "novembro de 2026". */
export function formatReferenceMonth(isoDate: string): string {
  const [y, m] = isoDate.split('-').map(Number)
  if (!y || !m) return isoDate
  return new Intl.DateTimeFormat('pt-BR', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(y, m - 1, 1)))
}

/** "AAAAMM" (para o txid) a partir de uma data ISO "2026-11-01". */
export function referenceYYYYMM(isoDate: string): string {
  return isoDate.slice(0, 7).replace('-', '')
}
