/** Funções puras de decisão de acesso (sem React, sem Supabase). */
import { CURRENT_TERMS_VERSION } from '@/config/legal'
import type { Tables } from '@/types/database'

export type Profile = Tables<'profiles'>
export type UserRole = Profile['role']
export type AccessDecision = 'allowed' | 'not_released' | 'needs_terms' | 'forbidden'

type AccessProfile = Pick<
  Profile,
  'active' | 'role' | 'terms_accepted_at' | 'terms_version'
>

const HOME_PATHS = {
  aluno: '/app/aluno',
  professora: '/app/professora',
  admin: '/app/admin',
} as const

/** Rota inicial do papel; null para quem não tem área (ex.: 'responsavel', sem perfil). */
export function homePathForRole(role: UserRole | null | undefined): string | null {
  if (role === 'aluno' || role === 'professora' || role === 'admin')
    return HOME_PATHS[role]
  return null
}

/** Perfil existe, está ativo e tem um papel com acesso ('responsavel' não tem). */
export function isReleased(profile: AccessProfile | null | undefined): boolean {
  return !!profile && profile.active && homePathForRole(profile.role) !== null
}

export function needsTerms(
  profile: Pick<Profile, 'terms_accepted_at' | 'terms_version'>,
  currentVersion: string = CURRENT_TERMS_VERSION,
): boolean {
  return profile.terms_accepted_at === null || profile.terms_version !== currentVersion
}

/**
 * Decide o acesso a uma rota.
 * Ordem: não liberado -> termos pendentes -> papel não permitido.
 * Sem `requiredRoles`, qualquer papel liberado serve.
 */
export function resolveAccess(
  profile: AccessProfile | null | undefined,
  requiredRoles?: readonly UserRole[],
  currentVersion: string = CURRENT_TERMS_VERSION,
): AccessDecision {
  if (!profile || !isReleased(profile)) return 'not_released'
  if (needsTerms(profile, currentVersion)) return 'needs_terms'
  if (requiredRoles && !requiredRoles.includes(profile.role)) return 'forbidden'
  return 'allowed'
}

/**
 * Perfil com o papel trocado pelo papel efetivo ("Ver como"). Liberação e termos
 * continuam vindo do perfil real; só o papel (usado para rota/menus) muda.
 */
export function withEffectiveRole<T extends { role: UserRole }>(
  profile: T | null | undefined,
  role: UserRole | undefined,
): T | null | undefined {
  if (!profile || !role || role === profile.role) return profile
  return { ...profile, role }
}

/** resolveAccess usando o papel efetivo (do "Ver como") no lugar do real. */
export function resolveAccessAs(
  profile: AccessProfile | null | undefined,
  effective: UserRole | undefined,
  requiredRoles?: readonly UserRole[],
  currentVersion: string = CURRENT_TERMS_VERSION,
): AccessDecision {
  if (!profile || !isReleased(profile)) return 'not_released'
  if (needsTerms(profile, currentVersion)) return 'needs_terms'
  const role = effective ?? profile.role
  if (requiredRoles && !requiredRoles.includes(role)) return 'forbidden'
  return 'allowed'
}

/**
 * Aceita apenas caminhos internos ("/x"), nunca "//host", "/\host" ou URLs absolutas.
 * Evita open redirect no retorno pós-login.
 */
export function safeReturnPath(value: unknown, fallback = '/app'): string {
  if (typeof value !== 'string') return fallback
  if (!value.startsWith('/') || value.startsWith('//')) return fallback
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f\\]/.test(value)) return fallback
  return value
}
