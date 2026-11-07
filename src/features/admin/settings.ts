/** Planos, políticas e Pix (admin). Camada de dados; as regras ficam em validation.ts. */
import { friendlyError } from '@/features/shared/errors'
import { getSupabase } from '@/lib/supabase'
import type { Tables, TablesInsert, TablesUpdate } from '@/types/database'

export type SettingsRow = Tables<'settings'>
export type SettingsPatch = TablesUpdate<'settings'>
export type PlanRow = Tables<'plans'>
export type PlanInput = Omit<TablesInsert<'plans'>, 'id' | 'created_at' | 'updated_at'>

const NO_PERMISSION = 'Você não tem permissão para fazer isso.'

export async function getSettings(): Promise<SettingsRow | null> {
  const { data, error } = await getSupabase()
    .from('settings')
    .select('*')
    .eq('id', true)
    .maybeSingle()
  if (error) throw new Error(friendlyError(error, 'Não foi possível carregar as configurações.'))
  return data
}

export async function updateSettings(patch: SettingsPatch): Promise<SettingsRow> {
  const { data, error } = await getSupabase()
    .from('settings')
    .update(patch)
    .eq('id', true)
    .select('*')
    .maybeSingle()
  if (error) throw new Error(friendlyError(error, 'Não foi possível salvar.'))
  if (!data) throw new Error(NO_PERMISSION)
  return data
}

export async function listPlans(): Promise<PlanRow[]> {
  const { data, error } = await getSupabase()
    .from('plans')
    .select('*')
    .order('active', { ascending: false })
    .order('name', { ascending: true })
  if (error) throw new Error(friendlyError(error, 'Não foi possível carregar os planos.'))
  return data
}

export async function savePlan(input: PlanInput, id?: string): Promise<PlanRow> {
  const sb = getSupabase()
  const { data, error } = id
    ? await sb.from('plans').update(input).eq('id', id).select('*').maybeSingle()
    : await sb.from('plans').insert(input).select('*').maybeSingle()
  if (error) throw new Error(friendlyError(error, 'Não foi possível salvar o plano.'))
  if (!data) throw new Error(NO_PERMISSION)
  return data
}

export async function deletePlan(id: string): Promise<void> {
  const { data, error } = await getSupabase().from('plans').delete().eq('id', id).select('id')
  if (error) throw new Error(friendlyError(error, 'Não foi possível excluir o plano.'))
  if (!data || data.length !== 1) throw new Error(NO_PERMISSION)
}
