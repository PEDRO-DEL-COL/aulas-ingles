import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import type { LessonWithStudent } from '@/features/professora/lessons'
import { formatDateOnly } from '@/features/shared/datetime'

import type { DayChange } from '../engine'
import { formatRanges, pluralize, type PreviewWindow } from '../wizard'
import { ConflictLessonList } from './ConflictLessonList'

/** Passo final: resumo em texto, dias disponíveis, dias que mudam e aulas fora do horário. */
export function WizardPreview({
  summary,
  window,
  availableDays,
  changes,
  isEdit,
  lessons,
  lessonsLoading,
  lessonsError,
  outside,
  timezone,
  onReview,
}: {
  summary: string
  window: PreviewWindow | null
  availableDays: number
  changes: DayChange[]
  isEdit: boolean
  lessons: LessonWithStudent[]
  lessonsLoading: boolean
  lessonsError: string | null
  outside: LessonWithStudent[]
  timezone: string
  onReview: () => void
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-muted/40 p-3">
        <p className="text-xs font-medium text-muted-foreground uppercase">Resumo</p>
        <p className="mt-1 text-sm font-medium">{summary}</p>
      </div>

      {window ? (
        <ul className="space-y-1 text-sm" aria-label="Efeito do horário">
          <li>
            <strong>
              {pluralize(availableDays, 'dia disponível', 'dias disponíveis')}
            </strong>{' '}
            entre {formatDateOnly(window.from)} e {formatDateOnly(window.to)}
            {window.truncated ? ' (a prévia olha até 400 dias à frente)' : ''}.
          </li>
          {isEdit ? (
            <li>
              <strong>{pluralize(changes.length, 'dia muda', 'dias mudam')}</strong> de
              horário nesse período.
            </li>
          ) : null}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">
          Essa vigência já terminou: não há dias futuros para conferir.
        </p>
      )}

      {isEdit && changes.length > 0 ? (
        <details className="rounded-lg border text-sm">
          <summary className="cursor-pointer p-2.5 font-medium">
            Ver os primeiros dias que mudam
          </summary>
          <ul className="divide-y border-t">
            {changes.slice(0, 6).map((c) => (
              <li key={c.dateKey} className="p-2.5">
                <span className="font-medium">{formatDateOnly(c.dateKey)}</span>
                <span className="block text-muted-foreground">
                  antes: {c.before.length > 0 ? formatRanges(c.before) : 'sem horário'}
                  {' · '}
                  depois: {c.after.length > 0 ? formatRanges(c.after) : 'sem horário'}
                </span>
              </li>
            ))}
          </ul>
          {changes.length > 6 ? (
            <p className="border-t p-2.5 text-xs text-muted-foreground">
              e mais {changes.length - 6} dias.
            </p>
          ) : null}
        </details>
      ) : null}

      <div aria-live="polite" className="space-y-2">
        {lessonsLoading ? (
          <p className="text-sm text-muted-foreground">
            Conferindo as aulas já agendadas…
          </p>
        ) : lessonsError ? (
          <Alert variant="warning">
            {lessonsError} Confira a agenda depois de salvar.
          </Alert>
        ) : outside.length > 0 ? (
          <>
            <Alert variant="warning">
              {pluralize(
                outside.length,
                'aula já agendada ficaria fora do horário',
                'aulas já agendadas ficariam fora do horário',
              )}
              . Elas <strong>não são canceladas automaticamente</strong>: ao salvar, você
              escolhe manter ou cancelar (com reposição).
            </Alert>
            <ConflictLessonList
              lessons={outside}
              timezone={timezone}
              label="Aulas fora do novo horário"
              limit={5}
            />
            <Button type="button" size="sm" variant="outline" onClick={onReview}>
              Salvar e escolher o que fazer com elas
            </Button>
          </>
        ) : window ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma aula agendada fica fora do horário
            {lessons.length > 0
              ? ` (${pluralize(lessons.length, 'aula conferida', 'aulas conferidas')}).`
              : '.'}
          </p>
        ) : null}
      </div>
    </div>
  )
}
