import { WhatsAppCta } from './WhatsAppCta'

export function FinalCta() {
  return (
    <section aria-labelledby="titulo-cta" className="px-4 pb-16 sm:px-6 sm:pb-24">
      <div className="mx-auto max-w-6xl rounded-[2rem] bg-primary px-6 py-14 text-center text-primary-foreground sm:px-12">
        <h2 id="titulo-cta" className="font-serif text-3xl font-semibold sm:text-4xl">
          Vamos começar com uma conversa?
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-primary-foreground/85">
          A aula experimental é um bate-papo para entender seus objetivos. Sem
          compromisso.
        </p>
        <div className="mt-8 flex justify-center">
          <WhatsAppCta size="lg" variant="secondary">
            Agendar aula experimental
          </WhatsAppCta>
        </div>
      </div>
    </section>
  )
}
