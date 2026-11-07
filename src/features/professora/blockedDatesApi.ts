/** Dias bloqueados (férias/feriados). RLS de staff; generate_lessons pula essas datas. */
import { friendlyError } from '@/features/shared/errors'
import { getSupabase } from '@/lib/supabase'
import type { Tables } from '@/types/database'

import { addDaysKey, startOfDayUtc } from './tz'

export type BlockedDate = Tables<'blocked_dates'>

function fail(error: unknown, fallback: string): never {
  throw new Error(friendlyError(error, fallback))
}

export async function listBlockedDates(): Promise<BlockedDate[]> {
  const { data, error } = await getSupabase()
    .from('blocked_dates')
    .select('*')
    .order('starts_on', { ascending: false })
  if (error) fail(error, 'Não foi possível carregar os dias bloqueados.')
  return data
}

export async function saveBlockedDate(
  input: { starts_on: string; ends_on: string; reason: string },
  id?: string,
): Promise<void> {
  const row = {
    starts_on: input.starts_on,
    ends_on: input.ends_on === '' ? input.starts_on : input.ends_on,
    reason: input.reason.trim() === '' ? null : input.reason.trim(),
  }
  const query = id
    ? getSupabase().from('blocked_dates').update(row).eq('id', id)
    : getSupabase().from('blocked_dates').insert(row)
  const { error } = await query
  if (error) fail(error, 'Não foi possível salvar o período. Tente de novo.')
}

export async function deleteBlockedDate(id: string): Promise<void> {
  const { error } = await getSupabase().from('blocked_dates').delete().eq('id', id)
  if (error) fail(error, 'Não foi possível excluir o período.')
}

/** Aulas agendadas/reposição com início entre o começo de startsOn e o fim de endsOn (fuso local). */
export async function countScheduledLessonsInRange(
  startsOn: string,
  endsOn: string,
  timezone: string,
): Promise<number> {
  const from = startOfDayUtc(startsOn, timezone)
  const to = startOfDayUtc(addDaysKey(endsOn, 1), timezone)
  const { count, error } = await getSupabase()
    .from('lessons')
    .select('id', { count: 'exact', head: true })
    .in('status', ['agendada', 'reposicao'])
    .gte('starts_at', from.toISOString())
    .lt('starts_at', to.toISOString())
  if (error) fail(error, 'Não foi possível verificar as aulas do período.')
  return count ?? 0
}
