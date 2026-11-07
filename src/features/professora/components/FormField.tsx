import { useId, type ReactNode } from 'react'

import { Label } from '@/components/ui/field'

/** Rótulo + controle + ajuda + erro, ligados por ids para leitores de tela. */
export function FormField({
  label,
  error,
  help,
  children,
}: {
  label: string
  error?: string
  help?: ReactNode
  children: (props: {
    id: string
    'aria-invalid': boolean | undefined
    'aria-describedby': string | undefined
  }) => ReactNode
}) {
  const id = useId()
  const helpId = `${id}-help`
  const errorId = `${id}-error`
  const describedBy = [help ? helpId : '', error ? errorId : ''].filter(Boolean).join(' ')
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children({
        id,
        'aria-invalid': error ? true : undefined,
        'aria-describedby': describedBy || undefined,
      })}
      {help ? (
        <div id={helpId} className="text-xs text-muted-foreground">
          {help}
        </div>
      ) : null}
      {error ? (
        <p id={errorId} className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  )
}
