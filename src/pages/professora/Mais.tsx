import {
  ChevronRight,
  FileSpreadsheet,
  FolderOpen,
  ShieldCheck,
  User,
  UserPlus,
} from 'lucide-react'
import type { ComponentType } from 'react'
import { Link } from 'react-router'

import { PageHeader } from '@/features/shared/components/StateViews'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useViewAs } from '@/lib/auth/useViewAs'

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
    to: '/app/professora/planilhas',
    title: 'Planilhas',
    description: 'Importar alunos de uma planilha e exportar alunos, aulas e pagamentos.',
    icon: FileSpreadsheet,
  },
  {
    to: '/app/professora/interessados',
    title: 'Interessados',
    description: 'Quem pediu uma aula experimental pela landing.',
    icon: UserPlus,
  },
  {
    to: '/app/professora/perfil',
    title: 'Meu perfil',
    description: 'Seus dados e preferências (em breve).',
    icon: User,
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
  const { role } = useViewAs()
  const list = role === 'admin' ? [...entries, adminEntry] : entries

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
