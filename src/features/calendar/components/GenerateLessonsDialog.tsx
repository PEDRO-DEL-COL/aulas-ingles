import { RefreshCw } from 'lucide-react'
import { useState } from 'react'

import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Label, Select } from '@/components/ui/field'
import {
  GENERATION_OPTIONS,
  generationReportMessage,
  generationRange,
  SKIP_REASON_LABEL,
  type GenerationReport,
  type GenerationScope,
} from '@/features/professora/generation'
import { dayKey, formatDateTimeLong } from '@/features/shared/datetime'
import { friendlyError } from '@/features/shared/errors'

import { generateRecurringLessons } from '../api'
import { weekKeys } from '../engine'

/** Gera as aulas recorrentes (como na antiga Agenda): semana exibida ou próximas 4/8 semanas. */
export function GenerateLessonsDialog({
  open,
  timezone,
  referenceDate,
  onClose,
  onDone,
}: {
  open: boolean
  timezone: string
  /** Qualquer data da semana exibida. */
  referenceDate: string
  onClose: () => void
  onDone: (message: string) => void
}) {
  const [scope, setScope] = useState<GenerationScope>('4')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{
    message: string
    report: GenerationReport
  } | null>(null)

  async function generate() {
    setBusy(true)
    setError(null)
    try {
      const weekStart = weekKeys(referenceDate)[0] ?? referenceDate
      const { from, to } = generationRange(scope, weekStart, dayKey(new Date(), timezone))
      const report = await generateRecurringLessons(from, to)
      const message = generationReportMessage(scope, report)
      if (report.skippedTotal === 0) onDone(message)
      else setResult({ message, report })
    } catch (e) {
      setError(friendlyError(e))
    } finally {
      setBusy(false)
    }
  }

  if (result) {
    const { report, message } = result
    const hidden = report.skippedTotal - report.skipped.length
    return (
      <Dialog open={open} onClose={() => onDone(message)} title="Relatório da geração">
        <Alert variant={report.created > 0 ? 'success' : 'info'}>
          {report.created === 0
            ? 'Nenhuma aula nova foi criada.'
            : `${report.created} ${report.created === 1 ? 'aula criada' : 'aulas criadas'}.`}
        </Alert>
        <section aria-labelledby="gerar-puladas" className="space-y-2">
          <h3 id="gerar-puladas" className="text-sm font-semibold">
            {report.skippedTotal === 1
              ? '1 ocorrência pulada'
              : `${report.skippedTotal} ocorrências puladas`}
          </h3>
          <ul className="max-h-64 divide-y overflow-y-auto rounded-md border text-sm">
            {report.skipped.map((s, i) => (
              <li key={`${s.studentId}-${s.startsAt}-${i}`} className="px-3 py-2">
                <p className="font-medium">{s.studentName}</p>
                <p className="text-muted-foreground first-letter:uppercase">
                  {formatDateTimeLong(s.startsAt, timezone)}
                  {s.durationMinutes ? ` · ${s.durationMinutes} min` : ''}
                </p>
                <p className="text-warning">{SKIP_REASON_LABEL[s.reason]}</p>
              </li>
            ))}
          </ul>
          {hidden > 0 ? (
            <p className="text-xs text-muted-foreground">
              Mostrando as primeiras {report.skipped.length}; mais {hidden} não listadas.
            </p>
          ) : null}
          <p className="text-sm text-muted-foreground">
            Para gerar essas aulas, ajuste a disponibilidade (horário padrão ou o dia) ou
            mude o horário fixo do aluno, e gere de novo.
          </p>
        </section>
        <div className="flex justify-end">
          <Button onClick={() => onDone(message)}>Fechar</Button>
        </div>
      </Dialog>
    )
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Gerar aulas recorrentes"
      dismissible={!busy}
    >
      <p className="text-sm text-muted-foreground">
        Usa os horários fixos dos alunos ativos e pula o que não cabe na disponibilidade
        (férias, feriados e horários fora do padrão). Aulas já existentes não são
        duplicadas.
      </p>
      {error ? <Alert variant="destructive">{error}</Alert> : null}
      <div className="space-y-1.5">
        <Label htmlFor="gerar-intervalo">Período</Label>
        <Select
          id="gerar-intervalo"
          value={scope}
          onChange={(e) => setScope(e.target.value as GenerationScope)}
        >
          {GENERATION_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose} disabled={busy}>
          Cancelar
        </Button>
        <Button onClick={() => void generate()} disabled={busy}>
          <RefreshCw aria-hidden="true" className={busy ? 'animate-spin' : ''} />
          {busy ? 'Gerando…' : 'Gerar aulas'}
        </Button>
      </div>
    </Dialog>
  )
}
