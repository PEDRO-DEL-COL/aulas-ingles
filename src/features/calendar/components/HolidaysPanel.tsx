import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Input, Select } from '@/components/ui/field'
import { blockPreviewMessage } from '@/features/professora/blocked'
import { listBlockedDates } from '@/features/professora/blockedDatesApi'
import { ConfirmDialog } from '@/features/professora/components/ConfirmDialog'
import { FormField } from '@/features/professora/components/FormField'
import { rangeUtc, parseDayKey } from '@/features/professora/tz'
import { dayKey, formatDateOnly } from '@/features/shared/datetime'
import { friendlyError } from '@/features/shared/errors'

import {
  addBlockedDates,
  deleteBlockedDate,
  listLessonsInRange,
  type BlockedDateInput,
} from '../api'
import type { BlockedDate } from '../engine'
import {
  brazilHolidays,
  holidayReason,
  isHolidayReason,
  HOLIDAY_REASON_PREFIX,
} from '../holidays'
import type { LessonWithStudent } from '@/features/professora/lessons'
import type { HolidaysPanelProps } from './contracts'
import { ConflictLessonList } from './ConflictLessonList'
import { isActiveLesson } from './ConflictUseLessons'

const WEEKDAY_LONG = [
  'domingo',
  'segunda-feira',
  'terça-feira',
  'quarta-feira',
  'quinta-feira',
  'sexta-feira',
  'sábado',
]
const MONTHS = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
]

/** "7 de setembro de 2026" a partir de "2026-09-07" (sem fuso). */
function longDate(key: string): { text: string; weekday: string } {
  const p = parseDayKey(key)
  if (!p) return { text: key, weekday: '' }
  const weekday = WEEKDAY_LONG[new Date(Date.UTC(p.y, p.m - 1, p.d)).getUTCDay()] ?? ''
  return { text: `${p.d} de ${MONTHS[p.m - 1] ?? ''} de ${p.y}`, weekday }
}

function blockedOn(key: string, list: readonly BlockedDate[]): BlockedDate | undefined {
  return list.find((b) => b.starts_on <= key && key <= b.ends_on)
}

type Pending = { items: BlockedDateInput[]; lessons: LessonWithStudent[] }

export function HolidaysPanel(props: HolidaysPanelProps) {
  return (
    <Dialog
      open={props.open}
      onClose={() => props.onOpenChange(false)}
      title="Feriados"
      className="max-w-2xl"
    >
      {props.open ? <HolidaysBody {...props} /> : null}
    </Dialog>
  )
}

