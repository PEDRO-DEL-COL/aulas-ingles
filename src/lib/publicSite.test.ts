import { describe, expect, it } from 'vitest'

import type { Plan } from '@/config/brand'

import {
  parsePublicSiteInfo,
  resolveSiteInfo,
  toLandingPlans,
  type SiteFallback,
} from './publicSite'

const plan = (over: Record<string, unknown> = {}) => ({
  id: 'p1',
  name: 'Mensal',
  billing_model: 'mensalidade',
  lessons_per_month: 4,
  lessons_in_package: null,
  lesson_duration_minutes: 50,
  price_cents: 28000,
  currency: 'BRL',
  description: null,
  ...over,
})

const fbPlan: Plan = {
  id: 'fb',
  name: 'Exemplo',
  billing: 'single',
  lessons: 1,
  durationMinutes: 50,
  price: 85,
  highlight: false,
  description: '',
  perks: [],
}
const fallback: SiteFallback = {
  whatsappNumber: '5531988887777',
  message: 'Oi',
  plans: [fbPlan],
  about: {
    teacherName: 'Prof Fallback',
    headline: 'Headline fb',
    paragraphs: ['Par fb'],
    highlights: ['H1'],
    education: ['Edu fb'],
    experience: [],
    certifications: [],
    languages: [],
  },
  testimonials: [
    { id: 't1', name: 'Ex', role: 'Papel', text: 'Texto ex', placeholder: true },
  ],
}

const tm = (over: Record<string, unknown> = {}) => ({
  id: 't1',
  author_name: 'Ana',
  author_context: 'Estudante',
  body: 'Muito bom',
  rating: 5,
  ...over,
})

const profile = (over: Record<string, unknown> = {}) => ({
  display_name: 'Maria Silva',
  headline: 'Inglês leve',
  bio: 'Linha 1\n\nLinha 2',
  education: ['Letras'],
  experience: [],
  certifications: [],
  languages: [],
  photo_url: 'https://x.test/a.jpg',
  ...over,
})

describe('teacher_profile', () => {
  it('parseia perfil válido', () => {
    const r = parsePublicSiteInfo({ teacher_profile: profile() })!
    expect(r.teacherProfile?.displayName).toBe('Maria Silva')
    expect(r.teacherProfile?.photoUrl).toBe('https://x.test/a.jpg')
    expect(r.teacherProfile?.education).toEqual(['Letras'])
  })
  it('foto só com https e <= 500', () => {
    const p = (u: string) =>
      parsePublicSiteInfo({ teacher_profile: profile({ photo_url: u }) })!.teacherProfile
    expect(p('http://x.test/a.jpg')?.photoUrl).toBeNull()
    expect(p('javascript:alert(1)')?.photoUrl).toBeNull()
    expect(p('https://x.test/' + 'a'.repeat(500))?.photoUrl).toBeNull()
  })
  it('limites de texto e listas', () => {
    const r = parsePublicSiteInfo({
      teacher_profile: profile({
        display_name: 'n'.repeat(81),
        headline: 'h'.repeat(121),
        bio: 'b'.repeat(2001),
        education: [
          '',
          'x'.repeat(201),
          5,
          ...Array.from({ length: 20 }, (_, i) => `e${i}`),
        ],
      }),
    })!.teacherProfile!
    expect(r.displayName).toBeNull()
    expect(r.headline).toBeNull()
    expect(r.bio).toBeNull()
    expect(r.education).toHaveLength(12)
    expect(r.education[0]).toBe('e0')
  })
  it('perfil vazio, ausente ou inválido vira null', () => {
    expect(
      parsePublicSiteInfo({
        teacher_profile: profile({ headline: null, bio: null, education: [] }),
      })!.teacherProfile,
    ).toBeNull()
    expect(parsePublicSiteInfo({ teacher_profile: null })!.teacherProfile).toBeNull()
    expect(parsePublicSiteInfo({ teacher_profile: 'x' })!.teacherProfile).toBeNull()
  })
})

