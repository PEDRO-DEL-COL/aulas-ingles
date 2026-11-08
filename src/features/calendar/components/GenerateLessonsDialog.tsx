import { RefreshCw } from 'lucide-react'
import { useState } from 'react'

import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Label, Select } from '@/components/ui/field'
import { generateLessons } from '@/features/professora/api'
import {
  GENERATION_OPTIONS,
  generationMessage,
  generationRange,
  type GenerationScope,
} from '@/features/professora/generation'
import { dayKey } from '@/features/shared/datetime'
import { friendlyError } from '@/features/shared/errors'

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

  async function generate() {
    setBusy(true)
    setError(null)
    try {
      const weekStart = weekKeys(referenceDate)[0] ?? referenceDate
      const { from, to } = generationRange(scope, weekStart, dayKey(new Date(), timezone))
      const n = await generateLessons(from, to)
      onDone(generationMessage(scope, n))
    } catch (e) {
      setError(friendlyError(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Gerar aulas recorrentes"
      dismissible={!busy}
    >
      <p className="text-sm text-muted-foreground">
        Usa os horários fixos dos alunos ativos e pula férias e feriados. Aulas já
        existentes não são duplicadas.
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
