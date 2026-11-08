/** Camada de dados do calendário de disponibilidade. RLS: só staff. */
import type { StudentRecord } from '@/features/aluno/lessons'
import { cancelLesson, listLessonsBetween, listStudents } from '@/features/professora/api'
import {
  parseGenerationReport,
  type GenerationReport,
} from '@/features/professora/generation'
import type { LessonWithStudent } from '@/features/professora/lessons'
import { DEFAULT_TIMEZONE, safeTimezone } from '@/features/shared/datetime'
import { friendlyError } from '@/features/shared/errors'
import { getSupabase } from '@/lib/supabase'
import type { AvailabilityExceptionKind } from '@/types/database'

import type { AvailabilityData, SlotCheck } from './engine'

function fail(error: unknown, fallback: string): never {
  throw new Error(friendlyError(error, fallback))
}

export type PatternInput = {
  name: string
  starts_on: string
  /** null (ou "") = sem fim */
  ends_on: string | null
  default_lesson_minutes: number
  active: boolean
}

export type PatternSlotInput = {
  weekday: number
  start_time: string
  end_time: string
  notes?: string | null
}

export type ExceptionInput = {
  on_date: string
  kind: AvailabilityExceptionKind
  start_time?: string | null
  end_time?: string | null
  reason?: string | null
}

export type BlockedDateInput = {
  starts_on: string
  ends_on: string
  reason: string | null
}

export type CancelOutcome = {
  succeeded: string[]
  failed: { id: string; message: string }[]
}

export async function loadAvailabilityData(
  fromKey: string,
  toKey: string,
): Promise<AvailabilityData> {
  const sb = getSupabase()
  const [patterns, slots, exceptions, blocked] = await Promise.all([
    sb.from('availability_patterns').select('*').order('starts_on', { ascending: true }),
    sb
      .from('availability_slots')
      .select('*')
      .order('weekday', { ascending: true })
      .order('start_time', { ascending: true }),
    sb
      .from('availability_exceptions')
      .select('*')
      .gte('on_date', fromKey)
      .lte('on_date', toKey)
      .order('on_date', { ascending: true })
      .order('start_time', { ascending: true }),
    sb
      .from('blocked_dates')
      .select('*')
      .lte('starts_on', toKey)
      .gte('ends_on', fromKey)
      .order('starts_on', { ascending: true }),
  ])
  const err = patterns.error ?? slots.error ?? exceptions.error ?? blocked.error
  if (err) fail(err, 'Não foi possível carregar a disponibilidade.')
  return {
    patterns: patterns.data ?? [],
    slots: slots.data ?? [],
    exceptions: exceptions.data ?? [],
    blocked: blocked.data ?? [],
  }
}

export async function getTeacherTimezone(): Promise<string> {
  const { data, error } = await getSupabase()
    .from('settings')
    .select('teacher_timezone')
    .maybeSingle()
  if (error) fail(error, 'Não foi possível carregar o fuso da professora.')
  return safeTimezone(data?.teacher_timezone ?? DEFAULT_TIMEZONE)
}

// ------------------------------------------------------------------ padrões

export async function savePattern(input: PatternInput, id?: string): Promise<string> {
  const row = {
    name: input.name.trim(),
    starts_on: input.starts_on,
    ends_on: input.ends_on === '' ? null : input.ends_on,
    default_lesson_minutes: input.default_lesson_minutes,
    active: input.active,
  }
  const query = id
    ? getSupabase().from('availability_patterns').update(row).eq('id', id)
    : getSupabase().from('availability_patterns').insert(row)
  const { data, error } = await query.select('id').single()
  if (error) fail(error, 'Não foi possível salvar o horário padrão. Tente de novo.')
  return data.id
}

export async function deletePattern(id: string): Promise<void> {
  const { error } = await getSupabase()
    .from('availability_patterns')
    .delete()
    .eq('id', id)
  if (error) fail(error, 'Não foi possível excluir o horário padrão. Tente de novo.')
}

/** Substitui as faixas do padrão (insere as novas e só então remove as antigas). */
export async function setPatternSlots(
  patternId: string,
  slots: readonly PatternSlotInput[],
): Promise<void> {
  const sb = getSupabase()
  const old = await sb.from('availability_slots').select('id').eq('pattern_id', patternId)
  if (old.error) fail(old.error, 'Não foi possível atualizar as faixas. Tente de novo.')
  if (slots.length > 0) {
    const { error } = await sb.from('availability_slots').insert(
      slots.map((s) => ({
        pattern_id: patternId,
        weekday: s.weekday,
        start_time: s.start_time,
        end_time: s.end_time,
        notes: s.notes ?? null,
      })),
    )
    if (error) fail(error, 'Não foi possível salvar as faixas. Tente de novo.')
  }
  const ids = old.data.map((r) => r.id)
  if (ids.length > 0) {
    const { error } = await sb.from('availability_slots').delete().in('id', ids)
    if (error) fail(error, 'Não foi possível remover as faixas antigas. Tente de novo.')
  }
}

// ------------------------------------------------------------------ exceções

