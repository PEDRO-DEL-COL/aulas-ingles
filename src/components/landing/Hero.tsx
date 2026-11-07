import { Cloud, Star } from '@/components/brand/Decor'
import { Logo } from '@/components/brand/Logo'
import { brand } from '@/config/brand'

import { WhatsAppCta } from './WhatsAppCta'

export function Hero() {
  return (
    <section
      aria-labelledby="titulo-hero"
      className="relative overflow-hidden bg-gradient-to-b from-sky via-lavender/70 to-background"
    >
      <Cloud className="float-slow absolute top-10 -left-8 w-40 text-white/80 sm:left-10 sm:w-56" />
      <Cloud className="float-slower absolute top-[58%] -right-10 w-44 text-white/70 sm:top-24 sm:right-[8%] sm:w-64" />
      <Star className="twinkle absolute top-24 right-8 w-5 text-peach-text/60 sm:top-32 sm:right-[30%] sm:w-7" />
      <Star className="twinkle absolute bottom-24 left-[12%] w-4 text-primary/40 [animation-delay:-2s]" />
      <div className="relative mx-auto max-w-6xl px-4 pt-14 pb-24 sm:px-6 sm:pt-24 sm:pb-32">
        <div className="max-w-2xl">
          <p className="mb-5 inline-flex items-center gap-2 rounded-full bg-card/80 px-4 py-1.5 text-sm font-bold text-primary shadow-sm">
            <Logo size={20} decorative />
            Aulas online pelo Google Meet
          </p>
          <h1
            id="titulo-hero"
            className="text-4xl leading-[1.12] font-extrabold text-balance sm:text-6xl"
          >
            Aprender inglês pode ser <span className="text-primary">leve</span> e{' '}
            <span className="text-peach-text">gostoso</span>.
          </h1>
          <p className="mt-6 max-w-xl text-lg text-muted-foreground">
            {brand.description} Comece com uma aula experimental, sem compromisso.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-4">
            <WhatsAppCta size="lg">Agendar aula experimental</WhatsAppCta>
            <a
              href="#como-funciona"
              className="font-bold text-primary underline underline-offset-4"
            >
              Veja como funciona
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
