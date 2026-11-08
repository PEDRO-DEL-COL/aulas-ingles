import { ArrowLeft, Sparkles } from 'lucide-react'
import type { ComponentType, ReactNode } from 'react'
import { Link } from 'react-router'

import { Cloud, Star } from '@/components/brand/Decor'
import { Button } from '@/components/ui/button'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'

/** Tela provisória "Em breve" para itens de menu que ainda não existem. */
export function ComingSoon({
  title,
  children,
  icon: Icon = Sparkles,
  backTo,
  backLabel = 'Voltar',
}: {
  title: string
  children?: ReactNode
  icon?: ComponentType<{ className?: string; 'aria-hidden'?: boolean }>
  backTo: string
  backLabel?: string
}) {
  useDocumentTitle(title)
  return (
    <section className="relative mx-auto mt-6 max-w-md overflow-hidden rounded-2xl border bg-lavender p-8 text-center">
      <Cloud className="absolute -top-2 -left-4 h-10 text-card" />
      <Star className="absolute top-5 right-6 size-5 text-primary/30" />
      <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-card text-primary shadow-xs">
        <Icon aria-hidden={true} className="size-8" />
      </div>
      <p className="mt-4 text-xs font-semibold tracking-wide text-primary uppercase">
        Em breve
      </p>
      <h1 className="mt-1 text-2xl font-bold">{title}</h1>
      <div className="mt-2 text-sm text-muted-foreground">
        {children ?? 'Estamos preparando esta tela com carinho.'}
      </div>
      <Button asChild variant="outline" className="mt-6">
        <Link to={backTo}>
          <ArrowLeft aria-hidden={true} />
          {backLabel}
        </Link>
      </Button>
    </section>
  )
}