function HolidaysBody({
  year: initialYear,
  data,
  timezone,
  onOpenChange,
  onApplied,
}: HolidaysPanelProps) {
  const [year, setYear] = useState(initialYear)
  const [blocked, setBlocked] = useState<BlockedDate[]>(data.blocked)
  const [loadError, setLoadError] = useState<string | null>(null)
  // null = seleção padrão (não facultativos ainda não bloqueados)
  const [selected, setSelected] = useState<Set<string> | null>(null)
  const [pending, setPending] = useState<Pending | null>(null)
  const [checking, setChecking] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [removing, setRemoving] = useState<BlockedDate | null>(null)
  const [manualDate, setManualDate] = useState('')
  const [manualName, setManualName] = useState('')
  const [manualError, setManualError] = useState<string | null>(null)

  const refreshBlocked = useCallback(async () => {
    try {
      setBlocked(await listBlockedDates())
      setLoadError(null)
    } catch (e) {
      setLoadError(
        friendlyError(e, 'Não foi possível atualizar a lista de dias bloqueados.'),
      )
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    listBlockedDates()
      .then((list) => {
        if (!cancelled) setBlocked(list)
      })
      .catch((e: unknown) => {
        if (!cancelled)
          setLoadError(
            friendlyError(e, 'Não foi possível atualizar a lista de dias bloqueados.'),
          )
      })
    return () => {
      cancelled = true
    }
  }, [])

  const holidays = useMemo(() => brazilHolidays(year), [year])
  const yearOptions = useMemo(
    () => Array.from({ length: 6 }, (_, i) => initialYear - 1 + i),
    [initialYear],
  )
  const effective = useMemo(
    () =>
      selected ??
      new Set(
        holidays
          .filter((h) => !h.optional && !blockedOn(h.dateKey, blocked))
          .map((h) => h.dateKey),
      ),
    [selected, holidays, blocked],
  )
  const holidayBlocks = useMemo(
    () =>
      blocked
        .filter((b) => isHolidayReason(b.reason) && b.starts_on.startsWith(`${year}-`))
        .sort((a, b) => a.starts_on.localeCompare(b.starts_on)),
    [blocked, year],
  )

  function changeYear(next: number) {
    setYear(next)
    setSelected(null)
    setPending(null)
    setMessage(null)
    setError(null)
  }

  function toggle(key: string) {
    const next = new Set(effective)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    setSelected(next)
  }

  async function prepare(items: BlockedDateInput[]) {
    setError(null)
    setMessage(null)
    if (items.length === 0) {
      setError('Escolha ao menos um feriado.')
      return
    }
    setChecking(true)
    try {
      const keys = new Set(items.map((i) => i.starts_on))
      const sorted = [...keys].sort()
      const first = sorted[0] ?? ''
      const last = sorted[sorted.length - 1] ?? first
      const { start, end } = rangeUtc(first, last, timezone)
      let lessons: LessonWithStudent[] = []
      try {
        lessons = (await listLessonsInRange(start, end)).filter(
          (l) => isActiveLesson(l) && keys.has(dayKey(l.starts_at, timezone)),
        )
      } catch (e) {
        setError(
          `${friendlyError(e, 'Não foi possível verificar as aulas.')} Confira a agenda antes de confirmar.`,
        )
      }
      setPending({ items, lessons })
    } finally {
      setChecking(false)
    }
  }

  function itemsFor(keys: Iterable<string>): BlockedDateInput[] {
    const wanted = new Set(keys)
    return holidays
      .filter((h) => wanted.has(h.dateKey) && !blockedOn(h.dateKey, blocked))
      .map((h) => ({
        starts_on: h.dateKey,
        ends_on: h.dateKey,
        reason: holidayReason(h.name),
      }))
  }

  async function confirm() {
    if (!pending) return
    setSaving(true)
    setError(null)
    try {
      await addBlockedDates(pending.items)
      const n = pending.items.length
      const c = pending.lessons.length
      setMessage(
        `${n === 1 ? '1 dia bloqueado' : `${n} dias bloqueados`}. ${
          c === 0
            ? 'Nenhuma aula estava agendada nesses dias.'
            : c === 1
              ? '1 aula foi cancelada, com direito a reposição.'
              : `${c} aulas foram canceladas, com direito a reposição.`
        }`,
      )
      setPending(null)
      setSelected(null)
      setManualDate('')
      setManualName('')
      onApplied()
      await refreshBlocked()
    } catch (e) {
      setError(friendlyError(e, 'Não foi possível bloquear os dias.'))
    } finally {
      setSaving(false)
    }
  }

  function submitManual(e: FormEvent) {
    e.preventDefault()
    const name = manualName.trim()
    if (!parseDayKey(manualDate)) return setManualError('Informe uma data válida.')
    if (name === '') return setManualError('Informe o nome do feriado.')
    if (name.length > 150) return setManualError('Use até 150 caracteres no nome.')
    if (blockedOn(manualDate, blocked))
      return setManualError('Essa data já está bloqueada.')
    setManualError(null)
    void prepare([
      { starts_on: manualDate, ends_on: manualDate, reason: holidayReason(name) },
    ])
  }

  const selectable = holidays.filter((h) => !blockedOn(h.dateKey, blocked))

  if (pending) {
    const c = pending.lessons.length
    return (
      <div className="space-y-4">
        <p className="text-sm">
          Bloquear {pending.items.length === 1 ? '1 dia' : `${pending.items.length} dias`}
          :
        </p>
        <ul className="space-y-1 text-sm">
          {pending.items.map((i) => (
            <li key={i.starts_on}>
              <span className="font-medium">{formatDateOnly(i.starts_on)}</span>{' '}
              <span className="text-muted-foreground">
                {(i.reason ?? '').replace(HOLIDAY_REASON_PREFIX, '')}
              </span>
            </li>
          ))}
        </ul>
        {c > 0 ? (
          <>
            <Alert variant="warning">{blockPreviewMessage(c)}</Alert>
            <ConflictLessonList
              lessons={pending.lessons}
              timezone={timezone}
              label="Aulas que serão canceladas"
              limit={8}
            />
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            Nenhuma aula agendada nesses dias.
          </p>
        )}
        {error ? <Alert variant="destructive">{error}</Alert> : null}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" disabled={saving} onClick={() => setPending(null)}>
            Voltar
          </Button>
          <Button
            autoFocus
            variant={c > 0 ? 'destructive' : 'default'}
            disabled={saving}
            onClick={() => void confirm()}
          >
            {saving
              ? 'Salvando…'
              : c > 0
                ? `Bloquear e cancelar ${c === 1 ? '1 aula' : `${c} aulas`}`
                : 'Confirmar bloqueio'}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        Feriados nacionais sugeridos. Os facultativos vêm desmarcados.
      </p>

      {message ? (
        <Alert variant="success">
          <AlertTitle>Pronto</AlertTitle>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      ) : null}
      {loadError ? <Alert variant="warning">{loadError}</Alert> : null}
      {error ? <Alert variant="destructive">{error}</Alert> : null}

      <div className="max-w-40">
        <FormField label="Ano">
          {(p) => (
            <Select
              {...p}
              value={year}
              onChange={(e) => changeYear(Number(e.target.value))}
            >
              {[...new Set([...yearOptions, year])].sort().map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </Select>
          )}
        </FormField>
      </div>

      <fieldset className="space-y-1">
        <legend className="sr-only">Feriados de {year}</legend>
        <ul className="divide-y rounded-lg border">
          {holidays.map((h) => {
            const existing = blockedOn(h.dateKey, blocked)
            const d = longDate(h.dateKey)
            const id = `fer-${h.dateKey}`
            return (
              <li key={h.dateKey} className="flex items-start gap-3 p-3">
                <input
                  id={id}
                  type="checkbox"
                  className="mt-1 size-4 shrink-0 accent-primary"
                  checked={!existing && effective.has(h.dateKey)}
                  disabled={Boolean(existing)}
                  onChange={() => toggle(h.dateKey)}
                />
                <label htmlFor={id} className="min-w-0 flex-1 text-sm">
                  <span className="block font-medium">{h.name}</span>
                  <span className="block text-muted-foreground">
                    {d.text} · {d.weekday}
                  </span>
                </label>
                <div className="flex flex-wrap justify-end gap-1">
                  {h.optional ? <Badge tone="warning">facultativo</Badge> : null}
                  {existing ? <Badge tone="success">já bloqueado</Badge> : null}
                </div>
              </li>
            )
          })}
        </ul>
      </fieldset>

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Button
          variant="outline"
          disabled={checking || selectable.length === 0}
          onClick={() => void prepare(itemsFor(selectable.map((h) => h.dateKey)))}
        >
          Bloquear todos
        </Button>
        <Button disabled={checking} onClick={() => void prepare(itemsFor(effective))}>
          {checking ? 'Verificando aulas…' : 'Bloquear selecionados'}
        </Button>
      </div>

      <form
        onSubmit={submitManual}
        noValidate
        className="space-y-3 rounded-xl border bg-muted/40 p-4"
        aria-label="Feriado municipal ou pessoal"
      >
        <h3 className="font-semibold">Feriado municipal ou pessoal</h3>
        <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
          <FormField label="Data">
            {(p) => (
              <Input
                {...p}
                type="date"
                value={manualDate}
                onChange={(e) => setManualDate(e.target.value)}
              />
            )}
          </FormField>
          <FormField label="Nome" error={manualError ?? undefined}>
            {(p) => (
              <Input
                {...p}
                value={manualName}
                maxLength={150}
                placeholder="Ex.: Aniversário da cidade"
                onChange={(e) => setManualName(e.target.value)}
              />
            )}
          </FormField>
        </div>
        <div className="flex justify-end">
          <Button type="submit" variant="secondary" disabled={checking}>
            Bloquear esta data
          </Button>
        </div>
      </form>

      <section className="space-y-2" aria-labelledby="fer-bloqueados">
        <h3 id="fer-bloqueados" className="font-semibold">
          Feriados já bloqueados em {year}
        </h3>
        {holidayBlocks.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum feriado bloqueado neste ano.
          </p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {holidayBlocks.map((b) => (
              <li key={b.id} className="flex items-center gap-3 p-3 text-sm">
                <span className="min-w-0 flex-1">
                  <span className="font-medium">{formatDateOnly(b.starts_on)}</span>{' '}
                  <span className="text-muted-foreground">
                    {(b.reason ?? '').replace(HOLIDAY_REASON_PREFIX, '')}
                  </span>
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  aria-label={`Remover bloqueio de ${(b.reason ?? '').replace(HOLIDAY_REASON_PREFIX, '')}, ${formatDateOnly(b.starts_on)}`}
                  onClick={() => setRemoving(b)}
                >
                  Remover
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="flex justify-end">
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          Fechar
        </Button>
      </div>

      {removing ? (
        <ConfirmDialog
          title="Remover bloqueio?"
          description="O dia volta a receber aulas e reposições. Aulas já canceladas por esse bloqueio continuam canceladas (a reposição segue valendo): remover não as reativa."
          confirmLabel="Remover bloqueio"
          onClose={() => setRemoving(null)}
          onConfirm={async () => {
            await deleteBlockedDate(removing.id)
            setMessage('Bloqueio removido.')
            onApplied()
            await refreshBlocked()
          }}
        />
      ) : null}
    </div>
  )
}
