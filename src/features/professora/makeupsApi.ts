/** Reposições a agendar: cancelamentos com direito a reposição e sem reposição criada. */
import { friendlyError } from '@/features/shared/errors'
import { getSupabase } from '@/lib/supabase'

import { attachStudents, listMakeupOrigins } from './api'
import { withoutMakeup, type LessonWithStudent } from './lessons'

/** Janela para trás (dias) em que ainda se oferece o agendamento. */
export const MAKEUP_LOOKBACK_DAYS = 120

export async function listMakeupsToSchedule(
  now: Date = new Date(),
): Promise<LessonWithStudent[]> {
  const since = new Date(now.getTime() - MAKEUP_LOOKBACK_DAYS * 86_400_000)
  const { data, error } = await getSupabase()
    .from('lessons')
    .select('*')
    .eq('makeup_eligible', true)
    .in('status', ['cancelada_professora', 'cancelada_aluno'])
    .gte('starts_at', since.toISOString())
    .order('starts_at', { ascending: true })
  if (error) {
    throw new Error(friendlyError(error, 'Não foi possível carregar as reposições.'))
  }
  const origins = await listMakeupOrigins(data.map((l) => l.id))
  return attachStudents(withoutMakeup(data, origins))
}
