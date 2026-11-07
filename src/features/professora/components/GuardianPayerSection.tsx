import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'

import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardTitle } from '@/components/ui/card'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/field'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/features/shared/components/StateViews'
import { useQuery } from '@/lib/data/useQuery'

import {
  deleteGuardian,
  getPayer,
  listGuardians,
  removePayer,
  saveGuardian,
  savePayer,
  type Guardian,
  type Payer,
} from '../api'
import { isValidEmail } from '../validation'
import { ConfirmDialog } from './ConfirmDialog'
import { FormField } from './FormField'

const orNull = (v: string) => (v.trim() === '' ? null : v.trim())

function GuardianDialog({
  studentId,
  guardian,
  onClose,
  onSaved,
}: {
  studentId: string
  guardian: Guardian | null
  onClose: () => void
  onSaved: () => void
}) {
  const [name, setName] = useState(guardian?.guardian_name ?? '')
  const [email, setEmail] = useState(guardian?.guardian_email ?? '')
  const [relationship, setRelationship] = useState(guardian?.relationship ?? '')
  const [financial, setFinancial] = useState(guardian?.is_financial_responsible ?? false)
  const [errors, setErrors] = useState<{ email?: string }>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!isValidEmail(email)) {
      setErrors({ email: 'Informe um e-mail válido para contato.' })
      return
    }
    setErrors({})
    setBusy(true)
    setError(null)
    try {
      await saveGuardian(guardian?.id ?? null, {
        student_id: studentId,
        guardian_email: email.trim().toLowerCase(),
        guardian_name: orNull(name),
        relationship: orNull(relationship),
        is_financial_responsible: financial,
      })
      onSaved()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível salvar.')
      setBusy(false)
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={guardian ? 'Editar responsável' : 'Novo responsável'}
      dismissible={!busy}
    >
      <form onSubmit={(e) => void submit(e)} noValidate className="space-y-3">
        <FormField label="Nome">
          {(p) => (
            <Input
              {...p}
              value={name}
              maxLength={200}
              onChange={(e) => setName(e.target.value)}
            />
          )}
        </FormField>
        <FormField label="E-mail" error={errors.email}>
          {(p) => (
            <Input
              {...p}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          )}
        </FormField>
        <FormField label="Parentesco" help="Ex.: mãe, pai, avó.">
          {(p) => (
            <Input
              {...p}
              value={relationship}
              maxLength={60}
              onChange={(e) => setRelationship(e.target.value)}
            />
          )}
        </FormField>
        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            className="size-5 accent-primary"
            checked={financial}
            onChange={(e) => setFinancial(e.target.checked)}
          />
          Responsável financeiro
        </label>
        {error ? <Alert variant="destructive">{error}</Alert> : null}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? 'Salvando…' : 'Salvar'}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}

function PayerDialog({
  studentId,
  payer,
  onClose,
  onSaved,
}: {
  studentId: string
  payer: Payer | null
  onClose: () => void
  onSaved: () => void
}) {
  const [name, setName] = useState(payer?.name ?? '')
  const [email, setEmail] = useState(payer?.email ?? '')
  const [phone, setPhone] = useState(payer?.phone ?? '')
  const [document, setDocument] = useState(payer?.document ?? '')
  const [errors, setErrors] = useState<{ name?: string; email?: string }>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    const found: { name?: string; email?: string } = {}
    if (name.trim() === '') found.name = 'Informe o nome do pagador.'
    if (email.trim() !== '' && !isValidEmail(email)) found.email = 'E-mail inválido.'
    setErrors(found)
    if (Object.keys(found).length > 0) return
    setBusy(true)
    setError(null)
    try {
      await savePayer(studentId, payer?.id ?? null, {
        name: name.trim(),
        email: email.trim() === '' ? null : email.trim().toLowerCase(),
        phone: orNull(phone),
        document: orNull(document),
      })
      onSaved()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível salvar.')
      setBusy(false)
    }
  }

  return (
    <Dialog open onClose={onClose} title="Pagador" dismissible={!busy}>
      <form onSubmit={(e) => void submit(e)} noValidate className="space-y-3">
        <FormField label="Nome" error={errors.name}>
          {(p) => (
            <Input
              {...p}
              value={name}
              maxLength={200}
              onChange={(e) => setName(e.target.value)}
            />
          )}
        </FormField>
        <FormField label="E-mail (opcional)" error={errors.email}>
          {(p) => (
            <Input
              {...p}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          )}
        </FormField>
        <FormField label="Telefone (opcional)">
          {(p) => (
            <Input
              {...p}
              type="tel"
              value={phone}
              maxLength={30}
              onChange={(e) => setPhone(e.target.value)}
            />
          )}
        </FormField>
        <FormField
          label="CPF/CNPJ (opcional)"
          help="Dado pessoal: preencha só se precisar."
        >
          {(p) => (
            <Input
              {...p}
              value={document}
              maxLength={20}
              onChange={(e) => setDocument(e.target.value)}
            />
          )}
        </FormField>
        {error ? <Alert variant="destructive">{error}</Alert> : null}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? 'Salvando…' : 'Salvar'}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}

