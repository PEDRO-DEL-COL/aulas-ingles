import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'

import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardTitle } from '@/components/ui/card'
import { Input, Label, Select } from '@/components/ui/field'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useAuth } from '@/lib/auth/useAuth'
import { useQuery } from '@/lib/data/useQuery'
import { getPlan, getSettings, updateMyProfile } from '@/features/aluno/api'
import { useAluno } from '@/features/aluno/AlunoContext'
import { PageHeader } from '@/features/shared/components/StateViews'
import { brand } from '@/config/brand'
import { formatBRL } from '@/lib/format'
import { buildWhatsAppLink } from '@/lib/whatsapp'
import {
  formatDateTime,
  safeTimezone,
  TIMEZONE_OPTIONS,
} from '@/features/shared/datetime'

const SAVED_KEY = 'aluno:perfil-salvo'

function takeSavedFlag(): boolean {
  try {
    const saved = sessionStorage.getItem(SAVED_KEY) === '1'
    sessionStorage.removeItem(SAVED_KEY)
    return saved
  } catch {
    return false
  }
}

function ReadOnly({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="text-sm">{value || '—'}</dd>
    </div>
  )
}

export default function Perfil() {
  useDocumentTitle('Meu perfil')
  const { profile, refreshProfile, signOut } = useAuth()
  const { student, timezone } = useAluno()
  const plan = useQuery(`plano:${student.plan_id ?? 'nenhum'}`, async () =>
    student.plan_id ? getPlan(student.plan_id) : null,
  )

  const settings = useQuery('settings:perfil', getSettings)
  const whatsappNumber = settings.data?.whatsapp_number || brand.whatsapp.number
  const whatsappLink = whatsappNumber
    ? buildWhatsAppLink(
        whatsappNumber,
        `Olá! Sou aluno(a) e gostaria de falar com você. (${profile?.full_name ?? ''})`,
      )
    : null

  const [phone, setPhone] = useState(profile?.phone ?? '')
  const [tz, setTz] = useState(timezone)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved] = useState(takeSavedFlag)

  if (!profile) return null

  const tzOptions = TIMEZONE_OPTIONS.some((o) => o.value === tz)
    ? TIMEZONE_OPTIONS
    : [...TIMEZONE_OPTIONS, { value: tz, label: tz }]

  async function save(e: FormEvent) {
    e.preventDefault()
    if (!profile) return
    setBusy(true)
    setError(null)
    try {
      await updateMyProfile(profile.id, {
        phone: phone.trim() === '' ? null : phone.trim(),
        timezone: safeTimezone(tz),
      })
      try {
        sessionStorage.setItem(SAVED_KEY, '1')
      } catch {
        /* sem armazenamento: só não mostra o aviso */
      }
      // Recarrega o perfil (a tela pode piscar enquanto o acesso é revalidado).
      await refreshProfile()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível salvar o perfil.')
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Meu perfil" />
      {saved ? <Alert variant="success">Perfil salvo.</Alert> : null}

      <Card>
        <CardTitle>Seus dados</CardTitle>
        <form onSubmit={(e) => void save(e)} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="p-nome">Nome</Label>
            <Input id="p-nome" value={profile.full_name} readOnly />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="p-email">E-mail</Label>
            <Input id="p-email" value={profile.email} readOnly />
            <p className="text-xs text-muted-foreground">
              O e-mail e o nome só podem ser alterados pela professora.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="p-tel">Telefone</Label>
            <Input
              id="p-tel"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              maxLength={30}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="p-tz">Fuso horário</Label>
            <Select id="p-tz" value={tz} onChange={(e) => setTz(e.target.value)}>
              {tzOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
            <p className="text-xs text-muted-foreground">
              Os horários das aulas aparecem neste fuso.
            </p>
          </div>
          {error ? <Alert variant="destructive">{error}</Alert> : null}
          <Button type="submit" disabled={busy}>
            {busy ? 'Salvando…' : 'Salvar alterações'}
          </Button>
        </form>
      </Card>

      <Card>
        <CardTitle>Sua ficha</CardTitle>
        <dl className="grid grid-cols-2 gap-3">
          <ReadOnly label="Nível" value={student.level} />
          <ReadOnly
            label="Plano"
            value={
              plan.data
                ? `${plan.data.name} · ${formatBRL(plan.data.price_cents / 100)}`
                : plan.loading
                  ? 'Carregando…'
                  : null
            }
          />
          <div className="col-span-2">
            <ReadOnly label="Objetivo" value={student.goal} />
          </div>
        </dl>
      </Card>

      {whatsappLink ? (
        <Card>
          <CardTitle>Falar com a professora</CardTitle>
          <p className="text-sm text-muted-foreground">
            Dúvidas ou recados? Chame a professora no WhatsApp.
          </p>
          <Button asChild className="self-start">
            <a href={whatsappLink} target="_blank" rel="noopener noreferrer">
              Abrir WhatsApp
              <span className="sr-only"> (abre em nova aba)</span>
            </a>
          </Button>
        </Card>
      ) : null}

      <Card>
        <CardTitle>Termos e privacidade</CardTitle>
        <p className="text-sm text-muted-foreground">
          {profile.terms_accepted_at
            ? `Aceito em ${formatDateTime(profile.terms_accepted_at, timezone)} (versão ${profile.terms_version ?? '—'}).`
            : 'Termos ainda não aceitos.'}
        </p>
        <Link
          to="/privacidade"
          className="self-start text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          Ler privacidade e termos
        </Link>
      </Card>

      <Button
        variant="outline"
        className="w-full sm:w-auto"
        onClick={() => void signOut()}
      >
        Sair
      </Button>
    </div>
  )
}
