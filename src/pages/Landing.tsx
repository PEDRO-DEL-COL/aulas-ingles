import { About } from '@/components/landing/About'
import { Faq } from '@/components/landing/Faq'
import { FinalCta } from '@/components/landing/FinalCta'
import { Hero } from '@/components/landing/Hero'
import { HowItWorks } from '@/components/landing/HowItWorks'
import { Plans } from '@/components/landing/Plans'
import { SiteFooter } from '@/components/landing/SiteFooter'
import { SiteHeader } from '@/components/landing/SiteHeader'
import { Testimonials } from '@/components/landing/Testimonials'
import { WhatsAppFloat } from '@/components/landing/WhatsAppFloat'
import { brand } from '@/config/brand'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'

export default function Landing() {
  useDocumentTitle(undefined, brand.description)
  return (
    <>
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
      >
        Pular para o conteúdo
      </a>
      <SiteHeader />
      <main id="conteudo">
        <Hero />
        <About />
        <HowItWorks />
        <Plans />
        <Testimonials />
        <Faq />
        <FinalCta />
      </main>
      <SiteFooter />
      <WhatsAppFloat />
    </>
  )
}
