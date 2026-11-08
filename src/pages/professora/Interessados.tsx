import { MessageCircle, UserPlus } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input, Label, Textarea } from '@/components/ui/field'
import {
  LEAD_FILTERS,
  LEAD_STATUS_LABEL,
  NOTES_MAX,
  filterLeads,
  leadWhatsAppLink,
  validateLeadNotes,
  type Lead,
  type LeadFilter,
  type LeadStatus,
} from '@/features/professora/leads'
import {
  listLeads,
  updateLeadNotes,
  updateLeadStatus,
} from '@/features/professora/leadsApi'
import { useTimezone } from '@/features/professora/useTimezone'
import {
  EmptyState,
  ErrorState,
  ListSkeleton,
  PageHeader,
} from '@/features/shared/components/StateViews'
import { formatDateTime } from '@/features/shared/datetime'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useQuery } from '@/lib/data/useQuery'

const TONE: Record<LeadStatus, 'info' | 'warning' | 'success' | 'muted'> = {
  novo: 'info',
  contatado: 'warning',
  convertido: 'success',
  descartado: 'muted',
}

function LeadCard({
  lead,
  timezone,
  onChanged,
}: {
  lead: Lead
  timezone: string
  onChanged: () => void
}) {
  const [notes, setNotes] = useState(lead.notes ?? '')
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null)
  const waLink = leadWhatsAppLink(lead)
  const notesError = validateLeadNotes(notes)
  const notesDirty = notes.trim() !== (lead.notes ?? '')

  async function run(action: () => Promise<void>, okText: string) {
    setBusy(true)
    setFeedback(null)
    try {
      await action()
      setFeedback({ ok: true, text: okText })
      onChanged()
    } catch (e) {
      setFeedback({
        ok: false,
        text: e instanceof Error ? e.message : 'Não foi possível concluir.',
      })
    } finally {
      setBusy(false)
    }
  }

  const setStatus = (status: LeadStatus) =>
    run(() => updateLeadStatus(lead.id, status), 'Situação atualizada.')

  const notesId = `lead-notes-${lead.id}`

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-base font-semibold break-words">{lead.name}</h2>
          <p className="text-sm text-muted-foreground">
            {lead.contact} · {formatDateTime(lead.created_at, timezone)}
          </p>
        </div>
        <Badge tone={TONE[lead.status]}>{LEAD_STATUS_LABEL[lead.status]}</Badge>
      </div>

      {lead.message ? (
        <p className="rounded-md bg-muted p-3 text-sm break-words whitespace-pre-wrap">
          {lead.message}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {waLink ? (
          <Button asChild size="sm">
            <a href={waLink} target="_blank" rel="noopener noreferrer">
              <MessageCircle aria-hidden="true" />
              Abrir WhatsApp
              <span className="sr-only"> (abre em nova aba)</span>
            </a>
          </Button>
        ) : (
          <Badge tone="warning">Contato sem telefone válido</Badge>
        )}
        {lead.status !== 'convertido' ? (
          <Button asChild size="sm" variant="outline">
            <Link to={`/app/professora/alunos/novo?lead=${lead.id}`}>
              <UserPlus aria-hidden="true" />
              Converter em aluno
            </Link>
          </Button>
        ) : null}
        {lead.status !== 'contatado' && lead.status !== 'convertido' ? (
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => void setStatus('contatado')}
          >
            Marcar como contatado
          </Button>
        ) : null}
        {lead.status !== 'descartado' && lead.status !== 'convertido' ? (
          <Button
            size="sm"
            variant="ghost"
            disabled={busy}
            onClick={() => void setStatus('descartado')}
          >
            Descartar
          </Button>
        ) : null}
        {lead.status !== 'novo' ? (
          <Button
            size="sm"
            variant="ghost"
            disabled={busy}
            onClick={() => void setStatus('novo')}
          >
            Voltar para novo
          </Button>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={notesId}>Anotação</Label>
        <Textarea
          id={notesId}
          value={notes}
          maxLength={NOTES_MAX}
          aria-invalid={notesError ? true : undefined}
          onChange={(e) => setNotes(e.target.value)}
        />
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">
            {notes.length}/{NOTES_MAX}
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={busy || !notesDirty || notesError !== null}
            onClick={() =>
              void run(() => updateLeadNotes(lead.id, notes), 'Anotação salva.')
            }
          >
            Salvar anotação
          </Button>
        </div>
        {notesError ? <p className="text-xs text-destructive">{notesError}</p> : null}
      </div>

      {feedback ? (
        <Alert variant={feedback.ok ? 'success' : 'destructive'}>
          <AlertDescription>{feedback.text}</AlertDescription>
        </Alert>
      ) : null}
    </Card>
  )
}

export default function Interessados() {
  useDocumentTitle('Interessados')
  const timezone = useTimezone()
  const leads = useQuery('prof-leads', listLeads)
  const [filter, setFilter] = useState<LeadFilter>('novo')
  const [search, setSearch] = useState('')

  const all = leads.data
  const visible = all ? filterLeads(all, search, filter) : []
  const count = (f: LeadFilter) =>
    all ? all.filter((l) => f === 'todos' || l.status === f).length : 0

  return (
    <div className="space-y-4">
      <Link
        to="/app/professora/mais"
        className="inline-block text-sm font-medium text-primary underline-offset-4 hover:underline"
      >
        Voltar para Mais
      </Link>
      <PageHeader
        title="Interessados"
        description="Pessoas que pediram uma aula experimental pelo site."
      />

      <div className="space-y-2">
        <Label htmlFor="lead-search">Buscar</Label>
        <Input
          id="lead-search"
          type="search"
          value={search}
          placeholder="Nome, telefone ou mensagem"
          onChange={(e) => setSearch(e.target.value)}
        />
        <div
          role="group"
          aria-label="Filtrar por situação"
          className="flex flex-wrap gap-2"
        >
          {LEAD_FILTERS.map((f) => (
            <Button
              key={f.value}
              size="sm"
              variant={filter === f.value ? 'default' : 'outline'}
              aria-pressed={filter === f.value}
              onClick={() => setFilter(f.value)}
            >
              {f.label}
              {all ? ` (${count(f.value)})` : ''}
            </Button>
          ))}
        </div>
      </div>

      {leads.error ? (
        <ErrorState error={leads.error} onRetry={leads.refetch} />
      ) : !all ? (
        <ListSkeleton />
      ) : visible.length === 0 ? (
        <EmptyState title="Nenhum interessado por aqui">
          {all.length === 0
            ? 'Quando alguém preencher o formulário do site, aparece nesta lista.'
            : 'Mude o filtro ou a busca para ver outros.'}
        </EmptyState>
      ) : (
        <ul className="space-y-3">
          {visible.map((l) => (
            <li key={l.id}>
              <LeadCard lead={l} timezone={timezone} onChanged={leads.refetch} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
