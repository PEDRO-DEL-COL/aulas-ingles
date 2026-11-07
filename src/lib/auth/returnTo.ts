import { safeReturnPath } from './access'

const KEY = 'auth:returnTo'

/** Guarda a rota de retorno antes de ir ao Google (o state do router se perde no redirect). */
export function stashReturnTo(path: string): void {
  try {
    sessionStorage.setItem(KEY, safeReturnPath(path))
  } catch {
    /* armazenamento indisponível: segue sem retorno */
  }
}

export function popReturnTo(): string {
  try {
    const value = sessionStorage.getItem(KEY)
    sessionStorage.removeItem(KEY)
    return safeReturnPath(value)
  } catch {
    return '/app'
  }
}

/** Lê `state.from` do location de forma segura. */
export function returnFromState(state: unknown): string {
  const from = (state as { from?: unknown } | null)?.from
  return safeReturnPath(from)
}
