import { Plus, Trash2 } from 'lucide-react'

import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/field'
import { FormField } from '@/features/professora/components/FormField'
import { cn } from '@/lib/utils'

import {
  LESSON_DURATION_PRESETS,
  MAX_LESSON_MINUTES,
  MIN_LESSON_MINUTES,
  WEEKDAYS_MON_FRI,
  WEEKDAYS_MON_SAT,
  WEEKDAY_SHORT,
  WEEK_ORDER,
  toAdvanced,
  untilYearEnd,
  wholeYearPeriod,
  type TimeBlock,
  type WizardErrors,
  type WizardState,
} from '../wizard'

type StepProps = {
  state: WizardState
  errors: WizardErrors
  onChange: (next: WizardState) => void
  showErrors: boolean
}

const WEEKDAY_LONG = [
  'Domingo',
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado',
]

function sameDays(a: readonly number[], b: readonly number[]): boolean {
  return a.length === b.length && a.every((d) => b.includes(d))
}

function ErrorList({ messages }: { messages: readonly string[] | undefined }) {
  if (!messages || messages.length === 0) return null
  return (
    <ul className="space-y-0.5 text-xs text-destructive" role="alert">
      {messages.map((m) => (
        <li key={m}>{m}</li>
      ))}
    </ul>
  )
}

// ------------------------------------------------------------------ passo 1: dias

export function WizardDaysStep({ state, errors, onChange, showErrors }: StepProps) {
  function toggle(day: number) {
    const has = state.weekdays.includes(day)
    const weekdays = has
      ? state.weekdays.filter((d) => d !== day)
      : [...state.weekdays, day]
    const dayBlocks = { ...state.dayBlocks }
    if (!has && state.advanced && !dayBlocks[day]) {
      const first = state.weekdays[0]
      dayBlocks[day] = (first !== undefined ? (dayBlocks[first] ?? []) : []).map((b) => ({
        ...b,
      }))
      if (dayBlocks[day].length === 0)
        dayBlocks[day] = [{ start: state.start, end: state.end }]
    }
    onChange({ ...state, weekdays, dayBlocks })
  }

  function preset(days: number[]) {
    const next = { ...state, weekdays: [...days] }
    onChange(state.advanced ? toAdvanced(next) : next)
  }

  return (
    <div className="space-y-4">
      <div
        role="group"
        aria-labelledby="wiz-dias-titulo"
        className="grid grid-cols-4 gap-2 sm:grid-cols-7"
      >
        <span id="wiz-dias-titulo" className="sr-only">
          Dias da semana com atendimento
        </span>
        {WEEK_ORDER.map((d) => {
          const on = state.weekdays.includes(d)
          return (
            <button
              key={d}
              type="button"
              aria-pressed={on}
              aria-label={WEEKDAY_LONG[d]}
              onClick={() => toggle(d)}
              className={cn(
                'h-11 rounded-lg border text-sm font-semibold outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
                on
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'bg-background hover:bg-accent',
              )}
            >
              {WEEKDAY_SHORT[d]}
            </button>
          )
        })}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant={sameDays(state.weekdays, WEEKDAYS_MON_FRI) ? 'secondary' : 'outline'}
          onClick={() => preset(WEEKDAYS_MON_FRI)}
        >
          Seg a Sex
        </Button>
        <Button
          type="button"
          size="sm"
          variant={sameDays(state.weekdays, WEEKDAYS_MON_SAT) ? 'secondary' : 'outline'}
          onClick={() => preset(WEEKDAYS_MON_SAT)}
        >
          Seg a Sáb
        </Button>
      </div>
      {showErrors && errors.weekdays ? (
        <p role="alert" className="text-sm text-destructive">
          {errors.weekdays}
        </p>
      ) : null}
    </div>
  )
}

// ------------------------------------------------------------------ passo 2: horário

