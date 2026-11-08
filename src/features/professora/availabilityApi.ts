/** Disponibilidade da professora (availability_slots). RLS: só staff. */
import { friendlyError } from '@/features/shared/errors'
import { getSupabase } from '@/lib/supabase'
import type { Tables } from '@/types/database'

import type { SlotFormValues } from './availability'

export type AvailabilitySlot = Tables<'availability_slots'>
export type MakeupSlotCheck = 'ok' | 'bloqueado' | 'fora_disponibilidade'

function fail(error: unknown, fallback: string): never {
  throw new Error(friendlyError(error, fallback))
}

export async function listSlots(): Promise<AvailabilitySlot[]> {
  const { data, error } = await getSupabase()
    .from('availability_slots')
    .select('*')
    .order('weekday', { ascending: true })
    .order('start_time', { ascending: true })
  if (error) fail(error, 'Não foi possível carregar a disponibilidade.')
  return data
}

export async function saveSlot(input: SlotFormValues, id?: string): Promise<void> {
  const row = {
    weekday: Number(input.weekday),
    start_time: input.start_time,
    end_time: input.end_time,
    notes: input.notes.trim() === '' ? null : input.notes.trim(),
  }
  const query = id
    ? getSupabase().from('availability_slots').update(row).eq('id', id)
    : getSupabase().from('availability_slots').insert(row)
  const { error } = await query
  if (error) fail(error, 'Não foi possível salvar a faixa. Tente de novo.')
}

export async function deleteSlot(id: string): Promise<void> {
  const { error } = await getSupabase().from('availability_slots').delete().eq('id', id)
  if (error) fail(error, 'Não foi possível excluir a faixa. Tente de novo.')
}

export async function toggleSlot(id: string, active: boolean): Promise<void> {
  const { error } = await getSupabase()
    .from('availability_slots')
    .update({ active })
    .eq('id', id)
  if (error) fail(error, 'Não foi possível atualizar a faixa. Tente de novo.')
}

export async function checkMakeupSlot(
  startsAtIso: string,
  duration: number,
): Promise<MakeupSlotCheck> {
  const { data, error } = await getSupabase().rpc('check_makeup_slot', {
    p_starts_at: startsAtIso,
    p_duration: duration,
  })
  if (error) fail(error, 'Não foi possível conferir a disponibilidade.')
  return data
}
