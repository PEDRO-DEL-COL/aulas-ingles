import { Check } from 'lucide-react'

import { Blob, Star } from '@/components/brand/Decor'
import { Reveal } from '@/components/brand/Reveal'
import { brand } from '@/config/brand'

import { SectionHeading } from './SectionHeading'

function initials(name: string) {
  const parts = name.replace(/[[\]]/g, '').split(/\s+/).filter(Boolean)
  const first = parts[0]?.[0] ?? ''
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : ''
  return (first + last).toUpperCase()
}

export function About() {
  const { about, teacherName, city } = brand
  return (
    <section
      id="sobre"
      aria-labelledby="titulo-sobre"
      className="scroll-mt-20 py-16 sm:py-24"
    >
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 sm:px-6 md:grid-cols-[auto_1fr] md:gap-16">
        {/* PLACEHOLDER de foto: trocar por <img> da professora quando houver */}
        <Reveal className="relative mx-auto size-56 sm:size-72">
          <Blob className="float-slower absolute inset-0 size-full text-peach" />
          <Blob className="absolute -inset-3 size-[calc(100%+1.5rem)] rotate-90 text-lavender" />
          <div
            role="img"
            aria-label={`Foto de ${teacherName} (em breve)`}
            className="absolute inset-6 z-10 flex items-center justify-center rounded-full bg-card text-6xl font-extrabold text-primary shadow-sm"
          >
            {initials(teacherName)}
          </div>
          <Star className="twinkle absolute top-2 right-2 z-20 w-7 text-peach-text/70" />
        </Reveal>
        <div>
          <SectionHeading id="titulo-sobre" eyebrow="Sobre a professora">
            {about.headline}
          </SectionHeading>
          <Reveal className="space-y-4 text-lg text-muted-foreground">
            {about.paragraphs.map((p) => (
              <p key={p}>{p}</p>
            ))}
          </Reveal>
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
          {city ? <p className="mt-4 text-sm text-muted-foreground">{city}</p> : null}
        </div>
      </div>
    </section>
  )
}
