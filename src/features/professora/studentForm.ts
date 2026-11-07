import type { StudentRecord } from '@/features/aluno/lessons'
import { dayKey } from '@/features/shared/datetime'
import type { TablesInsert } from '@/types/database'

import { localToUtc } from './tz'
import type { StudentFormValues } from './validation'

export function emptyStudentValues(): StudentFormValues {
  return {
    full_name: '',
    email: '',
    phone: '',
    birth_date: '',
    is_minor: false,
    guardian_consent_name: '',
    consent_date: '',
    guardian_consent_notes: '',
    level: '',
    goal: '',
    plan_id: '',
    meet_link: '',
    status: 'ativo',
    notes_public: '',
  }
}

export function valuesFromStudent(s: StudentRecord, timezone: string): StudentFormValues {
  return {
    full_name: s.full_name,
    email: s.email,
    phone: s.phone ?? '',
    birth_date: s.birth_date ?? '',
    is_minor: s.is_minor,
    guardian_consent_name: s.guardian_consent_name ?? '',
    consent_date: s.consent_by_guardian_at
      ? dayKey(s.consent_by_guardian_at, timezone)
      : '',
    guardian_consent_notes: s.guardian_consent_notes ?? '',
    level: s.level ?? '',
    goal: s.goal ?? '',
    plan_id: s.plan_id ?? '',
    meet_link: s.meet_link ?? '',
    status: s.status,
    notes_public: s.notes_public ?? '',
  }
}

const orNull = (v: string): string | null => (v.trim() === '' ? null : v.trim())

/** Valores do formulário => colunas de students (e-mail em minúsculas, vazio vira null). */
export function payloadFromValues(
  v: StudentFormValues,
  existing: Pick<StudentRecord, 'consent_by_guardian_at'> | null,
  timezone: string,
): TablesInsert<'students'> {
  let consentAt: string | null = null
  if (v.consent_date !== '') {
    const current = existing?.consent_by_guardian_at ?? null
    consentAt =
      current && dayKey(current, timezone) === v.consent_date
        ? current
        : (localToUtc(v.consent_date, '12:00', timezone)?.toISOString() ?? null)
  }
  return {
    full_name: v.full_name.trim(),
    email: v.email.trim().toLowerCase(),
    phone: orNull(v.phone),
    birth_date: orNull(v.birth_date),
    is_minor: v.is_minor,
    guardian_consent_name: orNull(v.guardian_consent_name),
    consent_by_guardian_at: consentAt,
    guardian_consent_notes: orNull(v.guardian_consent_notes),
    level: orNull(v.level),
    goal: orNull(v.goal),
    plan_id: orNull(v.plan_id),
    meet_link: orNull(v.meet_link),
    status: v.status,
    notes_public: orNull(v.notes_public),
  }
}

/** Busca por nome/e-mail (sem acento, sem diferenciar maiúsculas) e filtro por situação. */
export function filterStudents<
  T extends Pick<StudentRecord, 'full_name' | 'email' | 'status'>,
>(
  students: readonly T[],
  search: string,
  status: StudentRecord['status'] | 'todos',
): T[] {
  const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  const q = norm(search.trim())
  return students.filter(
    (s) =>
      (status === 'todos' || s.status === status) &&
      (q === '' || norm(s.full_name).includes(q) || norm(s.email).includes(q)),
  )
}
