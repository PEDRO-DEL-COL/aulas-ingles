import { describe, expect, it } from 'vitest'

import {
  emptyTestimonialForm,
  parseLines,
  validateProfile,
  validateTestimonial,
  type ProfileForm,
} from './siteContent'

const base: ProfileForm = {
  display_name: '  Ana ',
  headline: '',
  bio: '',
  education: ' Letras \n\n  \nCambridge ',
  experience: '',
  certifications: '',
  languages: 'Inglês',
  photo_url: '',
  published: false,
}

describe('parseLines', () => {
  it('apara e descarta linhas vazias', () => {
    expect(parseLines(' a \r\n\n b\n  ')).toEqual(['a', 'b'])
  })
})

describe('validateProfile', () => {
  it('normaliza', () => {
    const r = validateProfile(base)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.value.display_name).toBe('Ana')
      expect(r.value.headline).toBeNull()
      expect(r.value.education).toEqual(['Letras', 'Cambridge'])
      expect(r.value.photo_url).toBeNull()
    }
  })
  it('limita nome, chamada e bio', () => {
    expect(validateProfile({ ...base, display_name: 'a'.repeat(81) }).ok).toBe(false)
    expect(validateProfile({ ...base, headline: 'a'.repeat(121) }).ok).toBe(false)
    expect(validateProfile({ ...base, bio: 'a'.repeat(2001) }).ok).toBe(false)
    expect(validateProfile({ ...base, bio: 'a'.repeat(2000) }).ok).toBe(true)
  })
  it('limita itens das listas', () => {
    const many = Array.from({ length: 13 }, (_, i) => `i${i}`).join('\n')
    expect(validateProfile({ ...base, experience: many }).ok).toBe(false)
    expect(validateProfile({ ...base, languages: 'a'.repeat(201) }).ok).toBe(false)
    expect(validateProfile({ ...base, languages: 'a'.repeat(200) }).ok).toBe(true)
  })
  it('exige https na foto', () => {
    expect(validateProfile({ ...base, photo_url: 'http://x.com/a.jpg' }).ok).toBe(false)
    expect(validateProfile({ ...base, photo_url: 'https://x.com/a b.jpg' }).ok).toBe(
      false,
    )
    expect(validateProfile({ ...base, photo_url: 'https://x.com/a.jpg' }).ok).toBe(true)
    expect(
      validateProfile({ ...base, photo_url: 'https://x.com/' + 'a'.repeat(500) }).ok,
    ).toBe(false)
  })
})

describe('validateTestimonial', () => {
  const ok = { ...emptyTestimonialForm(), author_name: ' Bia ', body: ' Ótimo ' }
  it('normaliza', () => {
    expect(validateTestimonial(ok)).toEqual({
      ok: true,
      value: {
        author_name: 'Bia',
        author_context: null,
        body: 'Ótimo',
        rating: null,
        position: 0,
      },
    })
  })
  it('exige nome e texto', () => {
    expect(validateTestimonial({ ...ok, author_name: ' ' }).ok).toBe(false)
    expect(validateTestimonial({ ...ok, body: '' }).ok).toBe(false)
  })
  it('limites de tamanho', () => {
    expect(validateTestimonial({ ...ok, author_name: 'a'.repeat(81) }).ok).toBe(false)
    expect(validateTestimonial({ ...ok, author_context: 'a'.repeat(81) }).ok).toBe(false)
    expect(validateTestimonial({ ...ok, body: 'a'.repeat(601) }).ok).toBe(false)
    expect(validateTestimonial({ ...ok, body: 'a'.repeat(600) }).ok).toBe(true)
  })
  it('nota 1..5 ou vazia', () => {
    for (const r of ['0', '6', '2.5', 'x']) {
      expect(validateTestimonial({ ...ok, rating: r }).ok).toBe(false)
    }
    const r = validateTestimonial({ ...ok, rating: '5' })
    expect(r.ok && r.value.rating).toBe(5)
  })
  it('ordem 0..1000', () => {
    expect(validateTestimonial({ ...ok, position: '-1' }).ok).toBe(false)
    expect(validateTestimonial({ ...ok, position: '1001' }).ok).toBe(false)
    expect(validateTestimonial({ ...ok, position: '1000' }).ok).toBe(true)
  })
})
