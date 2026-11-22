/**
 * Dados públicos do site (WhatsApp da professora e planos ativos), vindos da RPC
 * `public_site_info()` do Supabase via REST puro. NÃO importa supabase-js: a landing
 * precisa continuar leve. Brand.ts/env ficam só como fallback.
 */
import type { Plan, PlanBilling, Testimonial } from '@/config/brand'
import { buildWhatsAppLink } from '@/lib/whatsapp'

export type PublicPlan = {
  id: string
  name: string
  billingModel: 'mensalidade' | 'pacote' | 'avulsa'
  lessonsPerMonth: number | null
  lessonsInPackage: number | null
  lessonDurationMinutes: number
  priceCents: number
  currency: string
  description: string | null
  benefits: string[]
}

export type PublicTeacherProfile = {
  displayName: string | null
  headline: string | null
  bio: string | null
  education: string[]
  experience: string[]
  certifications: string[]
  languages: string[]
  photoUrl: string | null
}

export type PublicTestimonial = {
  id: string
  authorName: string
  authorContext: string | null
  body: string
  rating: number | null
}

export type PublicSiteInfo = {
  whatsappNumber: string | null
  plans: PublicPlan[]
  /** null = não publicado (ou vazio) */
  teacherProfile: PublicTeacherProfile | null
  testimonials: PublicTestimonial[]
}

export type ResolvedAbout = {
  displayName: string
  headline: string
  paragraphs: string[]
  highlights: string[]
  education: string[]
  experience: string[]
  certifications: string[]
  languages: string[]
  photoUrl: string | null
}

export type ResolvedTestimonial = {
  id: string
  name: string
  context: string | null
  text: string
  rating: number | null
  /** true = exemplo de brand.ts (exibe selo) */
  placeholder: boolean
}

export type ResolvedSiteInfo = {
  /** Apenas dígitos; '' quando não há número */
  whatsappNumber: string
  whatsappLink: string | null
  plans: Plan[]
  /** 'remote' quando os planos vieram do banco; 'fallback' quando são os de exemplo */
  plansSource: 'remote' | 'fallback'
  about: ResolvedAbout
  aboutSource: 'remote' | 'fallback'
  testimonials: ResolvedTestimonial[]
  testimonialsSource: 'remote' | 'fallback'
}

export type SiteFallback = {
  whatsappNumber: string
  message: string
  plans: Plan[]
  about: {
    teacherName: string
    headline: string
    paragraphs: string[]
    highlights: string[]
    education: string[]
    experience: string[]
    certifications: string[]
    languages: string[]
  }
  testimonials: Testimonial[]
}

const CACHE_KEY = 'public-site-info:v2'
const TIMEOUT_MS = 4000
const BILLING = ['mensalidade', 'pacote', 'avulsa'] as const

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function posInt(v: unknown): number | null {
  return typeof v === 'number' && Number.isInteger(v) && v > 0 ? v : null
}

function parseBenefits(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  const out: string[] = []
  for (const item of v) {
    if (typeof item !== 'string') continue
    const t = item.trim()
    if (t.length >= 1 && t.length <= 120) out.push(t)
    if (out.length === 12) break
  }
  return out
}

function optText(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null
  const t = v.trim()
  return t.length >= 1 && t.length <= max ? t : null
}

function parseList(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  const out: string[] = []
  for (const item of v) {
    if (typeof item !== 'string') continue
    const t = item.trim()
    if (t.length >= 1 && t.length <= 200) out.push(t)
    if (out.length === 12) break
  }
  return out
}

