import { Cloud, Star } from '@/components/brand/Decor'

import { WhatsAppCta } from './WhatsAppCta'

export function FinalCta() {
  return (
    <section aria-labelledby="titulo-cta" className="px-4 pb-16 sm:px-6 sm:pb-24">
      <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[2rem] bg-primary px-6 py-14 text-center text-primary-foreground sm:px-12">
        <Cloud className="float-slow absolute -top-4 -left-6 w-32 text-white/10" />
        <Cloud className="float-slower absolute -right-6 -bottom-4 w-40 text-white/10" />
        <Star className="twinkle absolute top-8 right-[15%] w-5 text-peach" />
        <div className="relative">
          <h2
            id="titulo-cta"
            className="text-3xl font-extrabold text-balance sm:text-4xl"
          >
            Vamos começar com uma conversa?
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-primary-foreground/90">
            A aula experimental é um bate-papo para entender seus objetivos. Sem
            compromisso.
          </p>
          <div className="mt-8 flex justify-center">
            <WhatsAppCta size="lg" variant="secondary">
              Agendar aula experimental
            </WhatsAppCta>
          </div>
        </div>
      </div>
    </section>
  )
}
