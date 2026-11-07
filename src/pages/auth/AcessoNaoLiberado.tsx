import { Navigate } from 'react-router'

import {
  AuthScreen,
  LoadingScreen,
  ProfileErrorScreen,
  UnconfiguredNotice,
} from '@/components/auth/AuthScreen'
import { PublicSiteProvider } from '@/components/landing/PublicSiteProvider'
import { usePublicSite } from '@/components/landing/usePublicSite'
import { Button } from '@/components/ui/button'
import { isReleased } from '@/lib/auth/access'
import { useAuth } from '@/lib/auth/useAuth'
import { buildWhatsAppLink } from '@/lib/whatsapp'

function AcessoNaoLiberadoScreen() {
  const { whatsappNumber } = usePublicSite()
  const { status, profile, user, profileError, signOut } = useAuth()

  if (status === 'loading') return <LoadingScreen />
  if (status === 'unconfigured') return <UnconfiguredNotice />
  if (status === 'signed_out') return <Navigate to="/login" replace />
  if (profileError) return <ProfileErrorScreen />
  if (isReleased(profile)) return <Navigate to="/app" replace />

  const email = profile?.email || user?.email || ''
  const link = whatsappNumber
    ? buildWhatsAppLink(
        whatsappNumber,
        `Olá! Tentei entrar na área do aluno com o e-mail ${email}, mas meu acesso ainda não foi liberado.`,
      )
    : null

  return (
    <AuthScreen title="Seu acesso ainda não foi liberado">
      <p>
        Você entrou com o e-mail <strong className="break-all">{email}</strong>, mas ele
        ainda não foi liberado. Peça à professora para cadastrar este e-mail Google. Assim
        que ela fizer isso, é só entrar de novo.
      </p>

      <section className="rounded-md bg-muted p-4" aria-labelledby="sem-google">
        <h2 id="sem-google" className="font-semibold">
          Não tenho conta Google
        </h2>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted-foreground">
          <li>
            Acesse{' '}
            <a
              href="https://accounts.google.com/signup"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline underline-offset-4"
            >
              accounts.google.com/signup
            </a>
            .
          </li>
          <li>
            Você pode criar uma Conta Google com o e-mail que já usa, sem criar um Gmail:
            escolha &ldquo;Usar meu endereço de e-mail atual&rdquo;. Se preferir, crie um
            Gmail novo.
          </li>
          <li>Depois, envie esse e-mail para a professora.</li>
        </ol>
      </section>

      <div className="flex flex-col gap-2 sm:flex-row">
        {link ? (
          <Button asChild>
            <a href={link} target="_blank" rel="noopener noreferrer">
              Falar com a professora no WhatsApp
            </a>
          </Button>
        ) : null}
        <Button variant="outline" onClick={() => void signOut()}>
          Sair / Entrar com outra conta
        </Button>
      </div>
    </AuthScreen>
  )
}

export default function AcessoNaoLiberado() {
  return (
    <PublicSiteProvider>
      <AcessoNaoLiberadoScreen />
    </PublicSiteProvider>
  )
}
