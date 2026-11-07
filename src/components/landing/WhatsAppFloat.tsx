import { MessageCircle } from 'lucide-react'

import { brand } from '@/config/brand'

export function WhatsAppFloat() {
  const link = brand.whatsapp.link
  if (!link) return null
  return (
    <a
      href={link}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Falar no WhatsApp (abre em nova aba)"
      className="fixed right-4 bottom-4 z-40 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg ring-4 ring-background transition-transform outline-none hover:scale-105 focus-visible:outline-ring motion-reduce:transition-none motion-reduce:hover:scale-100 md:hidden"
    >
      <MessageCircle className="size-6" aria-hidden="true" />
    </a>
  )
}
