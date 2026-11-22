/** Camada de dados do conteúdo público (currículo e depoimentos). Segurança: RLS (só equipe). */
import { friendlyError } from '@/features/shared/errors'
import { getSupabase } from '@/lib/supabase'
import type { Database } from '@/types/database'

import type { ProfileInput, TestimonialInput } from './siteContent'

export type TeacherProfile = Database['public']['Tables']['teacher_profile']['Row']
export type Testimonial = Database['public']['Tables']['testimonials']['Row']

function fail(error: unknown, fallback: string): never {
  throw new Error(friendlyError(error, fallback))
}

export async function getTeacherProfile(): Promise<TeacherProfile | null> {
  const { data, error } = await getSupabase()
    .from('teacher_profile')
    .select('*')
    .eq('id', true)
    .maybeSingle()
  if (error) fail(error, 'Não foi possível carregar o currículo.')
  return data
}

export async function saveTeacherProfile(input: ProfileInput): Promise<void> {
  const { error } = await getSupabase()
    .from('teacher_profile')
    .update(input)
    .eq('id', true)
  if (error) fail(error, 'Não foi possível salvar o currículo.')
}

export async function listTestimonials(): Promise<Testimonial[]> {
  const { data, error } = await getSupabase()
    .from('testimonials')
    .select('*')
    .order('position', { ascending: true })
    .order('created_at', { ascending: true })
    .limit(500)
  if (error) fail(error, 'Não foi possível carregar os depoimentos.')
  return data
}

/** Novo depoimento sempre nasce como rascunho (published = false). */
export async function createTestimonial(input: TestimonialInput): Promise<void> {
  const { error } = await getSupabase()
    .from('testimonials')
    .insert({ ...input, published: false })
  if (error) fail(error, 'Não foi possível criar o depoimento.')
}

export async function updateTestimonial(
  id: string,
  input: Partial<TestimonialInput> & { published?: boolean },
): Promise<void> {
  const { error } = await getSupabase().from('testimonials').update(input).eq('id', id)
  if (error) fail(error, 'Não foi possível atualizar o depoimento.')
}

export async function deleteTestimonial(id: string): Promise<void> {
  const { error } = await getSupabase().from('testimonials').delete().eq('id', id)
  if (error) fail(error, 'Não foi possível excluir o depoimento.')
}
