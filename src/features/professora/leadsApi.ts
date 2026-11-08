/** Camada de dados dos interessados (leads). Segurança: RLS (staff lê e edita). */
import { friendlyError } from '@/features/shared/errors'
import { getSupabase } from '@/lib/supabase'

import type { Lead, LeadStatus } from './leads'

function fail(error: unknown, fallback: string): never {
  throw new Error(friendlyError(error, fallback))
}

export async function listLeads(): Promise<Lead[]> {
  const { data, error } = await getSupabase()
    .from('leads')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(500)
  if (error) fail(error, 'Não foi possível carregar os interessados.')
  return data
}

export async function getLead(id: string): Promise<Lead | null> {
  const { data, error } = await getSupabase()
    .from('leads')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) fail(error, 'Não foi possível carregar o interessado.')
  return data
}

export async function updateLeadStatus(id: string, status: LeadStatus): Promise<void> {
  const { error } = await getSupabase().from('leads').update({ status }).eq('id', id)
  if (error) fail(error, 'Não foi possível atualizar o interessado.')
}

export async function updateLeadNotes(id: string, notes: string): Promise<void> {
  const trimmed = notes.trim()
  const { error } = await getSupabase()
    .from('leads')
    .update({ notes: trimmed === '' ? null : trimmed })
    .eq('id', id)
  if (error) fail(error, 'Não foi possível salvar a anotação.')
}
