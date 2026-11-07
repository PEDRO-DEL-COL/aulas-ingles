import { Check } from 'lucide-react'

import { brand } from '@/config/brand'
import { formatBRL } from '@/lib/format'
import { cn } from '@/lib/utils'

import { SectionHeading } from './SectionHeading'
import { WhatsAppCta } from './WhatsAppCta'

export function Plans() {
  return (
    <section
      id="planos"
      aria-labelledby="titulo-planos"
      className="scroll-mt-20 py-16 sm:py-24"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading id="titulo-planos" eyebrow="Planos">
          Escolha o ritmo que combina com você
        </SectionHeading>
        <ul className="grid gap-6 md:grid-cols-3">
          {brand.plans.map((plan) => (
            <li
              key={plan.id}
              className={cn(
                'relative flex flex-col rounded-3xl border bg-card p-7',
                plan.highlight && 'border-primary shadow-lg ring-2 ring-primary/20',
              )}
            >
              {plan.highlight ? (
                <span className="absolute -top-3 left-6 rounded-full bg-coral px-3 py-0.5 text-xs font-semibold text-foreground">
                  Mais escolhido
                </span>
              ) : null}
              <h3 className="font-serif text-2xl font-semibold">{plan.name}</h3>
              <p className="mt-1 text-muted-foreground">{plan.description}</p>
              <p className="mt-6 font-serif text-4xl font-semibold">
                {plan.price === null ? 'A combinar' : formatBRL(plan.price)}
                {plan.price !== null ? (
                  <span className="text-base font-normal text-muted-foreground">
                    {' '}
                    /mês
                  </span>
                ) : null}
              </p>
              {plan.lessonsPerMonth > 0 ? (
                <ul className="mt-5 space-y-2 text-sm">
                  <li className="flex items-center gap-2">
                    <Check className="size-4 text-primary" aria-hidden="true" />
                    {plan.lessonsPerMonth} aulas por mês
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="size-4 text-primary" aria-hidden="true" />
                    {plan.durationMinutes} minutos cada
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="size-4 text-primary" aria-hidden="true" />
                    Área do aluno com materiais
                  </li>
                </ul>
              ) : null}
              <div className="mt-auto pt-6">
                <WhatsAppCta
                  variant={plan.highlight ? 'default' : 'outline'}
                  className="w-full"
                >
                  Quero este plano
                </WhatsAppCta>
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-6 text-sm text-muted-foreground">
          Pagamento por Pix. Valores sujeitos a confirmação na conversa inicial.
        </p>
      </div>
    </section>
  )
}
