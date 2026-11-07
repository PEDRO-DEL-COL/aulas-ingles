import { Check } from 'lucide-react'

import { Reveal } from '@/components/brand/Reveal'
import { brand, type Plan } from '@/config/brand'
import { formatBRL } from '@/lib/format'
import { cn } from '@/lib/utils'

import { SectionHeading } from './SectionHeading'
import { WhatsAppCta } from './WhatsAppCta'

function priceSuffix(plan: Plan) {
  if (plan.billing === 'monthly') return '/mês'
  if (plan.billing === 'single') return '/aula'
  return 'o pacote'
}

function lessonsPerk(plan: Plan) {
  if (plan.billing === 'monthly') return `${plan.lessons} aulas por mês`
  if (plan.billing === 'package') return `${plan.lessons} aulas no pacote`
  return '1 aula'
}

export function Plans() {
  return (
    <section
      id="planos"
      aria-labelledby="titulo-planos"
      className="scroll-mt-20 py-20 sm:py-28"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading id="titulo-planos" eyebrow="Planos">
          Escolha o jeito que combina com a sua rotina
        </SectionHeading>
        <ul className="grid gap-6 md:grid-cols-3">
          {brand.plans.map((plan, i) => (
            <Reveal
              as="li"
              key={plan.id}
              delay={i * 90}
              className={cn(
                'relative flex flex-col rounded-3xl border bg-card p-7',
                plan.highlight && 'border-primary shadow-lg ring-4 ring-lavender',
              )}
            >
              {plan.highlight ? (
                <span className="absolute -top-3.5 left-6 rounded-full bg-peach px-3.5 py-1 text-xs font-extrabold text-peach-text">
                  Mais escolhido
                </span>
              ) : null}
              <h3 className="text-2xl font-extrabold">{plan.name}</h3>
              <p className="mt-1 text-muted-foreground">{plan.description}</p>
              <p className="mt-6 text-4xl font-extrabold">
                {plan.price === null ? 'A combinar' : formatBRL(plan.price)}
                {plan.price !== null ? (
                  <span className="text-base font-semibold text-muted-foreground">
                    {' '}
                    {priceSuffix(plan)}
                  </span>
                ) : null}
              </p>
              <ul className="mt-5 space-y-2 text-sm">
                {[
                  lessonsPerk(plan),
                  `${plan.durationMinutes} minutos cada, individuais`,
                  ...plan.perks,
                ].map((perk) => (
                  <li key={perk} className="flex items-start gap-2">
                    <Check
                      className="mt-0.5 size-4 shrink-0 text-sage-text"
                      aria-hidden="true"
                    />
                    {perk}
                  </li>
                ))}
              </ul>
              <div className="mt-auto pt-6">
                <WhatsAppCta
                  variant={plan.highlight ? 'default' : 'outline'}
                  className="w-full"
                >
                  Quero este plano
                </WhatsAppCta>
              </div>
            </Reveal>
          ))}
        </ul>
        <p className="mt-6 text-sm text-muted-foreground">
          Pagamento por Pix. Valores de exemplo, sujeitos a confirmação na conversa
          inicial.
        </p>
      </div>
    </section>
  )
}
