import { useState } from 'react'

import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'

/** Confirmação de ação destrutiva. `onConfirm` lança erro (mensagem amigável) se falhar. */
export function ConfirmDialog({
  title,
  description,
  confirmLabel,
  onConfirm,
  onClose,
}: {
  title: string
  description: string
  confirmLabel: string
  onConfirm: () => Promise<void>
  onClose: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function confirm() {
    setBusy(true)
    setError(null)
    try {
      await onConfirm()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível concluir.')
      setBusy(false)
    }
  }

  return (
    <Dialog open onClose={onClose} title={title} dismissible={!busy}>
      <p className="text-sm">{description}</p>
      {error ? <Alert variant="destructive">{error}</Alert> : null}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="outline" disabled={busy} onClick={onClose}>
          Cancelar
        </Button>
        <Button variant="destructive" disabled={busy} onClick={() => void confirm()}>
          {busy ? 'Aguarde…' : confirmLabel}
        </Button>
      </div>
    </Dialog>
  )
}
