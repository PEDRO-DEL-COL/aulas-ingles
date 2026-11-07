import * as React from 'react'

import { cn } from '@/lib/utils'

const control =
  'w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-60 read-only:bg-muted'

function Label({ className, ...props }: React.ComponentProps<'label'>) {
  return (
    <label className={cn('text-sm leading-none font-medium', className)} {...props} />
  )
}

function Input({ className, ...props }: React.ComponentProps<'input'>) {
  return <input className={cn(control, 'h-10', className)} {...props} />
}

function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return <textarea className={cn(control, 'min-h-20', className)} {...props} />
}

function Select({ className, ...props }: React.ComponentProps<'select'>) {
  return <select className={cn(control, 'h-10', className)} {...props} />
}

export { Input, Label, Select, Textarea }
