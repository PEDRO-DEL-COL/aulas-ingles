import { AppShell } from '@/components/app/AppShell'
import { Greeting } from '@/components/app/Greeting'

export default function AlunoArea() {
  return (
    <AppShell>
      <Greeting />
      <p className="mt-2 text-muted-foreground">Área do aluno em construção.</p>
    </AppShell>
  )
}