/** Responsáveis e pagador são DADOS da ficha: ninguém aqui tem login. */
export function GuardianPayerSection({
  studentId,
  defaultPayerId,
  onStudentChanged,
}: {
  studentId: string
  defaultPayerId: string | null
  /** Recarrega a ficha (o vínculo com o pagador mudou). */
  onStudentChanged: () => void
}) {
  const guardians = useQuery(`prof-resp:${studentId}`, () => listGuardians(studentId))
  const payer = useQuery(`prof-pagador:${defaultPayerId ?? 'nenhum'}`, async () =>
    defaultPayerId ? getPayer(defaultPayerId) : null,
  )
  const [editingG, setEditingG] = useState<Guardian | 'new' | null>(null)
  const [removingG, setRemovingG] = useState<Guardian | null>(null)
  const [editingP, setEditingP] = useState(false)
  const [removingP, setRemovingP] = useState<Payer | null>(null)

  return (
    <>
      <Card>
        <div className="flex items-center justify-between gap-2">
          <CardTitle>Responsáveis</CardTitle>
          <Button size="sm" variant="outline" onClick={() => setEditingG('new')}>
            <Plus aria-hidden="true" />
            Adicionar
          </Button>
        </div>
        <CardDescription>
          Dados de contato. Responsáveis não têm login nem acesso ao sistema.
        </CardDescription>
        {guardians.error ? (
          <ErrorState error={guardians.error} onRetry={guardians.refetch} />
        ) : !guardians.data ? (
          <Skeleton className="h-12 w-full" />
        ) : guardians.data.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum responsável cadastrado.</p>
        ) : (
          <ul className="divide-y">
            {guardians.data.map((g) => (
              <li key={g.id} className="flex items-center justify-between gap-2 py-2">
                <div className="min-w-0 text-sm">
                  <p className="truncate font-semibold">
                    {g.guardian_name || g.guardian_email}{' '}
                    {g.is_financial_responsible ? (
                      <Badge tone="info">Financeiro</Badge>
                    ) : null}
                  </p>
                  <p className="truncate text-muted-foreground">
                    {[g.relationship, g.guardian_name ? g.guardian_email : null]
                      .filter(Boolean)
                      .join(' - ')}
                  </p>
                </div>
                <div className="flex shrink-0">
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`Editar ${g.guardian_name || g.guardian_email}`}
                    onClick={() => setEditingG(g)}
                  >
                    <Pencil aria-hidden="true" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`Excluir ${g.guardian_name || g.guardian_email}`}
                    onClick={() => setRemovingG(g)}
                  >
                    <Trash2 aria-hidden="true" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <div className="flex items-center justify-between gap-2">
          <CardTitle>Pagador</CardTitle>
          {payer.data ? null : (
            <Button size="sm" variant="outline" onClick={() => setEditingP(true)}>
              <Plus aria-hidden="true" />
              Adicionar
            </Button>
          )}
        </div>
        {payer.error ? (
          <ErrorState error={payer.error} onRetry={payer.refetch} />
        ) : payer.loading && payer.data === undefined ? (
          <Skeleton className="h-12 w-full" />
        ) : payer.data ? (
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 text-sm">
              <p className="truncate font-semibold">{payer.data.name}</p>
              <p className="truncate text-muted-foreground">
                {[payer.data.email, payer.data.phone].filter(Boolean).join(' - ')}
              </p>
            </div>
            <div className="flex shrink-0">
              <Button
                size="icon"
                variant="ghost"
                aria-label="Editar pagador"
                onClick={() => setEditingP(true)}
              >
                <Pencil aria-hidden="true" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                aria-label="Remover pagador"
                onClick={() => setRemovingP(payer.data ?? null)}
              >
                <Trash2 aria-hidden="true" />
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Sem pagador cadastrado: o próprio aluno paga.
          </p>
        )}
      </Card>

      {editingG ? (
        <GuardianDialog
          studentId={studentId}
          guardian={editingG === 'new' ? null : editingG}
          onClose={() => setEditingG(null)}
          onSaved={guardians.refetch}
        />
      ) : null}
      {removingG ? (
        <ConfirmDialog
          title="Excluir responsável?"
          description="Os dados de contato deste responsável serão removidos da ficha."
          confirmLabel="Excluir"
          onClose={() => setRemovingG(null)}
          onConfirm={async () => {
            await deleteGuardian(removingG.id)
            guardians.refetch()
          }}
        />
      ) : null}
      {editingP ? (
        <PayerDialog
          studentId={studentId}
          payer={payer.data ?? null}
          onClose={() => setEditingP(false)}
          onSaved={() => {
            payer.refetch()
            onStudentChanged()
          }}
        />
      ) : null}
      {removingP ? (
        <ConfirmDialog
          title="Remover pagador?"
          description="As cobranças antigas ficam sem pagador. O aluno passa a ser o pagador."
          confirmLabel="Remover"
          onClose={() => setRemovingP(null)}
          onConfirm={async () => {
            await removePayer(studentId, removingP.id)
            onStudentChanged()
          }}
        />
      ) : null}
    </>
  )
}
