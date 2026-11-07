import { MessageCircle } from 'lucide-react'
import type { ComponentProps, ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import { brand } from '@/config/brand'
import { cn } from '@/lib/utils'

type Props = {
  children: ReactNode
  variant?: ComponentProps<typeof Button>['variant']
  size?: ComponentProps<typeof Button>['size']
  className?: string
}

/** Botão que abre o WhatsApp com mensagem pronta. Some se o número não estiver configurado. */
export function WhatsAppCta({ children, variant, size, className }: Props) {
  const link = brand.whatsapp.link
  if (!link) return null
  return (
    <Button
      asChild
      variant={variant}
      size={size}
      className={cn('rounded-full px-6 text-base font-bold', className)}
    >
      <a href={link} target="_blank" rel="noopener noreferrer">
        <MessageCircle aria-hidden="true" />
        {children}
        <span className="sr-only"> (abre o WhatsApp em nova aba)</span>
      </a>
    </Button>
  )
}
