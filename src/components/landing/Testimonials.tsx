import { Quote } from 'lucide-react'

import { brand } from '@/config/brand'

import { SectionHeading } from './SectionHeading'

export function Testimonials() {
  return (
    <section
      id="depoimentos"
      aria-labelledby="titulo-depoimentos"
      className="scroll-mt-20 bg-sand/60 py-16 sm:py-24"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading id="titulo-depoimentos" eyebrow="Depoimentos">
          Quem estuda comigo
        </SectionHeading>
        <ul className="grid gap-6 md:grid-cols-3">
          {brand.testimonials.map((t) => (
            <li key={t.id} className="flex flex-col rounded-2xl border bg-card p-6">
              {t.placeholder ? (
                <span className="mb-3 self-start rounded-full border border-coral-text/40 px-2.5 py-0.5 text-xs font-medium text-coral-text">
                  Exemplo — substituir por depoimento real
                </span>
              ) : null}
              <Quote className="size-6 text-coral" aria-hidden="true" />
              <blockquote className="mt-2 flex-1 text-lg">{t.text}</blockquote>
              <p className="mt-4 text-sm">
                <strong>{t.name}</strong>
                <span className="text-muted-foreground"> · {t.role}</span>
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
