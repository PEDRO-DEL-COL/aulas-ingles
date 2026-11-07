import { Check } from 'lucide-react'

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
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 sm:px-6 md:grid-cols-[auto_1fr]">
        {/* PLACEHOLDER de foto: trocar por <img> da professora quando houver */}
        <div className="relative mx-auto">
          <div
            role="img"
            aria-label={`Foto de ${teacherName} (em breve)`}
            className="relative z-10 flex size-48 items-center justify-center rounded-[2.5rem] bg-primary font-serif text-6xl text-primary-foreground sm:size-64"
          >
            {initials(teacherName)}
          </div>
          <span
            aria-hidden="true"
            className="absolute top-3 left-3 size-full rounded-[2.5rem] bg-coral"
          />
        </div>
        <div>
          <SectionHeading id="titulo-sobre" eyebrow="Sobre a professora">
            {about.headline}
          </SectionHeading>
          <div className="space-y-4 text-lg text-muted-foreground">
            {about.paragraphs.map((p) => (
              <p key={p}>{p}</p>
            ))}
          </div>
          <ul className="mt-6 flex flex-wrap gap-2">
            {about.highlights.map((h) => (
              <li
                key={h}
                className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1 text-sm"
              >
                <Check className="size-4 text-primary" aria-hidden="true" />
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
