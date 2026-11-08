import { useEffect, useMemo, useRef, useState } from 'react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { ConfirmDialog } from '@/features/professora/components/ConfirmDialog'
import { dayKey } from '@/features/shared/datetime'
import { friendlyError } from '@/features/shared/errors'

import {
  cancelLessonsByTeacher,
  deletePattern,
  savePattern,
  setPatternSlots,
} from '../api'
import { previewChanges } from '../engine'
import {
  countAvailableDays,
  defaultWizardState,
  hasWizardErrors,
  lessonsOutsideAfterChange,
  patternInputFromWizard,
  pluralize,
  previewWindow,
  simulateData,
  simulateDelete,
  slotsFromWizard,
  stepHasErrors,
  summarizePattern,
  validateWizard,
  wizardFromPattern,
  type WizardState,
} from '../wizard'
import type { ConflictAction, PatternWizardProps } from './contracts'
import { ConflictDialog } from './ConflictDialog'
import { useActiveLessons } from './ConflictUseLessons'
import { WizardPreview } from './WizardPreview'
import { WizardDaysStep, WizardHoursStep, WizardPeriodStep } from './WizardSteps'

const STEPS = ['Dias da semana', 'Horário', 'Duração e vigência', 'Prévia'] as const
const CANCEL_REASON = 'Horário de atendimento alterado'

export function PatternWizard(props: PatternWizardProps) {
  return (
    <Dialog
      open={props.open}
      onClose={() => props.onOpenChange(false)}
      title={props.patternId ? 'Editar horário padrão' : 'Definir horário padrão'}
      className="max-w-2xl"
    >
      {props.open ? <WizardBody {...props} /> : null}
    </Dialog>
  )
}

