import { CircleAlert, PartyPopper } from 'lucide-react'
import { useId, useState, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router'

import { Reveal } from '@/components/brand/Reveal'
import { Button } from '@/components/ui/button'
import { Input, Label, Textarea } from '@/components/ui/field'
import {
  isHoneypotTriggered,
  LEAD_LIMITS,
  submitLead,
  validateLead,
  type LeadErrors,
} from '@/lib/leads'

import { SectionHeading } from './SectionHeading'
import { usePublicSite } from './usePublicSite'
import { WhatsAppCta } from './WhatsAppCta'

type Status = 'idle' | 'sending' | 'done' | 'error'

function Field({
  id,
  label,
  error,
  hint,
  children,
}: {
  id: string
  label: string
  error?: string
  hint?: string
  children: ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint ? (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="text-xs font-medium text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  )
}

export function LeadForm() {
  const uid = useId()
  const ids = {
    name: `${uid}-name`,
    contact: `${uid}-contact`,
    message: `${uid}-message`,
    consent: `${uid}-consent`,
  }
  const [mountedAt] = useState(() => Date.now())
  const [name, setName] = useState('')
  const [contact, setContact] = useState('')
  const [message, setMessage] = useState('')
  const [consent, setConsent] = useState(false)
  const [honeypot, setHoneypot] = useState('')
  const [errors, setErrors] = useState<LeadErrors>({})
  const [status, setStatus] = useState<Status>('idle')
  const [serverError, setServerError] = useState('')
  const hasWhatsApp = usePublicSite().whatsappLink !== null

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (status === 'sending') return
    const input = { name, contact, message, consent }
    const found = validateLead(input)
    setErrors(found)
    if (Object.keys(found).length > 0) return
    // Robô: finge sucesso e não envia.
    if (isHoneypotTriggered(honeypot, mountedAt, Date.now())) {
      setStatus('done')
      return
    }
    setStatus('sending')
    setServerError('')
    const result = await submitLead(input)
    if (result.ok) setStatus('done')
    else {
      setServerError(result.error)
      setStatus('error')
    }
  }

  const describe = (key: keyof LeadErrors, hint = false) =>
    [hint ? `${ids[key]}-hint` : '', errors[key] ? `${ids[key]}-error` : '']
      .filter(Boolean)
      .join(' ') || undefined

  return (
    <section
      id="aula-experimental"
      aria-labelledby="titulo-lead"
      className="scroll-mt-20 px-4 pb-16 sm:px-6 sm:pb-24"
    >
      <div className="mx-auto max-w-2xl">
        <SectionHeading id="titulo-lead" eyebrow="Aula experimental" center>
          Quero uma aula experimental
        </SectionHeading>
        <Reveal>
          {status === 'done' ? (
            <div
              role="status"
              className="space-y-4 rounded-3xl border bg-card p-6 text-center shadow-sm sm:p-8"
            >
              <PartyPopper aria-hidden="true" className="mx-auto size-10 text-primary" />
              <p className="text-xl font-bold">Recebemos o seu contato!</p>
              <p className="text-muted-foreground">
                Obrigada pelo interesse. A professora vai te chamar no WhatsApp em breve
                para combinar a conversa.
              </p>
              {hasWhatsApp ? (
                <div className="flex justify-center">
                  <WhatsAppCta variant="outline">Prefiro chamar agora</WhatsAppCta>
                </div>
              ) : null}
            </div>
          ) : (
            <form
              onSubmit={(e) => void onSubmit(e)}
              noValidate
              className="relative space-y-4 rounded-3xl border bg-card p-6 shadow-sm sm:p-8"
            >
              <p className="text-muted-foreground">
                Deixe seu contato e a professora responde pelo WhatsApp. Sem compromisso.
              </p>
              <Field id={ids.name} label="Seu nome" error={errors.name}>
                <Input
                  id={ids.name}
                  value={name}
                  maxLength={LEAD_LIMITS.name}
                  autoComplete="name"
                  aria-invalid={errors.name ? true : undefined}
                  aria-describedby={describe('name')}
                  onChange={(e) => setName(e.target.value)}
                />
              </Field>
              <Field
                id={ids.contact}
                label="Seu WhatsApp"
                error={errors.contact}
                hint="Com DDD, ex.: (11) 91234-5678"
              >
                <Input
                  id={ids.contact}
                  type="tel"
                  inputMode="tel"
                  value={contact}
                  maxLength={30}
                  autoComplete="tel"
                  aria-invalid={errors.contact ? true : undefined}
                  aria-describedby={describe('contact', true)}
                  onChange={(e) => setContact(e.target.value)}
                />
              </Field>
              <Field
                id={ids.message}
                label="Mensagem (opcional)"
                error={errors.message}
                hint={`${message.length}/${LEAD_LIMITS.message} caracteres`}
              >
                <Textarea
                  id={ids.message}
                  value={message}
                  aria-invalid={errors.message ? true : undefined}
                  aria-describedby={describe('message', true)}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Conte seu objetivo ou o melhor horário para você."
                />
              </Field>

              {/* Honeypot: escondido de quem vê e de leitores de tela. */}
              <div
                aria-hidden="true"
                className="absolute -left-[9999px] h-0 w-0 overflow-hidden"
              >
                <label>
                  Não preencha este campo
                  <input
                    type="text"
                    name="website"
                    tabIndex={-1}
                    autoComplete="off"
                    value={honeypot}
                    onChange={(e) => setHoneypot(e.target.value)}
                  />
                </label>
              </div>

              <div className="space-y-1.5">
                <label htmlFor={ids.consent} className="flex items-start gap-3 text-sm">
                  <input
                    id={ids.consent}
                    type="checkbox"
                    className="mt-0.5 size-5 shrink-0 accent-primary"
                    checked={consent}
                    aria-invalid={errors.consent ? true : undefined}
                    aria-describedby={describe('consent')}
                    onChange={(e) => setConsent(e.target.checked)}
                  />
                  <span>
                    Concordo em ser contatado(a) pelo WhatsApp e com a{' '}
                    <Link
                      to="/privacidade"
                      target="_blank"
                      className="font-medium text-primary underline underline-offset-4"
                    >
                      política de privacidade
                    </Link>
                    .
                  </span>
                </label>
                {errors.consent ? (
                  <p
                    id={`${ids.consent}-error`}
                    className="text-xs font-medium text-destructive"
                  >
                    {errors.consent}
                  </p>
                ) : null}
              </div>

              {status === 'error' ? (
                <p
                  role="alert"
                  className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
                >
                  <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                  {serverError}
                </p>
              ) : null}

              <Button
                type="submit"
                size="lg"
                disabled={status === 'sending'}
                className="w-full rounded-full text-base font-bold"
              >
                {status === 'sending' ? 'Enviando…' : 'Quero minha aula experimental'}
              </Button>
              {status === 'error' && hasWhatsApp ? (
                <div className="flex justify-center">
                  <WhatsAppCta variant="outline">Chamar no WhatsApp</WhatsAppCta>
                </div>
              ) : null}
            </form>
          )}
        </Reveal>
      </div>
    </section>
  )
}
