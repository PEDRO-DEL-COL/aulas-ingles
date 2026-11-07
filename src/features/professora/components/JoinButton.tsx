import { Video } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { joinWindowState, safeExternalUrl, type Lesson } from '@/features/aluno/lessons'

/** "Entrar na aula": destacado de 15 min antes até o fim; discreto antes disso. */
export function JoinButton({
  lesson,
  meetLink,
  now,
}: {
  lesson: Pick<Lesson, 'starts_at' | 'duration_minutes'>
  meetLink: string | null
  now: Date
}) {
  const href = safeExternalUrl(meetLink)
  const state = joinWindowState(lesson, now)
  if (state === 'ended') return null
  if (!href) {
    return <p className="text-xs text-muted-foreground">Sem link do Meet cadastrado.</p>
  }
  return (
    <Button asChild variant={state === 'open' ? 'default' : 'outline'}>
      <a href={href} target="_blank" rel="noopener noreferrer">
        <Video aria-hidden="true" />
        Entrar na aula
        <span className="sr-only"> (abre em nova aba)</span>
      </a>
    </Button>
  )
}