function parseTeacherProfile(raw: unknown): PublicTeacherProfile | null {
  if (!isRecord(raw)) return null
  const photo = typeof raw.photo_url === 'string' ? raw.photo_url.trim() : ''
  const profile: PublicTeacherProfile = {
    displayName: optText(raw.display_name, 80),
    headline: optText(raw.headline, 120),
    bio: optText(raw.bio, 2000),
    education: parseList(raw.education),
    experience: parseList(raw.experience),
    certifications: parseList(raw.certifications),
    languages: parseList(raw.languages),
    photoUrl: photo.startsWith('https://') && photo.length <= 500 ? photo : null,
  }
  const empty =
    !profile.headline &&
    !profile.bio &&
    !profile.education.length &&
    !profile.experience.length &&
    !profile.certifications.length &&
    !profile.languages.length
  return empty ? null : profile
}

function parseTestimonial(raw: unknown): PublicTestimonial | null {
  if (!isRecord(raw)) return null
  const { id } = raw
  if (typeof id !== 'string' || id === '') return null
  const authorName = optText(raw.author_name, 120)
  const body = optText(raw.body, 600)
  if (!authorName || !body) return null
  const r = raw.rating
  return {
    id,
    authorName,
    authorContext: optText(raw.author_context, 120),
    body,
    rating: typeof r === 'number' && Number.isInteger(r) && r >= 1 && r <= 5 ? r : null,
  }
}

function parsePlan(raw: unknown): PublicPlan | null {
  if (!isRecord(raw)) return null
  const { id, name, billing_model: billing } = raw
  if (typeof id !== 'string' || id === '') return null
  if (typeof name !== 'string' || name.trim() === '') return null
  if (!BILLING.includes(billing as (typeof BILLING)[number])) return null
  const duration = posInt(raw.lesson_duration_minutes)
  const price = raw.price_cents
  if (duration === null) return null
  if (typeof price !== 'number' || !Number.isInteger(price) || price < 0) return null
  const lessonsPerMonth = posInt(raw.lessons_per_month)
  const lessonsInPackage = posInt(raw.lessons_in_package)
  if (billing === 'mensalidade' && lessonsPerMonth === null) return null
  if (billing === 'pacote' && lessonsInPackage === null) return null
  return {
    id,
    name: name.trim(),
    billingModel: billing as PublicPlan['billingModel'],
    lessonsPerMonth,
    lessonsInPackage,
    lessonDurationMinutes: duration,
    priceCents: price,
    currency: typeof raw.currency === 'string' ? raw.currency : 'BRL',
    description: typeof raw.description === 'string' ? raw.description : null,
    benefits: parseBenefits(raw.benefits),
  }
}

/** Validação defensiva da resposta da RPC. null = resposta inutilizável. */
export function parsePublicSiteInfo(json: unknown): PublicSiteInfo | null {
  if (!isRecord(json)) return null
  const rawNumber = json.whatsapp_number
  let whatsappNumber: string | null = null
  if (typeof rawNumber === 'string') {
    const digits = rawNumber.replace(/\D/g, '')
    if (digits.length >= 10 && digits.length <= 15) whatsappNumber = digits
  }
  const plans = Array.isArray(json.plans)
    ? json.plans.map(parsePlan).filter((p): p is PublicPlan => p !== null)
    : []
  const testimonials = Array.isArray(json.testimonials)
    ? json.testimonials
        .map(parseTestimonial)
        .filter((t): t is PublicTestimonial => t !== null)
        .slice(0, 24)
    : []
  return {
    whatsappNumber,
    plans,
    teacherProfile: parseTeacherProfile(json.teacher_profile),
    testimonials,
  }
}

const BILLING_MAP: Record<PublicPlan['billingModel'], PlanBilling> = {
  mensalidade: 'monthly',
  pacote: 'package',
  avulsa: 'single',
}

/**
 * Converte para o tipo Plan da landing. Destaque ("Mais escolhido"): com 3 ou mais
 * planos (ordenados por preço) destaca o do meio; com menos, nenhum.
 */