function BlockRow({
  block,
  label,
  onChange,
  onRemove,
}: {
  block: TimeBlock
  label: string
  onChange: (b: TimeBlock) => void
  onRemove?: () => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        type="time"
        step={300}
        aria-label={`${label}: início`}
        className="w-32"
        value={block.start}
        onChange={(e) => onChange({ ...block, start: e.target.value })}
      />
      <span aria-hidden="true">–</span>
      <Input
        type="time"
        step={300}
        aria-label={`${label}: fim`}
        className="w-32"
        value={block.end}
        onChange={(e) => onChange({ ...block, end: e.target.value })}
      />
      {onRemove ? (
        <Button
          type="button"
          size="icon"
          variant="ghost"
          aria-label={`Remover ${label.toLowerCase()}`}
          onClick={onRemove}
        >
          <Trash2 />
        </Button>
      ) : null}
    </div>
  )
}

export function WizardHoursStep({ state, errors, onChange, showErrors }: StepProps) {
  const days = WEEK_ORDER.filter((d) => state.weekdays.includes(d))

  function setBreaks(breaks: TimeBlock[]) {
    onChange({ ...state, breaks })
  }
  function setBlocks(day: number, blocks: TimeBlock[]) {
    onChange({ ...state, dayBlocks: { ...state.dayBlocks, [day]: blocks } })
  }
  function copyToOthers(day: number) {
    const source = state.dayBlocks[day] ?? []
    const dayBlocks = { ...state.dayBlocks }
    for (const d of days) dayBlocks[d] = source.map((b) => ({ ...b }))
    onChange({ ...state, dayBlocks })
  }

  return (
    <div className="space-y-4">
      <label className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          className="mt-0.5 size-4 accent-primary"
          checked={state.advanced}
          onChange={(e) =>
            onChange(e.target.checked ? toAdvanced(state) : { ...state, advanced: false })
          }
        />
        <span>
          <span className="font-medium">Horários diferentes por dia</span>
          <span className="block text-xs text-muted-foreground">
            Útil quando, por exemplo, o sábado é só de manhã.
          </span>
        </span>
      </label>

      {!state.advanced ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:max-w-sm">
            <FormField label="Início">
              {(p) => (
                <Input
                  {...p}
                  type="time"
                  step={300}
                  value={state.start}
                  onChange={(e) => onChange({ ...state, start: e.target.value })}
                />
              )}
            </FormField>
            <FormField label="Fim">
              {(p) => (
                <Input
                  {...p}
                  type="time"
                  step={300}
                  value={state.end}
                  onChange={(e) => onChange({ ...state, end: e.target.value })}
                />
              )}
            </FormField>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Intervalos (ex.: almoço)</p>
            {state.breaks.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhum intervalo.</p>
            ) : null}
            {state.breaks.map((b, i) => (
              <BlockRow
                key={i}
                block={b}
                label={`Intervalo ${i + 1}`}
                onChange={(nb) =>
                  setBreaks(state.breaks.map((x, j) => (j === i ? nb : x)))
                }
                onRemove={() => setBreaks(state.breaks.filter((_, j) => j !== i))}
              />
            ))}
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() =>
                setBreaks([
                  ...state.breaks,
                  state.breaks.length === 0
                    ? { start: '12:00', end: '13:00' }
                    : { start: '', end: '' },
                ])
              }
            >
              <Plus /> Adicionar intervalo
            </Button>
          </div>
          {showErrors ? <ErrorList messages={errors.time} /> : null}
        </div>
      ) : (
        <div className="space-y-4">
          {days.map((d) => {
            const blocks = state.dayBlocks[d] ?? []
            return (
              <fieldset key={d} className="space-y-2 rounded-lg border p-3">
                <legend className="px-1 text-sm font-semibold">{WEEKDAY_LONG[d]}</legend>
                {blocks.map((b, i) => (
                  <BlockRow
                    key={i}
                    block={b}
                    label={`${WEEKDAY_LONG[d]}, faixa ${i + 1}`}
                    onChange={(nb) =>
                      setBlocks(
                        d,
                        blocks.map((x, j) => (j === i ? nb : x)),
                      )
                    }
                    onRemove={
                      blocks.length > 1
                        ? () =>
                            setBlocks(
                              d,
                              blocks.filter((_, j) => j !== i),
                            )
                        : undefined
                    }
                  />
                ))}
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setBlocks(d, [...blocks, { start: '', end: '' }])}
                  >
                    <Plus /> Adicionar faixa
                  </Button>
                  {days.length > 1 ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => copyToOthers(d)}
                    >
                      Copiar para os outros dias
                    </Button>
                  ) : null}
                </div>
                {showErrors ? <ErrorList messages={errors.days?.[d]} /> : null}
              </fieldset>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ------------------------------------------------------------------ passo 3: duração e vigência

export function WizardPeriodStep({
  state,
  errors,
  onChange,
  showErrors,
  todayKey,
}: StepProps & { todayKey: string }) {
  const isPreset = (LESSON_DURATION_PRESETS as readonly number[]).includes(
    state.lessonMinutes,
  )
  const year = Number(todayKey.slice(0, 4))
  const startYear = Number(state.startsOn.slice(0, 4)) || year

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <p id="wiz-duracao" className="text-sm font-medium">
          Duração padrão da aula
        </p>
        <div role="group" aria-labelledby="wiz-duracao" className="flex flex-wrap gap-2">
          {LESSON_DURATION_PRESETS.map((m) => (
            <Button
              key={m}
              type="button"
              size="sm"
              aria-pressed={state.lessonMinutes === m}
              variant={state.lessonMinutes === m ? 'default' : 'outline'}
              onClick={() => onChange({ ...state, lessonMinutes: m })}
            >
              {m} min
            </Button>
          ))}
        </div>
        <div className="max-w-40">
          <FormField
            label="Outra duração (min)"
            error={showErrors ? errors.lessonMinutes : undefined}
          >
            {(p) => (
              <Input
                {...p}
                type="number"
                inputMode="numeric"
                min={MIN_LESSON_MINUTES}
                max={MAX_LESSON_MINUTES}
                value={isPreset ? '' : String(state.lessonMinutes)}
                placeholder="Ex.: 40"
                onChange={(e) =>
                  onChange({
                    ...state,
                    lessonMinutes: e.target.value === '' ? 0 : Number(e.target.value),
                  })
                }
              />
            )}
          </FormField>
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-sm font-medium">
          Vigência (a partir de quando e até quando vale)
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="De" error={showErrors ? errors.startsOn : undefined}>
            {(p) => (
              <Input
                {...p}
                type="date"
                value={state.startsOn}
                onChange={(e) => onChange({ ...state, startsOn: e.target.value })}
              />
            )}
          </FormField>
          <FormField
            label="Até (opcional)"
            error={showErrors ? errors.endsOn : undefined}
            help="Em branco = sem data de fim."
          >
            {(p) => (
              <Input
                {...p}
                type="date"
                value={state.endsOn}
                min={state.startsOn || undefined}
                onChange={(e) => onChange({ ...state, endsOn: e.target.value })}
              />
            )}
          </FormField>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => onChange({ ...state, ...wholeYearPeriod(startYear) })}
          >
            O ano todo ({startYear})
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() =>
              onChange({ ...state, endsOn: untilYearEnd(state.startsOn, todayKey) })
            }
          >
            Até o fim do ano
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => onChange({ ...state, endsOn: '' })}
          >
            Sem data de fim
          </Button>
        </div>
        <Alert variant="info">
          Dias fora da vigência de todos os padrões ficam sem horário. Padrões com datas
          em comum somam as faixas; para trocar de horário, encerre o antigo e comece o
          novo na data da mudança.
        </Alert>
      </div>
    </div>
  )
}
