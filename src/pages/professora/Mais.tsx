import { CalendarOff, ChevronRight, FolderOpen, ShieldCheck } from 'lucide-react'
import type { ComponentType } from 'react'
import { Link } from 'react-router'

import { PageHeader } from '@/features/shared/components/StateViews'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useAuth } from '@/lib/auth/useAuth'

type Entry = {
  to: string
  title: string
  description: string
  icon: ComponentType<{ className?: string; 'aria-hidden'?: boolean }>
}

const entries: Entry[] = [
  {
    to: '/app/professora/materiais',
    title: 'Materiais',
    description: 'Links do Drive para todos os alunos, um aluno ou uma aula.',
    icon: FolderOpen,
  },
  {
    to: '/app/professora/feriados',
    title: 'Férias e feriados',
    description: 'Dias sem aula: a geração de aulas recorrentes pula essas datas.',
    icon: CalendarOff,
  },
]

const adminEntry: Entry = {
  to: '/app/admin',
  title: 'Administração',
  description: 'Usuários, planos e valores, políticas, Pix e contato.',
  icon: ShieldCheck,
}

export default function Mais() {
  useDocumentTitle('Mais')
  const { profile } = useAuth()
  const list = profile?.role === 'admin' ? [...entries, adminEntry] : entries

  return (
    <div>
      <PageHeader title="Mais" />
      <ul className="space-y-3">
        {list.map(({ to, title, description, icon: Icon }) => (
          <li key={to}>
            <Link
              to={to}
              className="flex items-center gap-3 rounded-xl border bg-card p-4 transition-colors outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              <Icon aria-hidden={true} className="size-5 shrink-0 text-primary" />
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{title}</span>
                <span className="block text-sm text-muted-foreground">{description}</span>
              </span>
              <ChevronRight aria-hidden={true} className="size-4 shrink-0" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