export function toLandingPlans(plans: PublicPlan[]): Plan[] {
  const highlightIndex = plans.length >= 3 ? Math.floor(plans.length / 2) : -1
  return plans.map((p, i) => ({
    id: p.id,
    name: p.name,
    billing: BILLING_MAP[p.billingModel],
    lessons:
      p.billingModel === 'mensalidade'
        ? (p.lessonsPerMonth ?? 1)
        : p.billingModel === 'pacote'
          ? (p.lessonsInPackage ?? 1)
          : 1,
    durationMinutes: p.lessonDurationMinutes,
    price: p.priceCents / 100,
    highlight: i === highlightIndex,
    description: p.description ?? '',
    perks: p.benefits,
  }))
}

/** Aplica os fallbacks: whatsapp null => env; plans vazio => brand.ts. Função pura. */
export function resolveSiteInfo(
  remote: PublicSiteInfo | null,
  fallback: SiteFallback,
): ResolvedSiteInfo {
  const number = remote?.whatsappNumber || fallback.whatsappNumber
  const hasPlans = !!remote && remote.plans.length > 0
  const profile = remote?.teacherProfile ?? null
  const fb = fallback.about
  const about: ResolvedAbout = profile
    ? {
        displayName: profile.displayName ?? fb.teacherName,
        headline: profile.headline ?? fb.headline,
        paragraphs: (profile.bio ?? '')
          .split(/\r?\n/)
          .map((p) => p.trim())
          .filter(Boolean),
        highlights: fb.highlights,
        education: profile.education,
        experience: profile.experience,
        certifications: profile.certifications,
        languages: profile.languages,
        photoUrl: profile.photoUrl,
      }
    : {
        displayName: fb.teacherName,
        headline: fb.headline,
        paragraphs: fb.paragraphs,
        highlights: fb.highlights,
        education: fb.education,
        experience: fb.experience,
        certifications: fb.certifications,
        languages: fb.languages,
        photoUrl: null,
      }
  const hasTestimonials = !!remote && remote.testimonials.length > 0
  const testimonials: ResolvedTestimonial[] = hasTestimonials
    ? remote.testimonials.map((t) => ({
        id: t.id,
        name: t.authorName,
        context: t.authorContext,
        text: t.body,
        rating: t.rating,
        placeholder: false,
      }))
    : fallback.testimonials.map((t) => ({
        id: t.id,
        name: t.name,
        context: t.role,
        text: t.text,
        rating: null,
        placeholder: t.placeholder,
      }))
  return {
    whatsappNumber: number,
    whatsappLink: number ? buildWhatsAppLink(number, fallback.message) : null,
    plans: hasPlans ? toLandingPlans(remote.plans) : fallback.plans,
    plansSource: hasPlans ? 'remote' : 'fallback',
    about,
    aboutSource: profile ? 'remote' : 'fallback',
    testimonials,
    testimonialsSource: hasTestimonials ? 'remote' : 'fallback',
  }
}

export function readCachedSiteInfo(): PublicSiteInfo | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    return raw ? parsePublicSiteInfo(JSON.parse(raw)) : null
  } catch {
    return null
  }
}

function writeCache(json: unknown) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(json))
  } catch {
    /* sem armazenamento: só não guarda */
  }
}

/** Busca a RPC pública. Nunca lança; null em qualquer falha ou sem envs. */
export async function fetchPublicSiteInfo(
  signal?: AbortSignal,
): Promise<PublicSiteInfo | null> {
  const url = (import.meta.env.VITE_SUPABASE_URL ?? '').trim().replace(/\/+$/, '')
  const key = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? '').trim()
  if (!url || !key) return null
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  const onAbort = () => controller.abort()
  signal?.addEventListener('abort', onAbort)
  try {
    const res = await fetch(`${url}/rest/v1/rpc/public_site_info`, {
      method: 'GET',
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      signal: controller.signal,
    })
    if (!res.ok) return null
    const json: unknown = await res.json()
    const info = parsePublicSiteInfo(json)
    if (info) writeCache(json)
    return info
  } catch {
    return null
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', onAbort)
  }
}
