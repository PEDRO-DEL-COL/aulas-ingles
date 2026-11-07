import { useEffect, useId, useRef, type ReactNode } from 'react'

import { cn } from '@/lib/utils'

/**
 * Diálogo modal sobre o <dialog> nativo: foco preso, Esc fecha, foco volta ao
 * elemento que abriu. `onClose` é chamado ao pressionar Esc ou clicar fora.
 */
export function Dialog({
  open,
  onClose,
  title,
  children,
  className,
  dismissible = true,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  className?: string
  /** false bloqueia Esc e clique fora (ex.: enquanto envia). */
  dismissible?: boolean
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (open && !el.open) el.showModal()
    if (!open && el.open) el.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault()
        if (dismissible) onClose()
      }}
      onClick={(e) => {
        if (dismissible && e.target === e.currentTarget) onClose()
      }}
      className={cn(
        'm-auto w-[calc(100%-2rem)] max-w-md rounded-xl border bg-card p-0 text-card-foreground shadow-lg backdrop:bg-foreground/50',
        className,
      )}
    >
      {open ? (
        <div className="flex flex-col gap-4 p-5">
          <h2 id={titleId} className="text-lg font-semibold">
            {title}
          </h2>
          {children}
        </div>
      ) : null}
    </dialog>
  )
}
