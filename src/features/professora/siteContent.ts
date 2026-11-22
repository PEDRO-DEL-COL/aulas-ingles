/** Lógica pura do conteúdo público (currículo e depoimentos). Limites iguais aos CHECKs da migration 21. */

export const NAME_MAX = 80
export const HEADLINE_MAX = 120
export const BIO_MAX = 2000
export const ITEM_MAX = 200
export const ITEMS_MAX = 12
export const PHOTO_URL_MAX = 500
export const TESTIMONIAL_NAME_MAX = 80
export const TESTIMONIAL_CONTEXT_MAX = 80
export const TESTIMONIAL_BODY_MAX = 600
export const POSITION_MAX = 1000

export type ProfileForm = {
  display_name: string
  headline: string
  bio: string
  education: string
  experience: string
  certifications: string
  languages: string
  photo_url: string
  published: boolean
}

export type ProfileInput = {
  display_name: string | null
  headline: string | null
  bio: string | null
  education: string[]
  experience: string[]
  certifications: string[]
  languages: string[]
  photo_url: string | null
  published: boolean
}

export type Validated<T> = { ok: true; value: T } | { ok: false; error: string }

/** Texto com uma linha por item -> lista sem linhas vazias. */
export function parseLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l !== '')
}

export function linesToText(items: readonly string[]): string {
  return items.join('\n')
}

function orNull(s: string): string | null {
  const t = s.trim()
  return t === '' ? null : t
}

const LIST_LABELS = {
  education: 'Formação',
  experience: 'Experiência',
  certifications: 'Certificações',
  languages: 'Idiomas',
} as const

export function validateProfile(form: ProfileForm): Validated<ProfileInput> {
  const display_name = orNull(form.display_name)
  if (display_name && display_name.length > NAME_MAX)
    return { ok: false, error: `O nome de exibição pode ter até ${NAME_MAX} caracteres.` }
  const headline = orNull(form.headline)
  if (headline && headline.length > HEADLINE_MAX)
    return { ok: false, error: `A chamada pode ter até ${HEADLINE_MAX} caracteres.` }
  // A bio não é aparada no banco (só limite de tamanho), mas aparamos nas pontas.
  const bio = orNull(form.bio)
  if (bio && bio.length > BIO_MAX)
    return { ok: false, error: `A apresentação pode ter até ${BIO_MAX} caracteres.` }

  const lists = {} as Record<keyof typeof LIST_LABELS, string[]>
  for (const key of Object.keys(LIST_LABELS) as (keyof typeof LIST_LABELS)[]) {
    const items = parseLines(form[key])
    if (items.length > ITEMS_MAX)
      return {
        ok: false,
        error: `${LIST_LABELS[key]}: no máximo ${ITEMS_MAX} itens (um por linha).`,
      }
    if (items.some((i) => i.length > ITEM_MAX))
      return {
        ok: false,
        error: `${LIST_LABELS[key]}: cada item pode ter até ${ITEM_MAX} caracteres.`,
      }
    lists[key] = items
  }

  const photo_url = orNull(form.photo_url)
  if (photo_url) {
    if (photo_url.length > PHOTO_URL_MAX)
      return {
        ok: false,
        error: `O link da foto pode ter até ${PHOTO_URL_MAX} caracteres.`,
      }
    if (!/^https:\/\/\S+$/.test(photo_url))
      return {
        ok: false,
        error: 'O link da foto precisa começar com https:// e não ter espaços.',
      }
  }

  return {
    ok: true,
    value: {
      display_name,
      headline,
      bio,
      ...lists,
      photo_url,
      published: form.published,
    },
  }
}

export type TestimonialForm = {
  author_name: string
  author_context: string
  body: string
  /** '' = sem nota. */
  rating: string
  position: string
}

export type TestimonialInput = {
  author_name: string
  author_context: string | null
  body: string
  rating: number | null
  position: number
}

export function validateTestimonial(form: TestimonialForm): Validated<TestimonialInput> {
  const author_name = form.author_name.trim()
  if (author_name === '')
    return { ok: false, error: 'Informe o nome de quem deu o depoimento.' }
  if (author_name.length > TESTIMONIAL_NAME_MAX)
    return { ok: false, error: `O nome pode ter até ${TESTIMONIAL_NAME_MAX} caracteres.` }
  const author_context = orNull(form.author_context)
  if (author_context && author_context.length > TESTIMONIAL_CONTEXT_MAX)
    return {
      ok: false,
      error: `O complemento pode ter até ${TESTIMONIAL_CONTEXT_MAX} caracteres.`,
    }
  const body = form.body.trim()
  if (body === '') return { ok: false, error: 'Escreva o texto do depoimento.' }
  if (body.length > TESTIMONIAL_BODY_MAX)
    return {
      ok: false,
      error: `O depoimento pode ter até ${TESTIMONIAL_BODY_MAX} caracteres.`,
    }

  let rating: number | null = null
  const r = form.rating.trim()
  if (r !== '') {
    rating = Number(r)
    if (!Number.isInteger(rating) || rating < 1 || rating > 5)
      return {
        ok: false,
        error: 'A nota deve ser um número inteiro de 1 a 5, ou ficar em branco.',
      }
  }

  const p = form.position.trim()
  const position = p === '' ? 0 : Number(p)
  if (!Number.isInteger(position) || position < 0 || position > POSITION_MAX)
    return {
      ok: false,
      error: `A ordem deve ser um número inteiro de 0 a ${POSITION_MAX}.`,
    }

  return { ok: true, value: { author_name, author_context, body, rating, position } }
}

export function emptyTestimonialForm(position = 0): TestimonialForm {
  return {
    author_name: '',
    author_context: '',
    body: '',
    rating: '',
    position: String(position),
  }
}