function WizardBody({
  data,
  timezone,
  patternId,
  onOpenChange,
  onSaved,
}: PatternWizardProps) {
  const todayKey = useMemo(() => dayKey(new Date(), timezone), [timezone])
  const existing = patternId
    ? (data.patterns.find((p) => p.id === patternId) ?? null)
    : null
  const [state, setState] = useState<WizardState>(() =>
    existing ? wizardFromPattern(existing, data.slots) : defaultWizardState(todayKey),
  )
  const [step, setStep] = useState(0)
  const [showErrors, setShowErrors] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [conflictOpen, setConflictOpen] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [result, setResult] = useState<string | null>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const firstRender = useRef(true)

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    headingRef.current?.focus()
  }, [step])

  const errors = useMemo(() => validateWizard(state), [state])
  const valid = !hasWizardErrors(errors)

  const window = useMemo(
    () => (valid ? previewWindow(state, existing, todayKey) : null),
    [valid, state, existing, todayKey],
  )
  const lessonsQuery = useActiveLessons(
    step === 3 || conflictOpen ? (window?.from ?? null) : null,
    step === 3 || conflictOpen ? (window?.to ?? null) : null,
    timezone,
  )

  const simulated = useMemo(
    () => (valid ? simulateData(data, existing?.id ?? null, state, timezone) : data),
    [valid, data, existing, state, timezone],
  )
  const analysis = useMemo(() => {
    if (!valid || !window || step !== 3) return null
    return {
      availableDays: countAvailableDays(simulated, window.from, window.to),
      changes: existing ? previewChanges(data, simulated, window.from, window.to) : [],
      outside: lessonsOutsideAfterChange(lessonsQuery.lessons, data, simulated, timezone),
    }
  }, [valid, window, step, simulated, existing, data, lessonsQuery.lessons, timezone])

  const outside = analysis?.outside ?? []
  const summary = summarizePattern(state)

  function goNext() {
    if (stepHasErrors(errors, step)) {
      setShowErrors(true)
      return
    }
    setShowErrors(false)
    setStep((s) => Math.min(3, s + 1))
  }

  function goBack() {
    setShowErrors(false)
    setStep((s) => Math.max(0, s - 1))
  }

  function startSave() {
    setError(null)
    if (!valid) {
      setShowErrors(true)
      const bad = [0, 1, 2].find((s) => stepHasErrors(errors, s))
      if (bad !== undefined) setStep(bad)
      return
    }
    if (outside.length > 0) setConflictOpen(true)
    else void persist(false)
  }

  async function persist(cancelOutside: boolean) {
    setBusy(true)
    setError(null)
    try {
      const id = await savePattern(patternInputFromWizard(state), existing?.id)
      await setPatternSlots(id, slotsFromWizard(state))
      let failed = 0
      let canceled = 0
      if (cancelOutside && outside.length > 0) {
        const out = await cancelLessonsByTeacher(
          outside.map((l) => l.id),
          CANCEL_REASON,
        )
        failed = out.failed.length
        canceled = out.succeeded.length
      }
      setConflictOpen(false)
      onSaved()
      if (failed > 0) {
        setResult(
          `Horário salvo. ${pluralize(canceled, 'aula cancelada', 'aulas canceladas')} e ${pluralize(failed, 'não pôde ser cancelada', 'não puderam ser canceladas')}. Confira a agenda.`,
        )
      } else {
        onOpenChange(false)
      }
    } catch (e) {
      setConflictOpen(false)
      setError(friendlyError(e, 'Não foi possível salvar o horário padrão.'))
    } finally {
      setBusy(false)
    }
  }

  function onResolve(action: ConflictAction) {
    if (action === 'desfazer') setConflictOpen(false)
    else void persist(action === 'cancelar')
  }

  // ---- exclusão com prévia do efeito
  function askDelete() {
    if (!existing) return
    setError(null)
    const after = simulateDelete(data, existing.id)
    const win = previewWindow(
      { startsOn: existing.starts_on, endsOn: existing.ends_on ?? '' },
      null,
      todayKey,
    )
    let text = 'O horário padrão e suas faixas serão removidos.'
    if (win) {
      const changed = previewChanges(data, after, win.from, win.to).length
      text += ` ${pluralize(changed, 'dia muda de horário', 'dias mudam de horário')} no período futuro.`
      if (after.patterns.length === 0) {
        text += ' Sem nenhum padrão, o calendário volta a ficar sem restrição de horário.'
      }
    }
    text += ' Aulas já agendadas não são canceladas.'
    setDeleting(text)
  }

  if (result) {
    return (
      <div className="space-y-4">
        <Alert variant="warning">
          <AlertTitle>Atenção</AlertTitle>
          <AlertDescription>{result}</AlertDescription>
        </Alert>
        <div className="flex justify-end">
          <Button autoFocus onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </div>
      </div>
    )
  }

  const stepProps = { state, errors, showErrors, onChange: setState }

  return (
    <div className="space-y-4">
      {patternId && !existing ? (
        <Alert variant="warning">
          Esse padrão não foi encontrado. Você está criando um novo horário padrão.
        </Alert>
      ) : null}

      <div>
        <p className="text-xs text-muted-foreground" aria-live="polite">
          Passo {step + 1} de {STEPS.length}
        </p>
        <div className="mt-1.5 flex gap-1" aria-hidden="true">
          {STEPS.map((label, i) => (
            <span
              key={label}
              className={`h-1.5 flex-1 rounded-full ${i <= step ? 'bg-primary' : 'bg-muted'}`}
            />
          ))}
        </div>
        <h3
          ref={headingRef}
          tabIndex={-1}
          className="mt-3 text-base font-semibold outline-none"
        >
          {STEPS[step]}
        </h3>
      </div>

      {step === 0 ? <WizardDaysStep {...stepProps} /> : null}
      {step === 1 ? <WizardHoursStep {...stepProps} /> : null}
      {step === 2 ? <WizardPeriodStep {...stepProps} todayKey={todayKey} /> : null}
      {step === 3 ? (
        <WizardPreview
          summary={summary}
          window={window}
          availableDays={analysis?.availableDays ?? 0}
          changes={analysis?.changes ?? []}
          isEdit={Boolean(existing)}
          lessons={lessonsQuery.lessons}
          lessonsLoading={lessonsQuery.loading}
          lessonsError={lessonsQuery.error}
          outside={outside}
          timezone={timezone}
          onReview={startSave}
        />
      ) : null}

      {error ? <Alert variant="destructive">{error}</Alert> : null}

      <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:items-center">
        {existing ? (
          <Button
            type="button"
            variant="ghost"
            className="text-destructive hover:text-destructive sm:mr-auto"
            disabled={busy}
            onClick={() => askDelete()}
          >
            Excluir padrão
          </Button>
        ) : (
          <span className="sm:mr-auto" />
        )}
        {step === 0 ? (
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
        ) : (
          <Button type="button" variant="outline" disabled={busy} onClick={goBack}>
            Voltar
          </Button>
        )}
        {step < 3 ? (
          <Button type="button" onClick={goNext}>
            Continuar
          </Button>
        ) : (
          <Button
            type="button"
            disabled={busy || !valid || lessonsQuery.loading}
            onClick={startSave}
          >
            {busy ? 'Salvando…' : existing ? 'Salvar alterações' : 'Salvar horário'}
          </Button>
        )}
      </div>

      <ConflictDialog
        open={conflictOpen}
        title="Aulas fora do novo horário"
        description="Essas aulas já agendadas ficam fora do horário que você definiu. O que fazer com elas?"
        lessons={outside}
        timezone={timezone}
        busy={busy}
        onResolve={onResolve}
      />

      {deleting ? (
        <ConfirmDialog
          title="Excluir horário padrão?"
          description={deleting}
          confirmLabel="Excluir padrão"
          onClose={() => setDeleting(null)}
          onConfirm={async () => {
            if (!existing) return
            try {
              await deletePattern(existing.id)
            } catch (e) {
              throw new Error(friendlyError(e, 'Não foi possível excluir o padrão.'))
            }
            onSaved()
            onOpenChange(false)
          }}
        />
      ) : null}
    </div>
  )
}
