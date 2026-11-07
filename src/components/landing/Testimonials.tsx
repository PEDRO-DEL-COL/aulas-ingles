import { Quote } from 'lucide-react'

import { Reveal } from '@/components/brand/Reveal'
import { brand } from '@/config/brand'

import { SectionHeading } from './SectionHeading'

export function Testimonials() {
  return (
    <section
      id="depoimentos"
      aria-labelledby="titulo-depoimentos"
      className="scroll-mt-20 bg-lavender/60 py-16 sm:py-24"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading id="titulo-depoimentos" eyebrow="Depoimentos">
          Quem estuda comigo
        </SectionHeading>
        <ul className="grid gap-6 md:grid-cols-3">
          {brand.testimonials.map((t, i) => (
            <Reveal
              as="li"
              key={t.id}
              delay={i * 90}
              className="flex flex-col rounded-3xl bg-card p-6 shadow-sm"
            >
              {t.placeholder ? (
                <span className="mb-3 self-start rounded-full bg-warning-soft px-3 py-0.5 text-xs font-bold text-warning">
                  Exemplo — substituir por depoimento real
                </span>
              ) : null}
              <Quote className="size-6 text-peach-text" aria-hidden="true" />
              <blockquote className="mt-2 flex-1 text-lg">{t.text}</blockquote>
              <p className="mt-4 text-sm">
                <strong>{t.name}</strong>
                <span className="text-muted-foreground"> · {t.role}</span>
              </p>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  )
}
