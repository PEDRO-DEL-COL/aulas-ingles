import type { ReactNode } from 'react'

type Props = { id: string; eyebrow: string; children: ReactNode }

export function SectionHeading({ id, eyebrow, children }: Props) {
  return (
    <div className="mb-10 max-w-2xl">
      <p className="text-sm font-semibold tracking-widest text-coral-text uppercase">
        {eyebrow}
      </p>
      <h2
        id={id}
        className="mt-2 font-serif text-3xl leading-tight font-semibold sm:text-4xl"
      >
        {children}
      </h2>
    </div>
  )
}
