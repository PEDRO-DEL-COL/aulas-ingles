import { Clock, Video } from 'lucide-react'
import { useCallback } from 'react'

import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useAluno } from '@/features/aluno/AlunoContext'
import { formatCountdown, getCountdown, tickIntervalMs } from '@/features/aluno/countdown'
import { formatDateTimeLong } from '@/features/aluno/datetime'
import {
  JOIN_EARLY_MINUTES,
  joinWindowState,
  resolveMeetLink,
  safeExternalUrl,
  type Lesson,
} from '@/features/aluno/lessons'
import { useNow } from '@/features/aluno/useNow'
import { cn } from '@/lib/utils'

import { LessonStatusBadge } from './StatusBadges'

export function NextLessonCard({ lesson }: { lesson: Lesson }) {
  const { student, timezone } = useAluno()
  const delayFor = useCallback(
    (n: Date) => tickIntervalMs(getCountdown(lesson.starts_at, n)),
    [lesson.starts_at],
  )
  const now = useNow(delayFor)

  const countdown = getCountdown(lesson.starts_at, now)
  const join = joinWindowState(lesson, now)
  const link = safeExternalUrl(resolveMeetLink(lesson, student))
  const open = join === 'open'

  return (
    <Card className={cn(open && 'border-primary ring-2 ring-primary/30')}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-muted-foreground">Próxima aula</p>
        <LessonStatusBadge status={lesson.status} />
      </div>
      <p className="text-xl leading-snug font-bold first-letter:uppercase">
        {formatDateTimeLong(lesson.starts_at, timezone)}
      </p>
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Clock aria-hidden="true" className="size-4" />
        {countdown.started ? 'Em andamento' : `Começa em ${formatCountdown(countdown)}`}
        {' · '}
        {lesson.duration_minutes} min
      </p>

      {link ? (
        open ? (
          <Button asChild size="lg" className="h-14 w-full text-base">
            <a href={link} target="_blank" rel="noopener noreferrer">
              <Video aria-hidden="true" className="size-5" />
              Entrar na aula
            </a>
          </Button>
        ) : (
          <>
            <Button
              size="lg"
              variant="secondary"
              className="h-14 w-full text-base"
              disabled
            >
              <Video aria-hidden="true" className="size-5" />
              Entrar na aula
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              O botão aparece {JOIN_EARLY_MINUTES} minutos antes
            </p>
          </>
        )
      ) : (
        <Alert variant="warning">
          O link da aula ainda não foi cadastrado. Fale com a professora para receber o
          link do Meet.
        </Alert>
      )}
    </Card>
  )
}
