/**
 * "Ver como" (só admin): troca a VISUALIZAÇÃO do app para outro papel.
 * Funções puras + persistência local. Não muda nada no banco: RLS e triggers
 * continuam usando o papel real; isto só decide quais telas e menus aparecem.
 */
import type { UserRole } from './access'

export type ViewAsRole = 'aluno' | 'professora' | 'admin'

export const VIEW_AS_OPTIONS: readonly { value: ViewAsRole; label: string }[] = [
  { value: 'aluno', label: 'Aluno' },
  { value: 'professora', label: 'Professora' },
  { value: 'admin', label: 'Admin' },
]

export const VIEW_AS_STORAGE_KEY = 'view-as:v1'
export const VIEW_AS_STUDENT_KEY = 'view-as-student:v1'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Só quem é admin de verdade (papel real, ativo) pode usar o seletor. */
export function canUseViewAs(
  profile: { role: UserRole; active: boolean } | null | undefined,
): boolean {
  return !!profile && profile.active && profile.role === 'admin'
}

/** Valor lido do navegador -> papel válido; qualquer outra coisa vira 'admin'. */
export function parseViewAs(raw: unknown): ViewAsRole {
  return raw === 'aluno' || raw === 'professora' || raw === 'admin' ? raw : 'admin'
}

/** Id de aluno lido do navegador (pré-visualização); só aceita UUID. */
export function parseStudentId(raw: unknown): string | null {
  return typeof raw === 'string' && UUID_RE.test(raw) ? raw : null
}

/**
 * Papel usado para decidir telas e menus. Para quem não é admin, SEMPRE o real
 * (um valor salvo no navegador nunca muda nada para aluno ou professora).
 */
export function effectiveRole(
  profile: { role: UserRole; active: boolean } | null | undefined,
  viewAs: ViewAsRole,
): UserRole | undefined {
  if (!profile) return undefined
  return canUseViewAs(profile) ? viewAs : profile.role
}

export function viewAsLabel(role: ViewAsRole): string {
  return VIEW_AS_OPTIONS.find((o) => o.value === role)?.label ?? 'Admin'
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

function storage(): StorageLike | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null
  } catch {
    return null
  }
}

export function readStored(
  key: string,
  s: StorageLike | null = storage(),
): string | null {
  try {
    return s?.getItem(key) ?? null
  } catch {
    return null
  }
}

export function writeStored(
  key: string,
  value: string | null,
  s: StorageLike | null = storage(),
): void {
  try {
    if (!s) return
    if (value === null) s.removeItem(key)
    else s.setItem(key, value)
  } catch {
    // navegador sem armazenamento (modo privado, bloqueado): a escolha vale só na sessão
  }
}