describe('testimonials', () => {
  it('parseia válidos e descarta inválidos', () => {
    const r = parsePublicSiteInfo({
      testimonials: [
        tm(),
        tm({ id: '' }),
        tm({ author_name: ' ' }),
        tm({ body: '' }),
        tm({ body: 'x'.repeat(601) }),
        7,
        tm({ id: 't2', rating: 6, author_context: null }),
        tm({ id: 't3', rating: 3.5 }),
        tm({ id: 't4', rating: 4 }),
      ],
    })!.testimonials
    expect(r.map((t) => t.id)).toEqual(['t1', 't2', 't3', 't4'])
    expect(r.map((t) => t.rating)).toEqual([5, null, null, 4])
    expect(r[1]?.authorContext).toBeNull()
  })
  it('limita a 24', () => {
    const many = Array.from({ length: 30 }, (_, i) => tm({ id: `t${i}` }))
    expect(parsePublicSiteInfo({ testimonials: many })!.testimonials).toHaveLength(24)
  })
  it('resposta antiga sem chaves novas', () => {
    const r = parsePublicSiteInfo({ whatsapp_number: null, plans: [] })!
    expect(r.teacherProfile).toBeNull()
    expect(r.testimonials).toEqual([])
    const res = resolveSiteInfo(r, fallback)
    expect(res.aboutSource).toBe('fallback')
    expect(res.testimonialsSource).toBe('fallback')
  })
})

describe('resolveSiteInfo about/testimonials', () => {
  it('com depoimentos reais, exemplos somem', () => {
    const r = resolveSiteInfo(parsePublicSiteInfo({ testimonials: [tm()] }), fallback)
    expect(r.testimonialsSource).toBe('remote')
    expect(r.testimonials).toHaveLength(1)
    expect(r.testimonials[0]).toMatchObject({
      name: 'Ana',
      context: 'Estudante',
      rating: 5,
      placeholder: false,
    })
  })
  it('sem depoimentos mostra exemplos com selo', () => {
    const r = resolveSiteInfo(parsePublicSiteInfo({ testimonials: [] }), fallback)
    expect(r.testimonialsSource).toBe('fallback')
    expect(r.testimonials[0]).toMatchObject({
      name: 'Ex',
      context: 'Papel',
      placeholder: true,
    })
  })
  it('currículo remoto prevalece e bio vira parágrafos', () => {
    const r = resolveSiteInfo(
      parsePublicSiteInfo({ teacher_profile: profile() }),
      fallback,
    )
    expect(r.aboutSource).toBe('remote')
    expect(r.about.displayName).toBe('Maria Silva')
    expect(r.about.paragraphs).toEqual(['Linha 1', 'Linha 2'])
    expect(r.about.education).toEqual(['Letras'])
    expect(r.about.photoUrl).toBe('https://x.test/a.jpg')
  })
  it('nome e headline ausentes caem para o fallback', () => {
    const r = resolveSiteInfo(
      parsePublicSiteInfo({
        teacher_profile: profile({ display_name: null, headline: null }),
      }),
      fallback,
    )
    expect(r.about.displayName).toBe('Prof Fallback')
    expect(r.about.headline).toBe('Headline fb')
  })
  it('currículo vazio cai para o fallback', () => {
    const r = resolveSiteInfo(
      parsePublicSiteInfo({
        teacher_profile: profile({ headline: null, bio: null, education: [] }),
      }),
      fallback,
    )
    expect(r.aboutSource).toBe('fallback')
    expect(r.about.education).toEqual(['Edu fb'])
    expect(r.about.photoUrl).toBeNull()
  })
})

describe('parsePublicSiteInfo', () => {
  it('aceita resposta válida', () => {
    const r = parsePublicSiteInfo({
      whatsapp_number: '5511999998888',
      plans: [plan()],
    })
    expect(r?.whatsappNumber).toBe('5511999998888')
    expect(r?.plans).toHaveLength(1)
    expect(r?.plans[0]?.priceCents).toBe(28000)
  })
  it('rejeita lixo', () => {
    expect(parsePublicSiteInfo(null)).toBeNull()
    expect(parsePublicSiteInfo('x')).toBeNull()
    expect(parsePublicSiteInfo([])).toBeNull()
  })
  it('descarta whatsapp inválido e planos inválidos', () => {
    const r = parsePublicSiteInfo({
      whatsapp_number: '123',
      plans: [plan({ billing_model: 'x' }), plan({ price_cents: -1 }), 5, plan()],
    })
    expect(r?.whatsappNumber).toBeNull()
    expect(r?.plans).toHaveLength(1)
  })
  it('plans ausente vira lista vazia', () => {
    expect(parsePublicSiteInfo({ whatsapp_number: null })?.plans).toEqual([])
  })
  it('exige quantidade de aulas conforme o modelo', () => {
    const r = parsePublicSiteInfo({
      plans: [plan({ lessons_per_month: null }), plan({ billing_model: 'avulsa' })],
    })
    expect(r?.plans).toHaveLength(1)
  })
})

