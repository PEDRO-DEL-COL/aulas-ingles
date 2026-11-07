import { CalendarCheck, ClipboardList, MessageCircle, Video } from 'lucide-react'

import { SectionHeading } from './SectionHeading'

const steps = [
  {
    icon: MessageCircle,
    title: 'Conversa no WhatsApp',
    text: 'Você conta seu objetivo e combinamos o melhor horário.',
  },
  {
    icon: CalendarCheck,
    title: 'Aula experimental',
    text: 'Um primeiro encontro para conhecer seu nível e o jeito de ensinar, sem compromisso.',
  },
  {
    icon: ClipboardList,
    title: 'Plano sob medida',
    text: 'Montamos frequência, conteúdo e metas de acordo com a sua rotina.',
  },
  {
    icon: Video,
    title: 'Aulas ao vivo no Google Meet',
    text: 'Materiais, tarefas e acompanhamento ficam na sua área do aluno.',
  },
]

export function HowItWorks() {
  return (
    <section
      id="como-funciona"
      aria-labelledby="titulo-como"
      className="scroll-mt-20 bg-sand/60 py-16 sm:py-24"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading id="titulo-como" eyebrow="Como funcionam as aulas">
          Do primeiro contato à fluência, em quatro passos
        </SectionHeading>
        <ol className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((s, i) => (
            <li key={s.title} className="relative rounded-2xl border bg-card p-6">
              <span
                aria-hidden="true"
                className="absolute -top-4 right-4 font-serif text-5xl font-semibold text-coral"
              >
                {i + 1}
              </span>
              <s.icon className="size-7 text-primary" aria-hidden="true" />
              <h3 className="mt-4 text-lg font-semibold">{s.title}</h3>
              <p className="mt-2 text-muted-foreground">{s.text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
