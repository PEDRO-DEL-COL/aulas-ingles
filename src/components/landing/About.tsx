import { Award, BriefcaseBusiness, Check, GraduationCap, Languages } from 'lucide-react'
import { useState } from 'react'

import { Blob, Star } from '@/components/brand/Decor'
import { Reveal } from '@/components/brand/Reveal'
import { brand } from '@/config/brand'

import { SectionHeading } from './SectionHeading'
import { usePublicSite } from './usePublicSite'

function initials(name: string) {
  const parts = name.replace(/[[\]]/g, '').split(/\s+/).filter(Boolean)
  const first = parts[0]?.[0] ?? ''
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : ''
  return (first + last).toUpperCase()
}

export function About() {
  const { about, aboutSource } = usePublicSite()
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  const showPhoto = !!about.photoUrl && failedUrl !== about.photoUrl
  const groups = [
    { title: 'Formação', icon: GraduationCap, items: about.education },
    { title: 'Experiência', icon: BriefcaseBusiness, items: about.experience },
    { title: 'Certificações', icon: Award, items: about.certifications },
    { title: 'Idiomas', icon: Languages, items: about.languages },
  ].filter((g) => g.items.length > 0)

  return (
    <section
      id="sobre"
      aria-labelledby="titulo-sobre"
      className="scroll-mt-20 py-16 sm:py-24"
    >
      <div className="mx-auto grid max-w-6xl items-start gap-10 px-4 sm:px-6 md:grid-cols-[auto_1fr] md:gap-16">
        <Reveal className="relative mx-auto size-56 sm:size-72">
          <Blob className="float-slower absolute inset-0 size-full text-peach" />
          <Blob className="absolute -inset-3 size-[calc(100%+1.5rem)] rotate-90 text-lavender" />
          {showPhoto ? (
            <img
              src={about.photoUrl ?? undefined}
              alt={`Foto de ${about.displayName}`}
              loading="lazy"
              decoding="async"
              onError={() => setFailedUrl(about.photoUrl)}
              className="absolute inset-6 z-10 size-[calc(100%-3rem)] rounded-full bg-card object-cover shadow-sm"
            />
          ) : (
            <div
              role="img"
              aria-label={`Foto de ${about.displayName} (em breve)`}
              className="absolute inset-6 z-10 flex items-center justify-center rounded-full bg-card text-6xl font-extrabold text-primary shadow-sm"
            >
              {initials(about.displayName)}
            </div>
          )}
          <Star className="twinkle absolute top-2 right-2 z-20 w-7 text-peach-text/70" />
        </Reveal>
        <div>
          <SectionHeading id="titulo-sobre" eyebrow="Sobre a professora">
            {about.headline}
          </SectionHeading>
          {aboutSource === 'fallback' ? (
            <span className="mb-4 inline-block rounded-full bg-warning-soft px-3 py-0.5 text-xs font-bold text-warning">
              Exemplo — substituir
            </span>
          ) : null}
          {about.paragraphs.length > 0 ? (
            <Reveal className="space-y-4 text-lg text-muted-foreground">
              {about.paragraphs.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </Reveal>
          ) : null}
          <ul className="mt-6 flex flex-wrap gap-2">
            {about.highlights.map((h) => (
              <li
                key={h}
                className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-4 py-1.5 text-sm font-bold text-secondary-foreground"
              >
                <Check className="size-4 text-sage-text" aria-hidden="true" />
                {h}
              </li>
            ))}
          </ul>
          {brand.city ? (
            <p className="mt-4 text-sm text-muted-foreground">{brand.city}</p>
          ) : null}
        </div>
      </div>
      {groups.length > 0 ? (
        <div className="mx-auto mt-12 max-w-6xl px-4 sm:px-6">
          <h3 className="mb-6 text-2xl font-extrabold">Currículo</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            {groups.map((g) => (
              <Reveal
                key={g.title}
                className="rounded-3xl bg-card p-6 shadow-sm ring-1 ring-border"
              >
                <h4 className="flex items-center gap-2 text-lg font-bold">
                  <span className="grid size-9 place-items-center rounded-full bg-lavender text-primary">
                    <g.icon className="size-5" aria-hidden="true" />
                  </span>
                  {g.title}
                </h4>
                <ul className="mt-3 space-y-2 text-muted-foreground">
                  {g.items.map((item, i) => (
                    <li key={i} className="flex gap-2">
                      <span
                        className="mt-2.5 size-1.5 shrink-0 rounded-full bg-peach-text/70"
                        aria-hidden="true"
                      />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </Reveal>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  )
}