function exceptionRow(input: ExceptionInput) {
  const closed = input.kind === 'fechado'
  const reason = input.reason?.trim()
  return {
    on_date: input.on_date,
    kind: input.kind,
    start_time: closed ? null : (input.start_time ?? null),
    end_time: closed ? null : (input.end_time ?? null),
    reason: reason ? reason : null,
  }
}

export async function addException(input: ExceptionInput): Promise<string> {
  const { data, error } = await getSupabase()
    .from('availability_exceptions')
    .insert(exceptionRow(input))
    .select('id')
    .single()
  if (error) fail(error, 'Não foi possível salvar a exceção. Tente de novo.')
  return data.id
}

export async function updateException(id: string, input: ExceptionInput): Promise<void> {
  const { error } = await getSupabase()
    .from('availability_exceptions')
    .update(exceptionRow(input))
    .eq('id', id)
  if (error) fail(error, 'Não foi possível atualizar a exceção. Tente de novo.')
}

export async function deleteException(id: string): Promise<void> {
  const { error } = await getSupabase()
    .from('availability_exceptions')
    .delete()
    .eq('id', id)
  if (error) fail(error, 'Não foi possível excluir a exceção. Tente de novo.')
}

// ------------------------------------------------------------------ férias/feriados

export async function addBlockedDates(
  rows: readonly BlockedDateInput[],
): Promise<string[]> {
  if (rows.length === 0) return []
  const { data, error } = await getSupabase()
    .from('blocked_dates')
    .insert(
      rows.map((r) => ({
        starts_on: r.starts_on,
        ends_on: r.ends_on === '' ? r.starts_on : r.ends_on,
        reason: r.reason?.trim() ? r.reason.trim() : null,
      })),
    )
    .select('id')
  if (error) fail(error, 'Não foi possível salvar os dias bloqueados. Tente de novo.')
  return data.map((r) => r.id)
}

export async function deleteBlockedDate(id: string): Promise<void> {
  const { error } = await getSupabase().from('blocked_dates').delete().eq('id', id)
  if (error) fail(error, 'Não foi possível excluir o período.')
}

// ------------------------------------------------------------------ aulas

export async function checkSlot(
  startsAtIso: string,
  duration: number,
): Promise<SlotCheck> {
  const { data, error } = await getSupabase().rpc('is_slot_available', {
    p_starts_at: startsAtIso,
    p_duration: duration,
  })
  if (error) fail(error, 'Não foi possível conferir a disponibilidade.')
  return data
}

export function listLessonsInRange(from: Date, to: Date): Promise<LessonWithStudent[]> {
  return listLessonsBetween(from, to)
}

/** Cancela (pela professora) uma a uma; nunca lança, devolve sucessos e falhas. */
export async function cancelLessonsByTeacher(
  ids: readonly string[],
  reason: string,
): Promise<CancelOutcome> {
  const out: CancelOutcome = { succeeded: [], failed: [] }
  for (const id of ids) {
    try {
      await cancelLesson(id, true, reason)
      out.succeeded.push(id)
    } catch (e) {
      out.failed.push({
        id,
        message: e instanceof Error ? e.message : 'Não foi possível cancelar a aula.',
      })
    }
  }
  return out
}

/** Existe ao menos um horário padrão ativo? (consulta leve: limit 1) */
export async function hasActiveAvailabilityPattern(): Promise<boolean> {
  const { data, error } = await getSupabase()
    .from('availability_patterns')
    .select('id')
    .eq('active', true)
    .limit(1)
  if (error) fail(error, 'Não foi possível conferir o horário padrão.')
  return data.length > 0
}

/** Gera as aulas dos horários fixos e devolve o relatório (criadas e puladas). */
export async function generateRecurringLessons(
  from: string,
  to: string,
): Promise<GenerationReport> {
  const { data, error } = await getSupabase().rpc('generate_recurring_lessons', {
    p_from: from,
    p_to: to,
  })
  if (error) fail(error, 'Não foi possível gerar as aulas. Tente de novo.')
  return parseGenerationReport(data)
}

export async function listActiveStudents(): Promise<StudentRecord[]> {
  return (await listStudents()).filter((s) => s.status === 'ativo')
}

/** Aula avulsa. O banco revalida a disponibilidade (erro vem traduzido). */
export async function createLesson(input: {
  studentId: string
  startsAtIso: string
  durationMinutes: number
}): Promise<string> {
  const { data, error } = await getSupabase()
    .from('lessons')
    .insert({
      student_id: input.studentId,
      starts_at: input.startsAtIso,
      duration_minutes: input.durationMinutes,
      status: 'agendada',
    })
    .select('id')
    .single()
  if (error) fail(error, 'Não foi possível criar a aula. Tente de novo.')
  return data.id
}

/** Remarca (data/hora e, opcionalmente, duração). O banco revalida. */
export async function rescheduleLesson(
  id: string,
  startsAtIso: string,
  durationMinutes?: number,
): Promise<void> {
  const { error } = await getSupabase()
    .from('lessons')
    .update({
      starts_at: startsAtIso,
      ...(durationMinutes === undefined ? {} : { duration_minutes: durationMinutes }),
    })
    .eq('id', id)
  if (error) fail(error, 'Não foi possível remarcar a aula. Tente de novo.')
}
