import { Copy, ExternalLink } from 'lucide-react'
import { useState, type FormEvent, type ReactNode } from 'react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardTitle } from '@/components/ui/card'
import { Input, Select, Textarea } from '@/components/ui/field'
import type { StudentRecord } from '@/features/aluno/lessons'
import { dayKey } from '@/features/shared/datetime'
import { formatBRL } from '@/lib/format'

import { createStudent, updateStudent, type Plan } from '../api'
import {
  GOOGLE_ACCOUNT_STEPS,
  GOOGLE_ACCOUNT_URL,
  googleGuideMessage,
} from '../googleGuide'
import { emptyStudentValues, payloadFromValues, valuesFromStudent } from '../studentForm'
import {
  validateStudentForm,
  type StudentFormErrors,
  type StudentFormValues,
} from '../validation'
import { FormField } from './FormField'

function GoogleHelp({ name }: { name: string }) {
  const [copied, setCopied] = useState<'ok' | 'fail' | null>(null)

  async function copy() {
    try {
      await navigator.clipboard.writeText(googleGuideMessage(name))
      setCopied('ok')
    } catch {
      setCopied('fail')
    }
  }

  return (
    <div className="space-y-2">
      <p>
        Precisa ser o e-mail de uma <strong>conta Google</strong>: um Gmail ou outro
        e-mail que a pessoa já use para criar uma Conta Google. Sem isso o aluno não
        consegue entrar.
      </p>
      <details className="rounded-md border bg-card p-2">
        <summary className="cursor-pointer font-medium text-foreground">
          Como orientar quem não tem conta Google
        </summary>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          {GOOGLE_ACCOUNT_STEPS.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <Button type="button" variant="outline" size="sm" onClick={() => void copy()}>
            <Copy aria-hidden="true" />
            Copiar orientação para o WhatsApp
          </Button>
          <Button asChild variant="ghost" size="sm">
            <a href={GOOGLE_ACCOUNT_URL} target="_blank" rel="noopener noreferrer">
              <ExternalLink aria-hidden="true" />
              Criar conta Google
              <span className="sr-only"> (abre em nova aba)</span>
            </a>
          </Button>
        </div>
        <p role="status" className="mt-1 text-foreground">
          {copied === 'ok' ? 'Texto copiado. Cole no WhatsApp.' : null}
          {copied === 'fail'
            ? 'Não foi possível copiar. Selecione o texto e copie.'
            : null}
        </p>
      </details>
    </div>
  )
}

export function StudentForm({
  student,
  plans,
  timezone,
  initialValues,
  notice,
  onSaved,
}: {
  student: StudentRecord | null
  plans: Plan[]
  timezone: string
  /** Pré-preenchimento de uma ficha nova (ex.: vindo de um interessado). */
  initialValues?: Partial<StudentFormValues>
  /** Aviso mostrado no topo do formulário. */
  notice?: ReactNode
  onSaved: (saved: StudentRecord) => void
}) {
  const [values, setValues] = useState<StudentFormValues>(() =>
    student
      ? valuesFromStudent(student, timezone)
      : { ...emptyStudentValues(), ...initialValues },
  )
  const [errors, setErrors] = useState<StudentFormErrors>({})
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  const set = <K extends keyof StudentFormValues>(key: K, value: StudentFormValues[K]) =>
    setValues((v) => ({ ...v, [key]: value }))

  const planKnown = values.plan_id === '' || plans.some((p) => p.id === values.plan_id)

  async function submit(e: FormEvent) {
    e.preventDefault()
    const found = validateStudentForm(values, dayKey(new Date(), timezone))
    setErrors(found)
    if (Object.keys(found).length > 0) {
      setMessage({ ok: false, text: 'Confira os campos destacados.' })
      return
    }
    setBusy(true)
    setMessage(null)
    try {
      const payload = payloadFromValues(values, student, timezone)
      const saved = student
        ? await updateStudent(student.id, payload)
        : await createStudent(payload)
      setMessage({ ok: true, text: 'Ficha salva.' })
      onSaved(saved)
    } catch (err) {
      setMessage({
        ok: false,
        text: err instanceof Error ? err.message : 'Não foi possível salvar.',
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={(e) => void submit(e)} noValidate className="space-y-4">
      {notice ? (
        <Alert>
          <AlertDescription>{notice}</AlertDescription>
        </Alert>
      ) : null}
      <Card>
        <CardTitle>Dados do aluno</CardTitle>
        {student ? (
          <p>
            {student.profile_id ? (
              <Badge tone="success">Login vinculado</Badge>
            ) : (
              <Badge tone="warning">Aguardando primeiro login</Badge>
            )}
          </p>
        ) : null}
        <FormField label="Nome completo" error={errors.full_name}>
          {(p) => (
            <Input
              {...p}
              value={values.full_name}
              maxLength={200}
              autoComplete="off"
              onChange={(e) => set('full_name', e.target.value)}
            />
          )}
        </FormField>
        <FormField
          label="E-mail da conta Google"
          error={errors.email}
          help={<GoogleHelp name={values.full_name} />}
        >
          {(p) => (
            <Input
              {...p}
              type="email"
              inputMode="email"
              value={values.email}
              autoComplete="off"
              onChange={(e) => set('email', e.target.value)}
            />
          )}
        </FormField>
        <FormField label="Telefone / WhatsApp" error={errors.phone}>
          {(p) => (
            <Input
              {...p}
              type="tel"
              inputMode="tel"
              value={values.phone}
              placeholder="(11) 91234-5678"
              onChange={(e) => set('phone', e.target.value)}
            />
          )}
        </FormField>
        <FormField label="Data de nascimento" error={errors.birth_date}>
          {(p) => (
            <Input
              {...p}
              type="date"
              value={values.birth_date}
              onChange={(e) => set('birth_date', e.target.value)}
            />
          )}
        </FormField>
        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            className="size-5 accent-primary"
            checked={values.is_minor}
            onChange={(e) => set('is_minor', e.target.checked)}
          />
          Aluno menor de idade
        </label>
      </Card>

      {values.is_minor ? (
        <Card>
          <CardTitle>Consentimento do responsável</CardTitle>
          <p className="text-sm text-muted-foreground">
            O responsável não tem login: o consentimento é registrado por você aqui.
          </p>
          <FormField label="Nome de quem consentiu" error={errors.guardian_consent_name}>
            {(p) => (
              <Input
                {...p}
                value={values.guardian_consent_name}
                maxLength={200}
                onChange={(e) => set('guardian_consent_name', e.target.value)}
              />
            )}
          </FormField>
          <FormField label="Data do consentimento" error={errors.consent_date}>
            {(p) => (
              <Input
                {...p}
                type="date"
                value={values.consent_date}
                onChange={(e) => set('consent_date', e.target.value)}
              />
            )}
          </FormField>
          <FormField
            label="Observações do consentimento"
            error={errors.guardian_consent_notes}
          >
            {(p) => (
              <Textarea
                {...p}
                value={values.guardian_consent_notes}
                maxLength={2000}
                onChange={(e) => set('guardian_consent_notes', e.target.value)}
              />
            )}
          </FormField>
        </Card>
      ) : null}

      <Card>
        <CardTitle>Aulas</CardTitle>
        <FormField label="Nível" error={errors.level}>
          {(p) => (
            <Input
              {...p}
              value={values.level}
              maxLength={40}
              placeholder="Ex.: A2, intermediário"
              onChange={(e) => set('level', e.target.value)}
            />
          )}
        </FormField>
        <FormField label="Objetivo" error={errors.goal}>
          {(p) => (
            <Textarea
              {...p}
              value={values.goal}
              maxLength={1000}
              onChange={(e) => set('goal', e.target.value)}
            />
          )}
        </FormField>
        <FormField
          label="Plano"
          help="Os planos e valores são definidos pelo administrador."
        >
          {(p) => (
            <Select
              {...p}
              value={values.plan_id}
              onChange={(e) => set('plan_id', e.target.value)}
            >
              <option value="">Sem plano</option>
              {!planKnown ? (
                <option value={values.plan_id}>Plano atual (inativo)</option>
              ) : null}
              {plans.map((pl) => (
                <option key={pl.id} value={pl.id}>
                  {pl.name} - {formatBRL(pl.price_cents / 100)}
                </option>
              ))}
            </Select>
          )}
        </FormField>
        <FormField
          label="Link do Google Meet"
          error={errors.meet_link}
          help="Link fixo das aulas deste aluno, ex.: https://meet.google.com/abc-defg-hij"
        >
          {(p) => (
            <Input
              {...p}
              type="url"
              inputMode="url"
              value={values.meet_link}
              onChange={(e) => set('meet_link', e.target.value)}
            />
          )}
        </FormField>
        <FormField
          label="Situação"
          help="Para encerrar o vínculo use 'Saiu': fichas não são excluídas."
        >
          {(p) => (
            <Select
              {...p}
              value={values.status}
              onChange={(e) =>
                set('status', e.target.value as StudentFormValues['status'])
              }
            >
              <option value="ativo">Ativo</option>
              <option value="pausado">Pausado</option>
              <option value="saiu">Saiu</option>
            </Select>
          )}
        </FormField>
        <FormField
          label="Observações visíveis ao aluno"
          error={errors.notes_public}
          help="O aluno vê este texto na área dele."
        >
          {(p) => (
            <Textarea
              {...p}
              value={values.notes_public}
              maxLength={4000}
              onChange={(e) => set('notes_public', e.target.value)}
            />
          )}
        </FormField>
      </Card>

      {message ? (
        <Alert variant={message.ok ? 'success' : 'destructive'}>
          <AlertDescription>{message.text}</AlertDescription>
        </Alert>
      ) : null}
      <Button type="submit" disabled={busy} className="w-full sm:w-auto">
        {busy ? 'Salvando…' : student ? 'Salvar ficha' : 'Cadastrar aluno'}
      </Button>
    </form>
  )
}
