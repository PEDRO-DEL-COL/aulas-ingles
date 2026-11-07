/**
 * Usuários e acessos (admin). Camada de dados + regras puras que espelham os
 * triggers do banco (o banco continua sendo a barreira final).
 */
import { friendlyError } from '@/features/shared/errors'
import { getSupabase } from '@/lib/supabase'
import type { Tables } from '@/types/database'

export type ProfileRow = Pick<
  Tables<'profiles'>,
  'id' | 'full_name' | 'email' | 'role' | 'active' | 'created_at' | 'terms_accepted_at'
>
export type Role = ProfileRow['role']
export type SelectableRole = 'aluno' | 'professora' | 'admin'
export type UserFilter = 'todos' | 'ativos' | 'inativos' | Role
export type AccessPatch = { role?: SelectableRole; active?: boolean }
export type AccessCheck = { ok: true } | { ok: false; reason: string }

export const SELECTABLE_ROLES: readonly SelectableRole[] = [
  'aluno',
  'professora',
  'admin',
]

const COLUMNS = 'id, full_name, email, role, active, created_at, terms_accepted_at'

export async function listProfiles(): Promise<ProfileRow[]> {
  const { data, error } = await getSupabase()
    .from('profiles')
    .select(COLUMNS)
    .order('full_name', { ascending: true })
  if (error)
    throw new Error(friendlyError(error, 'Não foi possível carregar os usuários.'))
  return data
}

export async function updateProfileAccess(id: string, patch: AccessPatch): Promise<void> {
  const { data, error } = await getSupabase()
    .from('profiles')
    .update(patch)
    .eq('id', id)
    .select('id')
  if (error) throw new Error(friendlyError(error, 'Não foi possível salvar a alteração.'))
  if (!data || data.length !== 1)
    throw new Error('Você não tem permissão para fazer isso.')
}

export function roleLabel(role: Role): string {
  switch (role) {
    case 'aluno':
      return 'Aluno'
    case 'professora':
      return 'Professora'
    case 'admin':
      return 'Admin'
    default:
      return 'Sem acesso (responsável)'
  }
}

function activeAdmins(all: readonly ProfileRow[]): ProfileRow[] {
  return all.filter((p) => p.role === 'admin' && p.active)
}

/** Pode o admin `me` mudar o acesso (papel/ativo) de `target`? */
export function canChangeAccess(
  target: Pick<ProfileRow, 'id' | 'role' | 'active'>,
  me: { id: string } | null,
  all: readonly ProfileRow[],
): AccessCheck {
  if (!me) return { ok: false, reason: 'Você não tem permissão para fazer isso.' }
  if (target.id === me.id) {
    return {
      ok: false,
      reason: 'Você não pode alterar o seu próprio acesso. Peça a outro admin.',
    }
  }
  if (target.role === 'admin' && target.active) {
    const admins = activeAdmins(all)
    if (admins.length <= 1 && admins.some((a) => a.id === target.id)) {
      return {
        ok: false,
        reason: 'O sistema precisa de pelo menos um admin ativo.',
      }
    }
  }
  return { ok: true }
}

function normalize(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

export function filterProfiles(
  list: readonly ProfileRow[],
  search: string,
  filter: UserFilter,
): ProfileRow[] {
  const q = normalize(search)
  return list.filter((p) => {
    if (filter === 'ativos' && !p.active) return false
    if (filter === 'inativos' && p.active) return false
    if (
      filter !== 'todos' &&
      filter !== 'ativos' &&
      filter !== 'inativos' &&
      p.role !== filter
    )
      return false
    if (!q) return true
    return normalize(p.full_name).includes(q) || normalize(p.email).includes(q)
  })
}
