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
}

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
