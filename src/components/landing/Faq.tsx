import { ChevronDown } from 'lucide-react'

import { Reveal } from '@/components/brand/Reveal'
import { brand } from '@/config/brand'

import { SectionHeading } from './SectionHeading'

export function Faq() {
  return (
    <section
      id="faq"
      aria-labelledby="titulo-faq"
      className="scroll-mt-20 py-16 sm:py-24"
    >
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <SectionHeading id="titulo-faq" eyebrow="Perguntas frequentes">
          Ficou com dúvida?
        </SectionHeading>
        <Reveal className="space-y-3">
          {brand.faq.map((item) => (
            <details key={item.question} className="group rounded-2xl bg-card shadow-sm">
              <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 rounded-2xl p-5 text-lg font-bold [&::-webkit-details-marker]:hidden">
                {item.question}
                <ChevronDown
                  className="size-5 shrink-0 text-primary transition-transform group-open:rotate-180 motion-reduce:transition-none"
                  aria-hidden="true"
                />
              </summary>
              <p className="px-5 pb-5 text-muted-foreground">{item.answer}</p>
            </details>
          ))}
        </Reveal>
      </div>
    </section>
  )
}
