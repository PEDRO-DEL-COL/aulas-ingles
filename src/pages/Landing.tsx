import { Link } from 'react-router'

import { Button } from '@/components/ui/button'

export default function Landing() {
  return (
    <main className="mx-auto flex min-h-svh max-w-3xl flex-col items-start justify-center gap-4 p-6">
      <h1 className="text-4xl font-bold">Inglês com [Nome]</h1>
      <p className="text-muted-foreground">Aulas particulares de inglês online.</p>
      <div className="flex flex-wrap gap-3">
        <Button asChild>
          <Link to="/login">Entrar</Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/privacidade">Privacidade</Link>
        </Button>
      </div>
    </main>
  )
}