describe('benefits', () => {
  it('ausente vira lista vazia e mapeia para perks', () => {
    const r = parsePublicSiteInfo({ plans: [plan()] })!
    expect(r.plans[0]?.benefits).toEqual([])
    expect(toLandingPlans(r.plans)[0]?.perks).toEqual([])
  })
  it('filtra, apara e limita a 12', () => {
    const many = Array.from({ length: 15 }, (_, i) => `v${i}`)
    const r = parsePublicSiteInfo({
      plans: [plan({ benefits: [' A ', '', '   ', 5, 'x'.repeat(121), ...many] })],
    })!
    const b = r.plans[0]!.benefits
    expect(b).toHaveLength(12)
    expect(b.slice(0, 3)).toEqual(['A', 'v0', 'v1'])
    expect(toLandingPlans(r.plans)[0]?.perks).toEqual(b)
  })
  it('não-array vira vazio', () => {
    expect(
      parsePublicSiteInfo({ plans: [plan({ benefits: 'x' })] })!.plans[0]?.benefits,
    ).toEqual([])
  })
})

describe('toLandingPlans', () => {
  it('converte modelos, preço e descrição', () => {
    const parsed = parsePublicSiteInfo({
      plans: [
        plan(),
        plan({
          id: 'p2',
          billing_model: 'pacote',
          lessons_in_package: 10,
          lessons_per_month: null,
          price_cents: 65000,
          description: 'd',
        }),
        plan({ id: 'p3', billing_model: 'avulsa', lessons_per_month: null }),
      ],
    })!
    const out = toLandingPlans(parsed.plans)
    expect(out.map((p) => p.billing)).toEqual(['monthly', 'package', 'single'])
    expect(out.map((p) => p.lessons)).toEqual([4, 10, 1])
    expect(out[1]?.price).toBe(650)
    expect(out[0]?.description).toBe('')
    expect(out.map((p) => p.highlight)).toEqual([false, true, false])
  })
  it('sem destaque com menos de 3 planos', () => {
    const parsed = parsePublicSiteInfo({ plans: [plan()] })!
    expect(toLandingPlans(parsed.plans)[0]?.highlight).toBe(false)
  })
})

describe('resolveSiteInfo', () => {
  it('usa fallback sem dados remotos', () => {
    const r = resolveSiteInfo(null, fallback)
    expect(r.whatsappNumber).toBe('5531988887777')
    expect(r.whatsappLink).toContain('wa.me/5531988887777')
    expect(r.plans).toEqual([fbPlan])
    expect(r.plansSource).toBe('fallback')
  })
  it('whatsapp null cai para o env, planos remotos prevalecem', () => {
    const remote = parsePublicSiteInfo({ whatsapp_number: null, plans: [plan()] })
    const r = resolveSiteInfo(remote, fallback)
    expect(r.whatsappNumber).toBe('5531988887777')
    expect(r.plans[0]?.id).toBe('p1')
    expect(r.plansSource).toBe('remote')
  })
  it('plans vazio cai para brand.ts, whatsapp remoto prevalece', () => {
    const remote = parsePublicSiteInfo({ whatsapp_number: '5511999998888', plans: [] })
    const r = resolveSiteInfo(remote, fallback)
    expect(r.whatsappNumber).toBe('5511999998888')
    expect(r.plans).toEqual([fbPlan])
  })
  it('sem número nenhum, sem link', () => {
    const r = resolveSiteInfo(null, { ...fallback, whatsappNumber: '' })
    expect(r.whatsappLink).toBeNull()
  })
})
