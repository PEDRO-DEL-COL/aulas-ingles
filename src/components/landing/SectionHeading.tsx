import type { ReactNode } from 'react'

import { Reveal } from '@/components/brand/Reveal'

type Props = { id: string; eyebrow: string; children: ReactNode; center?: boolean }

export function SectionHeading({ id, eyebrow, children, center = false }: Props) {
  return (
    <Reveal
      className={center ? 'mx-auto mb-10 max-w-2xl text-center' : 'mb-10 max-w-2xl'}
    >
      <p className="text-sm font-bold tracking-wider text-primary uppercase">{eyebrow}</p>
      <h2
        id={id}
        className="mt-2 text-3xl leading-tight font-extrabold text-balance sm:text-4xl"
      >
        {children}
      </h2>
    </Reveal>
  )
}
