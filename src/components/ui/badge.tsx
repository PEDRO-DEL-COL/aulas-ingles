import { cva, type VariantProps } from 'class-variance-authority'
import * as React from 'react'

import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap',
  {
    variants: {
      tone: {
        info: 'border-transparent bg-sky text-primary',
        success: 'border-transparent bg-sage text-sage-text',
        warning: 'border-transparent bg-warning-soft text-warning',
        destructive: 'border-transparent bg-destructive/10 text-destructive',
        muted: 'border-transparent bg-muted text-muted-foreground',
        outline: 'text-foreground',
      },
    },
    defaultVariants: { tone: 'muted' },
  },
)

function Badge({
  className,
  tone,
  ...props
}: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return (
    <span
      data-slot="badge"
      className={cn(badgeVariants({ tone }), className)}
      {...props}
    />
  )
}

export { Badge }
