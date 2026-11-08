import { FileSpreadsheet, Plus, UserCheck } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input, Label, Select } from '@/components/ui/field'
import { Skeleton } from '@/components/ui/skeleton'
import type { StudentRecord } from '@/features/aluno/lessons'
import { listStudents } from '@/features/professora/api'
import { filterStudents } from '@/features/professora/studentForm'
import { EmptyState, ErrorState } from '@/features/shared/components/StateViews'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useQuery } from '@/lib/data/useQuery'

type StatusFilter = StudentRecord['status'] | 'todos'

const STATUS_LABEL: Record<StudentRecord['status'], string> = {
  ativo: 'Ativo',
  pausado: 'Pausado',
  saiu: 'Saiu',
}

export default function Alunos() {
  useDocumentTitle('Alunos')
  const students = useQuery('prof-alunos', listStudents)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<StatusFilter>('ativo')

  const filtered = students.data ? filterStudents(students.data, search, status) : []

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Alunos</h1>
        <div className="flex flex-wrap justify-end gap-2">
          <Button asChild variant="outline">
            <Link to="/app/professora/planilhas">
              <FileSpreadsheet aria-hidden="true" />
              Importar planilha
            </Link>
          </Button>
          <Button asChild>
            <Link to="/app/professora/alunos/novo">
              <Plus aria-hidden="true" />
              Novo aluno
            </Link>
          </Button>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-[1fr_12rem]">
        <div className="space-y-1.5">
          <Label htmlFor="busca">Buscar por nome ou e-mail</Label>
          <Input
            id="busca"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="situacao">Situação</Label>
          <Select
            id="situacao"
            value={status}
            onChange={(e) => setStatus(e.target.value as StatusFilter)}
          >
            <option value="todos">Todas</option>
            <option value="ativo">Ativos</option>
            <option value="pausado">Pausados</option>
            <option value="saiu">Saíram</option>
          </Select>
        </div>
      </div>

      {students.error ? (
        <ErrorState error={students.error} onRetry={students.refetch} />
      ) : !students.data ? (
        <div role="status" className="space-y-3">
          <span className="sr-only">Carregando…</span>
          <Skeleton className="h-16 w-full rounded-xl" />
          <Skeleton className="h-16 w-full rounded-xl" />
          <Skeleton className="h-16 w-full rounded-xl" />
        </div>
      ) : students.data.length === 0 ? (
        <EmptyState title="Nenhum aluno cadastrado">
          Toque em &quot;Novo aluno&quot; para criar a primeira ficha.
        </EmptyState>
      ) : filtered.length === 0 ? (
        <EmptyState title="Nenhum aluno encontrado">
          Tente outra busca ou mude a situação.
        </EmptyState>
      ) : (
        <ul className="space-y-2">
          {filtered.map((s) => (
            <li key={s.id}>
              <Link
                to={`/app/professora/alunos/${s.id}`}
                className="flex items-center justify-between gap-3 rounded-xl border bg-card p-3 shadow-sm outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{s.full_name}</span>
                  <span className="block truncate text-sm text-muted-foreground">
                    {s.email}
                  </span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1">
                  <Badge
                    tone={
                      s.status === 'ativo'
                        ? 'success'
                        : s.status === 'pausado'
                          ? 'warning'
                          : 'muted'
                    }
                  >
                    {STATUS_LABEL[s.status]}
                  </Badge>
                  {s.profile_id ? null : (
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <UserCheck aria-hidden="true" className="size-3" />
                      aguardando login
                    </span>
                  )}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
