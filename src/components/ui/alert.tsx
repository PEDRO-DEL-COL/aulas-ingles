import { cva, type VariantProps } from 'class-variance-authority'
import * as React from 'react'

import { cn } from '@/lib/utils'

const alertVariants = cva('relative w-full rounded-lg border p-3 text-sm', {
  variants: {
    variant: {
      default: 'bg-card text-card-foreground',
      info: 'border-transparent bg-sky text-foreground',
      success: 'border-transparent bg-sage text-sage-text',
      warning: 'border-transparent bg-warning-soft text-warning',
      destructive: 'border-destructive/30 bg-destructive/10 text-destructive',
    },
  },
  defaultVariants: { variant: 'default' },
})

function Alert({
  className,
  variant,
  ...props
}: React.ComponentProps<'div'> & VariantProps<typeof alertVariants>) {
  return (
    <div
      role="alert"
      data-slot="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  )
}

function AlertTitle({ className, ...props }: React.ComponentProps<'p'>) {
  return <p className={cn('font-semibold', className)} {...props} />
}

function AlertDescription({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('leading-relaxed', className)} {...props} />
}

export { Alert, AlertDescription, AlertTitle }
