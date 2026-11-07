import { useEffect, useRef, type ElementType, type ReactNode } from 'react'

type Props = {
  as?: ElementType
  className?: string
  /** atraso em ms, para escalonar itens de uma lista */
  delay?: number
  children: ReactNode
}

/**
 * Fade-in ao rolar. Sem JS, sem IntersectionObserver ou com prefers-reduced-motion,
 * o conteúdo simplesmente fica visível (o CSS só esconde sob `no-preference`).
 * Só opacidade/transform: não causa layout shift.
 */
export function Reveal({ as: Tag = 'div', className, delay = 0, children }: Props) {
  const ref = useRef<HTMLElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    el.dataset.reveal = 'hidden'
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          el.dataset.reveal = 'shown'
          io.disconnect()
        }
      },
      { rootMargin: '0px 0px -8% 0px' },
    )
    io.observe(el)
    return () => {
      io.disconnect()
      delete el.dataset.reveal
    }
  }, [])
  return (
    <Tag
      ref={ref}
      className={className}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </Tag>
  )
}
