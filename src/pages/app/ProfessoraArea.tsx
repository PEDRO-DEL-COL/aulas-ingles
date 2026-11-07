import { AppShell } from '@/components/app/AppShell'
import { Greeting } from '@/components/app/Greeting'

export default function ProfessoraArea() {
  return (
    <AppShell>
      <Greeting />
      <p className="mt-2 text-muted-foreground">Área da professora em construção.</p>
    </AppShell>
  )
}
