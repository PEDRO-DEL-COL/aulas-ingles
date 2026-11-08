import { useEffect, useRef } from 'react'

import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'

import type { ConflictDialogProps } from './contracts'
import { ConflictLessonList } from './ConflictLessonList'

/** Lista as aulas afetadas e deixa escolher: manter, cancelar (com reposição) ou voltar. */
export function ConflictDialog({
  open,
  title,
  description,
  lessons,
  timezone,
  busy = false,
  onResolve,
}: ConflictDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={() => onResolve('desfazer')}
      title={title}
      dismissible={!busy}
    >
      <ConflictBody
        description={description}
        lessons={lessons}
        timezone={timezone}
        busy={busy}
        onResolve={onResolve}
      />
    </Dialog>
  )
}

function ConflictBody({
  description,
  lessons,
  timezone,
  busy,
  onResolve,
}: Pick<ConflictDialogProps, 'description' | 'lessons' | 'timezone' | 'onResolve'> & {
  busy: boolean
}) {
  const backRef = useRef<HTMLButtonElement>(null)
  const count = lessons.length

  // Foco inicial na opção segura (voltar), depois que o <dialog> abre.
  useEffect(() => {
    const t = setTimeout(() => backRef.current?.focus(), 0)
    return () => clearTimeout(t)
  }, [])

  return (
    <div className="space-y-4" aria-busy={busy}>
      {description ? <p className="text-sm">{description}</p> : null}
      <p className="text-sm font-medium">
        {count === 1 ? '1 aula afetada' : `${count} aulas afetadas`}
      </p>
      <ConflictLessonList lessons={lessons} timezone={timezone} label="Aulas afetadas" />
      <p className="text-xs text-muted-foreground">
        Cancelar marca as aulas como &quot;cancelada pela professora&quot;, com direito a
        reposição. Manter deixa as aulas como estão.
      </p>
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
        <Button
          ref={backRef}
          variant="outline"
          disabled={busy}
          onClick={() => onResolve('desfazer')}
        >
          Voltar sem alterar
        </Button>
        <Button variant="secondary" disabled={busy} onClick={() => onResolve('manter')}>
          Manter aulas
        </Button>
        <Button
          variant="destructive"
          disabled={busy}
          onClick={() => onResolve('cancelar')}
        >
          {busy ? 'Aguarde…' : 'Cancelar aulas (com reposição)'}
        </Button>
      </div>
    </div>
  )
}
