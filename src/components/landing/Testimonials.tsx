import { Quote, Star } from 'lucide-react'

import { Reveal } from '@/components/brand/Reveal'
import { cn } from '@/lib/utils'

import { SectionHeading } from './SectionHeading'
import { usePublicSite } from './usePublicSite'

function Stars({ rating }: { rating: number }) {
  return (
    <p className="mt-3 flex items-center gap-0.5">
      <span className="sr-only">Nota {rating} de 5</span>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          aria-hidden="true"
          className={cn(
            'size-5',
            n <= rating ? 'fill-peach-text text-peach-text' : 'text-border',
          )}
        />
      ))}
    </p>
  )
}

export function Testimonials() {
  const { testimonials } = usePublicSite()
  if (testimonials.length === 0) return null
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
        <ul className="flex flex-wrap justify-center gap-6">
          {testimonials.map((t, i) => (
            <Reveal
              as="li"
              key={t.id}
              delay={(i % 6) * 90}
              className="flex w-full flex-col rounded-3xl bg-card p-6 shadow-sm md:w-[calc((100%-1.5rem)/2)] lg:w-[calc((100%-3rem)/3)]"
            >
              {t.placeholder ? (
                <span className="mb-3 self-start rounded-full bg-warning-soft px-3 py-0.5 text-xs font-bold text-warning">
                  Exemplo — substituir por depoimento real
                </span>
              ) : null}
              <Quote className="size-6 text-peach-text" aria-hidden="true" />
              {t.rating ? <Stars rating={t.rating} /> : null}
              <blockquote className="mt-2 flex-1 text-lg">{t.text}</blockquote>
              <p className="mt-4 text-sm">
                <strong>{t.name}</strong>
                {t.context ? (
                  <span className="block text-muted-foreground">{t.context}</span>
                ) : null}
              </p>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  )
}
