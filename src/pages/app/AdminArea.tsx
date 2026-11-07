import { AppShell } from '@/components/app/AppShell'
import { Greeting } from '@/components/app/Greeting'

export default function AdminArea() {
  return (
    <AppShell>
      <Greeting />
      <p className="mt-2 text-muted-foreground">Área administrativa em construção.</p>
    </AppShell>
  )
}
