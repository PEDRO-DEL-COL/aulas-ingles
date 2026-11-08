import { useId } from 'react'

import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input, Label } from '@/components/ui/field'
import { cn } from '@/lib/utils'

import { suggestStarts, type AvailabilityData } from '../engine'

/**
 * Data + horário: chips com os horários sugeridos (cabem na disponibilidade) e campo para
 * digitar outro. A validação final é do chamador (e do banco).
 */
export function SlotPicker({
  idPrefix,
  dateKey,
  onDateChange,
  time,
  onTimeChange,
  durationMin,
  data,
  loading,
  error,
  onRetry,
  disabled,
  onOpenDay,
}: {
  idPrefix: string
  dateKey: string
  onDateChange: (key: string) => void
  time: string
  onTimeChange: (time: string) => void
  /** null = duração inválida (sem sugestões). */
  durationMin: number | null
  data: AvailabilityData | undefined
  loading: boolean
  error: unknown
  onRetry: () => void
  disabled?: boolean
  /** Atalho para ajustar o dia (abre o painel do dia). */
  onOpenDay?: (dateKey: string) => void
}) {
  const groupId = useId()
  const starts =
    data && durationMin !== null && dateKey
      ? suggestStarts(dateKey, durationMin, data)
      : []

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-date`}>Data</Label>
          <Input
            id={`${idPrefix}-date`}
            type="date"
            value={dateKey}
            disabled={disabled}
            onChange={(e) => onDateChange(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-time`}>Hora</Label>
          <Input
            id={`${idPrefix}-time`}
            type="time"
            value={time}
            disabled={disabled}
            onChange={(e) => onTimeChange(e.target.value)}
          />
        </div>
      </div>

      <div aria-live="polite" className="space-y-2">
        {error ? (
          <Alert variant="warning" className="flex flex-wrap items-center gap-2">
            <span>
              Não foi possível carregar a disponibilidade. Você ainda pode digitar o
              horário; o banco confere ao salvar.
            </span>
            <Button size="sm" variant="outline" onClick={onRetry}>
              Tentar de novo
            </Button>
          </Alert>
        ) : loading ? (
          <p role="status" className="text-sm text-muted-foreground">
            Carregando horários disponíveis…
          </p>
        ) : !dateKey ? null : starts.length > 0 ? (
          <div role="group" aria-labelledby={groupId} className="space-y-1.5">
            <p id={groupId} className="text-sm font-medium">
              Horários disponíveis
            </p>
            <div className="flex flex-wrap gap-1.5">
              {starts.map((s) => (
                <button
                  key={s}
                  type="button"
                  aria-pressed={time === s}
                  disabled={disabled}
                  onClick={() => onTimeChange(s)}
                  className={cn(
                    'h-9 min-w-14 rounded-md border px-2.5 text-sm font-medium outline-none focus-visible:ring-[3px] focus-visible:ring-ring/60 disabled:opacity-50',
                    time === s
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'bg-card hover:bg-accent',
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : data && durationMin !== null ? (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <p className="font-medium text-warning">Sem horários disponíveis neste dia</p>
            {onOpenDay ? (
              <Button
                size="sm"
                variant="outline"
                disabled={disabled}
                onClick={() => onOpenDay(dateKey)}
              >
                Ver ou ajustar o dia
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}
