import { X } from 'lucide-react'
import { useEffect } from 'react'

import { cn } from '@/lib/utils'

export type ToastState = {
  id: number
  message: string
  tone?: 'default' | 'error'
  actionLabel?: string
  onAction?: () => void
}

/** Aviso leve (aria-live) com ação opcional, ex.: "Desfazer". Some sozinho. */
export function UndoToast({
  toast,
  onDismiss,
  durationMs = 6000,
}: {
  toast: ToastState | null
  onDismiss: () => void
  durationMs?: number
}) {
  const id = toast?.id
  useEffect(() => {
    if (id === undefined) return
    const t = window.setTimeout(onDismiss, durationMs)
    return () => window.clearTimeout(t)
  }, [id, durationMs, onDismiss])

  return (
    <div
      role={toast?.tone === 'error' ? 'alert' : 'status'}
      aria-live={toast?.tone === 'error' ? 'assertive' : 'polite'}
      className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex justify-center px-4 md:bottom-6"
    >
      {toast ? (
        <div
          className={cn(
            'pointer-events-auto flex max-w-md items-center gap-2 rounded-xl border bg-card py-2 pr-2 pl-4 text-sm shadow-lg',
            toast.tone === 'error' && 'border-destructive/40',
          )}
        >
          <span className="min-w-0 flex-1">{toast.message}</span>
          {toast.actionLabel && toast.onAction ? (
            <button
              type="button"
              onClick={() => {
                toast.onAction?.()
                onDismiss()
              }}
              className="rounded-md px-2 py-1 font-semibold text-primary outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              {toast.actionLabel}
            </button>
          ) : null}
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Fechar aviso"
            className="rounded-md p-1.5 text-muted-foreground outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <X aria-hidden="true" className="size-4" />
          </button>
        </div>
      ) : null}
    </div>
  )
}
