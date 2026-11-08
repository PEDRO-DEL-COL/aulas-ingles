/** Catálogo de vantagens dos planos (admin). Camada de dados + funções puras. */
import { friendlyError } from '@/features/shared/errors'
import { getSupabase } from '@/lib/supabase'
import type { Tables } from '@/types/database'

export type BenefitRow = Tables<'benefits'>
export type PlanBenefitRow = Tables<'plan_benefits'>

export const BENEFIT_MAX_LENGTH = 120

const NO_PERMISSION = 'Você não tem permissão para fazer isso.'

// ---------- Puras ----------

/** Apara as pontas e colapsa espaços repetidos. */
export function normalizeLabel(label: string): string {
  return label.trim().replace(/\s+/g, ' ')
}

/** Duplicidade sem diferenciar maiúsculas/minúsculas (espelha o índice único do banco). */
export function isDuplicateLabel(label: string, existing: readonly string[]): boolean {
  const key = normalizeLabel(label).toLowerCase()
  return existing.some((e) => normalizeLabel(e).toLowerCase() === key)
}

/** Move o item i em delta posições (-1 sobe, +1 desce). Devolve nova lista; fora dos limites, cópia igual. */
export function moveItem<T>(list: readonly T[], index: number, delta: number): T[] {
  const copy = [...list]
  const target = index + delta
  if (index < 0 || index >= copy.length || target < 0 || target >= copy.length) {
    return copy
  }
  const [item] = copy.splice(index, 1)
  copy.splice(target, 0, item as T)
  return copy
}

/** Valida o rótulo; devolve o texto normalizado ou a mensagem de erro. */
export function validateBenefitLabel(
  label: string,
  existing: readonly string[],
): { value: string; error?: undefined } | { value?: undefined; error: string } {
  const value = normalizeLabel(label)
  if (value === '') return { error: 'Informe o texto da vantagem.' }
  if (value.length > BENEFIT_MAX_LENGTH)
    return { error: `A vantagem pode ter no máximo ${BENEFIT_MAX_LENGTH} caracteres.` }
  if (isDuplicateLabel(value, existing)) return { error: 'Essa vantagem já existe.' }
  return { value }
}

// ---------- Dados ----------

export async function listBenefits(): Promise<BenefitRow[]> {
  const { data, error } = await getSupabase()
    .from('benefits')
    .select('*')
    .order('label', { ascending: true })
  if (error)
    throw new Error(friendlyError(error, 'Não foi possível carregar as vantagens.'))
  return data
}

export async function createBenefit(label: string): Promise<BenefitRow> {
  const { data, error } = await getSupabase()
    .from('benefits')
    .insert({ label: normalizeLabel(label) })
    .select('*')
    .maybeSingle()
  if (error) throw new Error(friendlyError(error, 'Não foi possível criar a vantagem.'))
  if (!data) throw new Error(NO_PERMISSION)
  return data
}

export async function renameBenefit(id: string, label: string): Promise<BenefitRow> {
  const { data, error } = await getSupabase()
    .from('benefits')
    .update({ label: normalizeLabel(label) })
    .eq('id', id)
    .select('*')
    .maybeSingle()
  if (error) throw new Error(friendlyError(error, 'Não foi possível renomear.'))
  if (!data) throw new Error(NO_PERMISSION)
  return data
}

/** Exclui do catálogo; sai de todos os planos (FK em cascata). */
export async function deleteBenefit(id: string): Promise<void> {
  const { data, error } = await getSupabase()
    .from('benefits')
    .delete()
    .eq('id', id)
    .select('id')
  if (error) throw new Error(friendlyError(error, 'Não foi possível excluir.'))
  if (!data || data.length !== 1) throw new Error(NO_PERMISSION)
}

/** Ids das vantagens do plano, na ordem de exibição. */
export async function listPlanBenefits(planId: string): Promise<string[]> {
  const { data, error } = await getSupabase()
    .from('plan_benefits')
    .select('benefit_id, position')
    .eq('plan_id', planId)
    .order('position', { ascending: true })
  if (error)
    throw new Error(friendlyError(error, 'Não foi possível carregar as vantagens.'))
  return data.map((r) => r.benefit_id)
}

/** Textos das vantagens de cada plano (planId => rótulos em ordem). */
export async function listAllPlanBenefitLabels(): Promise<Record<string, string[]>> {
  const sb = getSupabase()
  const [links, benefits] = await Promise.all([
    sb
      .from('plan_benefits')
      .select('plan_id, benefit_id, position')
      .order('position', { ascending: true }),
    sb.from('benefits').select('id, label'),
  ])
  const err = links.error ?? benefits.error
  if (err) throw new Error(friendlyError(err, 'Não foi possível carregar as vantagens.'))
  const labels = new Map((benefits.data ?? []).map((b) => [b.id, b.label]))
  const out: Record<string, string[]> = {}
  for (const l of links.data ?? []) {
    const label = labels.get(l.benefit_id)
    if (label === undefined) continue
    ;(out[l.plan_id] ??= []).push(label)
  }
  return out
}

/**
 * Define as vantagens do plano, na ordem dada (position 0..n). Seguro contra falha no
 * meio: apaga só as que saíram e faz upsert das que ficam com a posição nova.
 */
export async function setPlanBenefits(
  planId: string,
  benefitIds: readonly string[],
): Promise<void> {
  const sb = getSupabase()
  const ids = [...new Set(benefitIds)]
  const current = await listPlanBenefits(planId)
  const removed = current.filter((id) => !ids.includes(id))
  if (removed.length > 0) {
    const { error } = await sb
      .from('plan_benefits')
      .delete()
      .eq('plan_id', planId)
      .in('benefit_id', removed)
    if (error)
      throw new Error(friendlyError(error, 'Não foi possível salvar as vantagens.'))
  }
  if (ids.length > 0) {
    const { error } = await sb.from('plan_benefits').upsert(
      ids.map((benefit_id, position) => ({ plan_id: planId, benefit_id, position })),
      { onConflict: 'plan_id,benefit_id' },
    )
    if (error)
      throw new Error(friendlyError(error, 'Não foi possível salvar as vantagens.'))
  }
}
