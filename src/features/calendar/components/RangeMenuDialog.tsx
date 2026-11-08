import { Ban, Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'

import { capitalize, longDayLabel, rangeLabel } from '../calendarUi'
import type { Range } from '../engine'

/** Menu exibido depois de arrastar sobre horas vazias da semana. */
export function RangeMenuDialog({
  selection,
  busy,
  onClose,
  onChoose,
}: {
  selection: { dateKey: string; range: Range } | null
  busy: boolean
  onClose: () => void
  onChoose: (kind: 'bloqueio' | 'extra') => void
}) {
  return (
    <Dialog
      open={selection !== null}
      onClose={onClose}
      title={
        selection
          ? `${capitalize(longDayLabel(selection.dateKey))}, ${rangeLabel(selection.range)}`
          : 'Horário'
      }
    >
      <div className="grid gap-2">
        <Button variant="outline" disabled={busy} onClick={() => onChoose('bloqueio')}>
          <Ban aria-hidden="true" />
          Bloquear este horário
        </Button>
        <Button variant="outline" disabled={busy} onClick={() => onChoose('extra')}>
          <Plus aria-hidden="true" />
          Adicionar horário extra
        </Button>
        <Button variant="ghost" onClick={onClose}>
          Cancelar
        </Button>
      </div>
    </Dialog>
  )
}
