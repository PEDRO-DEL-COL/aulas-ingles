import { CalendarCheck, ClipboardList, MessageCircle, Video } from 'lucide-react'

import { Wave } from '@/components/brand/Decor'
import { Reveal } from '@/components/brand/Reveal'
import { cn } from '@/lib/utils'

import { SectionHeading } from './SectionHeading'

const steps = [
  {
    icon: MessageCircle,
    title: 'Conversa no WhatsApp',
    text: 'Você conta seu objetivo e combinamos o melhor horário.',
    tone: 'bg-lavender text-primary',
  },
  {
    icon: CalendarCheck,
    title: 'Aula experimental',
    text: 'Um primeiro encontro para conhecer seu nível e o jeito de ensinar, sem compromisso.',
    tone: 'bg-peach text-peach-text',
  },
  {
    icon: ClipboardList,
    title: 'Plano sob medida',
    text: 'Montamos frequência, conteúdo e metas de acordo com a sua rotina.',
    tone: 'bg-secondary text-sage-text',
  },
  {
    icon: Video,
    title: 'Aulas ao vivo no Google Meet',
    text: 'Aulas individuais. Materiais, tarefas e acompanhamento ficam na sua área do aluno.',
    tone: 'bg-sky text-primary',
  },
]

export function HowItWorks() {
  return (
    <section
      id="como-funciona"
      aria-labelledby="titulo-como"
      className="relative scroll-mt-20 bg-sky/60 pt-16 pb-20 sm:pt-24 sm:pb-28"
    >
      <Wave className="absolute inset-x-0 top-0 h-6 w-full -translate-y-[calc(100%-1px)] text-sky/60 sm:h-10" />
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading id="titulo-como" eyebrow="Como funcionam as aulas">
          Do primeiro contato à fluência, em quatro passos
        </SectionHeading>
        <ol className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((s, i) => (
            <Reveal
              as="li"
              key={s.title}
              delay={i * 90}
              className="rounded-3xl bg-card p-6 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <span
                  className={cn(
                    'flex size-12 items-center justify-center rounded-2xl',
                    s.tone,
                  )}
                >
                  <s.icon className="size-6" aria-hidden="true" />
                </span>
                <span aria-hidden="true" className="text-3xl font-extrabold text-border">
                  {i + 1}
                </span>
              </div>
              <h3 className="mt-4 text-lg font-extrabold">{s.title}</h3>
              <p className="mt-2 text-muted-foreground">{s.text}</p>
            </Reveal>
          ))}
        </ol>
      </div>
      <Wave className="absolute inset-x-0 bottom-0 h-6 w-full translate-y-[calc(100%-1px)] -scale-y-100 text-sky/60 sm:h-10" />
    </section>
  )
}
