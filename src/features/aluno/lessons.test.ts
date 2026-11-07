import { describe, expect, it } from 'vitest'

import {
  canStudentCancel,
  findMakeup,
  joinWindowState,
  lessonStatusInfo,
  makeupText,
  pickNextLesson,
  previewCancellation,
  resolveMeetLink,
  safeExternalUrl,
  type Lesson,
} from './lessons'

const base: Lesson = {
  id: 'l1',
  student_id: 's1',
  schedule_id: null,
  starts_at: '2026-11-10T15:00:00Z',
  duration_minutes: 60,
  status: 'agendada',
  meet_link: null,
  rescheduled_from: null,
  cancel_reason: null,
  canceled_at: null,
  canceled_by: null,
  makeup_eligible: null,
  makeup_decided_by: null,
  blocked_date_id: null,
  created_at: '2026-11-01T00:00:00Z',
  updated_at: '2026-11-01T00:00:00Z',
}
const mk = (o: Partial<Lesson>): Lesson => ({ ...base, ...o })

describe('joinWindowState', () => {
  it('antes, durante e depois', () => {
    expect(joinWindowState(base, new Date('2026-11-10T14:44:59Z'))).toBe('before')
    expect(joinWindowState(base, new Date('2026-11-10T14:45:00Z'))).toBe('open')
    expect(joinWindowState(base, new Date('2026-11-10T15:59:59Z'))).toBe('open')
    expect(joinWindowState(base, new Date('2026-11-10T16:00:00Z'))).toBe('ended')
  })
})

describe('resolveMeetLink', () => {
  it('prefere o link da aula, depois o da ficha', () => {
    expect(resolveMeetLink({ meet_link: 'https://a' }, { meet_link: 'https://b' })).toBe(
      'https://a',
    )
    expect(resolveMeetLink({ meet_link: null }, { meet_link: 'https://b' })).toBe(
      'https://b',
    )
    expect(resolveMeetLink({ meet_link: '  ' }, { meet_link: 'https://b' })).toBe(
      'https://b',
    )
    expect(resolveMeetLink({ meet_link: null }, { meet_link: null })).toBeNull()
    expect(resolveMeetLink({ meet_link: null }, null)).toBeNull()
  })
})

describe('safeExternalUrl', () => {
  it('só http(s)', () => {
    expect(safeExternalUrl('https://meet.google.com/x')).toBe('https://meet.google.com/x')
    expect(safeExternalUrl('javascript:alert(1)')).toBeNull()
    expect(safeExternalUrl('nada')).toBeNull()
    expect(safeExternalUrl(null)).toBeNull()
  })
})

describe('previewCancellation', () => {
  const start = '2026-11-10T15:00:00Z'
  const off = {
    cancellation_min_hours: 24,
    late_cancel_band_enabled: false,
    late_cancel_band_min_hours: 12,
  }
  const on = { ...off, late_cancel_band_enabled: true }
  it('com reposição a partir do mínimo (inclusive)', () => {
    expect(previewCancellation(new Date('2026-11-09T15:00:00Z'), start, off)).toBe(
      'com_reposicao',
    )
    expect(previewCancellation(new Date('2026-11-09T15:00:01Z'), start, off)).toBe(
      'sem_reposicao',
    )
  })
  it('faixa intermediária', () => {
    expect(previewCancellation(new Date('2026-11-10T03:00:00Z'), start, on)).toBe(
      'a_criterio',
    )
    expect(previewCancellation(new Date('2026-11-10T03:00:01Z'), start, on)).toBe(
      'sem_reposicao',
    )
    expect(previewCancellation(new Date('2026-11-10T03:00:00Z'), start, off)).toBe(
      'sem_reposicao',
    )
  })
  it('mínimo zero sempre com reposição', () => {
    expect(
      previewCancellation(new Date('2026-11-10T14:59:00Z'), start, {
        ...off,
        cancellation_min_hours: 0,
      }),
    ).toBe('com_reposicao')
  })
})

describe('pickNextLesson', () => {
  const now = new Date('2026-11-10T15:30:00Z')
  it('inclui aula em andamento e ignora canceladas e passadas', () => {
    const lessons = [
      mk({ id: 'passada', starts_at: '2026-11-03T15:00:00Z' }),
      mk({
        id: 'cancelada',
        starts_at: '2026-11-11T15:00:00Z',
        status: 'cancelada_aluno',
      }),
      mk({ id: 'depois', starts_at: '2026-11-17T15:00:00Z' }),
      mk({ id: 'agora' }),
      mk({ id: 'repo', starts_at: '2026-11-12T15:00:00Z', status: 'reposicao' }),
    ]
    expect(pickNextLesson(lessons, now)?.id).toBe('agora')
    expect(pickNextLesson(lessons, new Date('2026-11-10T16:00:00Z'))?.id).toBe('repo')
    expect(pickNextLesson([], now)).toBeNull()
  })
})

describe('rótulos', () => {
  it('canStudentCancel', () => {
    const now = new Date('2026-11-10T10:00:00Z')
    expect(canStudentCancel(base, now)).toBe(true)
    expect(canStudentCancel(mk({ status: 'realizada' }), now)).toBe(false)
    expect(canStudentCancel(base, new Date('2026-11-10T15:00:00Z'))).toBe(false)
  })
  it('status e reposição', () => {
    expect(lessonStatusInfo('cancelada_aluno').label).toBe('Cancelada por você')
    expect(makeupText(mk({ status: 'cancelada_aluno', makeup_eligible: true }))).toMatch(
      /direito/,
    )
    expect(makeupText(mk({ status: 'cancelada_aluno', makeup_eligible: null }))).toMatch(
      /critério/,
    )
    expect(makeupText(base)).toBeNull()
  })

  it('cancelada pela professora: motivo e reposição', () => {
    const l = mk({
      status: 'cancelada_professora',
      makeup_eligible: true,
      cancel_reason: 'Férias/feriado: Natal',
    })
    expect(makeupText(l)).toBe(
      'Cancelada pela professora (Férias/feriado: Natal). Você tem direito a reposição; a professora vai agendar.',
    )
    expect(makeupText(mk({ status: 'cancelada_professora' }))).toMatch(
      /^Cancelada pela professora\. /,
    )
    expect(makeupText(l, { starts_at: '2026-11-20T15:00:00Z' }, () => '20/11')).toMatch(
      /Reposição agendada para 20\/11\.$/,
    )
  })
})

describe('findMakeup', () => {
  it('acha a reposição ativa derivada da aula', () => {
    const origin = mk({ id: 'o', status: 'cancelada_professora' })
    const old = mk({ id: 'r0', rescheduled_from: 'o', status: 'cancelada_aluno' })
    const rep = mk({ id: 'r1', rescheduled_from: 'o', status: 'reposicao' })
    expect(findMakeup('o', [origin, old, rep])?.id).toBe('r1')
    expect(findMakeup('o', [origin, old])).toBeNull()
    expect(findMakeup('x', [origin, rep])).toBeNull()
  })
})
