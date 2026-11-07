import { brand } from '@/config/brand'

import { WhatsAppCta } from './WhatsAppCta'

export function Hero() {
  return (
    <section aria-labelledby="titulo-hero" className="relative overflow-hidden">
      <div
        aria-hidden="true"
        className="absolute -top-24 -right-24 size-80 rounded-full bg-sand blur-2xl sm:size-[28rem]"
      />
      <div
        aria-hidden="true"
        className="absolute bottom-0 left-[-4rem] size-40 rounded-full bg-coral/20 blur-2xl"
      />
      <div className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        <p className="mb-4 text-sm font-semibold tracking-widest text-coral-text uppercase">
          Aulas online pelo Google Meet
        </p>
        <h1
          id="titulo-hero"
          className="max-w-3xl font-serif text-4xl leading-[1.1] font-semibold sm:text-6xl"
        >
          Fale inglês com{' '}
          <span className="relative inline-block whitespace-nowrap text-primary">
            confiança
            <svg
              aria-hidden="true"
              viewBox="0 0 200 12"
              preserveAspectRatio="none"
              className="draw-underline absolute -bottom-2 left-0 h-3 w-full"
            >
              <path
                d="M2 8 C 40 2, 70 12, 100 6 S 160 2, 198 7"
                pathLength="1"
                fill="none"
                stroke="var(--coral)"
                strokeWidth="3"
                strokeLinecap="round"
              />
            </svg>
          </span>
          , no seu ritmo.
        </h1>
        <p className="mt-6 max-w-xl text-lg text-muted-foreground">
          {brand.description} Comece com uma aula experimental, sem compromisso.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-4">
          <WhatsAppCta size="lg">Agendar aula experimental</WhatsAppCta>
          <a
            href="#como-funciona"
            className="font-medium text-primary underline underline-offset-4"
          >
            Veja como funciona
          </a>
        </div>
      </div>
    </section>
  )
}
