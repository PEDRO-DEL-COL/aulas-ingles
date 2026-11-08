import { ChevronRight, DatabaseBackup, GraduationCap } from 'lucide-react'
import type { ComponentType } from 'react'
import { Link } from 'react-router'

import { PageHeader } from '@/features/shared/components/StateViews'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'

type Entry = {
  to: string
  title: string
  description: string
  icon: ComponentType<{ className?: string; 'aria-hidden'?: boolean }>
}

const entries: Entry[] = [
  {
    to: '/app/admin/backup',
    title: 'Backup e exportação',
    description: 'Cópia de segurança e exportação dos dados (em breve).',
    icon: DatabaseBackup,
  },
  {
    to: '/app/professora',
    title: 'Área da professora',
    description: 'Agenda, alunos, financeiro e materiais: as telas reais da professora.',
    icon: GraduationCap,
  },
]

export default function Mais() {
  useDocumentTitle('Mais')
  return (
    <div>
      <PageHeader title="Mais" />
      <ul className="space-y-3">
        {entries.map(({ to, title, description, icon: Icon }) => (
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
