import { Link } from 'react-router'

import { Logo } from '@/components/brand/Logo'
import { Button } from '@/components/ui/button'
import { brand } from '@/config/brand'

import { WhatsAppCta } from './WhatsAppCta'

const links = [
  { href: '#sobre', label: 'Sobre' },
  { href: '#como-funciona', label: 'Como funciona' },
  { href: '#planos', label: 'Planos' },
  { href: '#faq', label: 'Dúvidas' },
]

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-border/70 bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2.5 text-lg font-extrabold">
          <Logo size={34} decorative />
          <span className="max-w-[9.5rem] leading-tight sm:max-w-none">{brand.name}</span>
        </Link>
        <nav
          aria-label="Seções da página"
          className="hidden items-center gap-6 text-sm font-semibold md:flex"
        >
          {links.map((l) => (
            <a key={l.href} href={l.href} className="hover:text-primary hover:underline">
              {l.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm" className="rounded-full font-bold">
            <Link to="/login">Entrar</Link>
          </Button>
          <WhatsAppCta size="sm" className="hidden px-4 text-sm sm:inline-flex">
            Fale comigo
          </WhatsAppCta>
        </div>
      </div>
    </header>
  )
}
