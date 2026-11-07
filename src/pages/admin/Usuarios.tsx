import { useState } from 'react'

import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input, Label, Select } from '@/components/ui/field'
import {
  canChangeAccess,
  filterProfiles,
  listProfiles,
  roleLabel,
  SELECTABLE_ROLES,
  updateProfileAccess,
  type AccessPatch,
  type ProfileRow,
  type SelectableRole,
  type UserFilter,
} from '@/features/admin/users'
import { ConfirmDialog } from '@/features/professora/components/ConfirmDialog'
import {
  EmptyState,
  ErrorState,
  ListSkeleton,
  PageHeader,
} from '@/features/shared/components/StateViews'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useAuth } from '@/lib/auth/useAuth'
import { useQuery } from '@/lib/data/useQuery'

type Pending = { target: ProfileRow; patch: AccessPatch }

const ROLE_EFFECT: Record<SelectableRole, string> = {
  aluno:
    'A pessoa passa a ver apenas a área do aluno (precisa estar ativa e ter ficha de aluno).',
  professora:
    'A pessoa passa a acessar a agenda, os alunos e os materiais da professora.',
  admin:
    'Promover a admin dá acesso a configurações, planos, Pix e usuários. Faça isso só com quem você confia.',
}

function describe(p: Pending): { title: string; description: string; confirm: string } {
  const name = p.target.full_name || p.target.email
  if (p.patch.role) {
    return {
      title: `Mudar papel para ${roleLabel(p.patch.role)}?`,
      description: `${name}: ${ROLE_EFFECT[p.patch.role]}`,
      confirm: 'Mudar papel',
    }
  }
  if (p.patch.active) {
    return {
      title: 'Ativar acesso?',
      description: `${name} poderá entrar no app com o papel ${roleLabel(p.target.role)}.`,
      confirm: 'Ativar',
    }
  }
  return {
    title: 'Desativar acesso?',
    description: `${name} perde o acesso ao app. Desativar bloqueia o acesso no próximo carregamento da página.`,
    confirm: 'Desativar',
  }
}

export default function Usuarios() {
  useDocumentTitle('Usuários e acessos')
  const { profile: me, refreshProfile } = useAuth()
  const users = useQuery('admin-usuarios', listProfiles)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<UserFilter>('todos')
  const [pending, setPending] = useState<Pending | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const all = users.data ?? []
  const filtered = filterProfiles(all, search, filter)

  async function apply(p: Pending) {
    setActionError(null)
    try {
      await updateProfileAccess(p.target.id, p.patch)
      if (me && p.target.id === me.id) await refreshProfile()
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Não foi possível salvar.')
      throw e
    } finally {
      users.refetch()
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Usuários e acessos"
        description="As pessoas aparecem aqui depois do primeiro login com Google. Alunos são liberados automaticamente quando a professora cadastra o e-mail na ficha. Aqui você ativa ou desativa o acesso e troca o papel."
      />

      {actionError ? <Alert variant="destructive">{actionError}</Alert> : null}

      <div className="grid gap-3 sm:grid-cols-[1fr_14rem]">
        <div className="space-y-1.5">
          <Label htmlFor="busca-usuarios">Buscar por nome ou e-mail</Label>
          <Input
            id="busca-usuarios"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="filtro-usuarios">Mostrar</Label>
          <Select
            id="filtro-usuarios"
            value={filter}
            onChange={(e) => setFilter(e.target.value as UserFilter)}
          >
            <option value="todos">Todos</option>
            <option value="ativos">Ativos</option>
            <option value="inativos">Inativos</option>
            <option value="aluno">Alunos</option>
            <option value="professora">Professoras</option>
            <option value="admin">Admins</option>
            <option value="responsavel">Sem acesso (responsável)</option>
          </Select>
        </div>
      </div>

      {users.error ? (
        <ErrorState error={users.error} onRetry={users.refetch} />
      ) : !users.data ? (
        <ListSkeleton />
      ) : all.length === 0 ? (
        <EmptyState title="Nenhum usuário ainda">
          As pessoas aparecem aqui depois do primeiro login com Google.
        </EmptyState>
      ) : filtered.length === 0 ? (
        <EmptyState title="Nenhum usuário encontrado">
          Tente outra busca ou mude o filtro.
        </EmptyState>
      ) : (
        <ul className="space-y-3">
          {filtered.map((u) => {
            const check = canChangeAccess(u, me, all)
            const isMe = u.id === me?.id
            const needsSetup = u.role === 'responsavel' || (!u.active && !isMe)
            const roleId = `papel-${u.id}`
            return (
              <li
                key={u.id}
                className="space-y-3 rounded-xl border bg-card p-3 shadow-sm"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold">
                    {u.full_name || 'Sem nome'}
                    {isMe ? (
                      <span className="font-normal text-muted-foreground"> (você)</span>
                    ) : null}
                  </p>
                  <p className="truncate text-sm text-muted-foreground">{u.email}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={u.role === 'admin' ? 'info' : 'outline'}>
                    {roleLabel(u.role)}
                  </Badge>
                  <Badge tone={u.active ? 'success' : 'muted'}>
                    {u.active ? 'Ativo' : 'Inativo'}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {u.terms_accepted_at ? 'Termos aceitos' : 'Termos pendentes'}
                  </span>
                </div>

                {needsSetup && check.ok ? (
                  <p className="text-xs text-muted-foreground">
                    Para liberar esta pessoa, escolha um papel (aluno, professora ou
                    admin) e ative o acesso.
                  </p>
                ) : null}

                <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                  <div className="space-y-1.5 sm:w-56">
                    <Label htmlFor={roleId}>Papel de {u.full_name || u.email}</Label>
                    <Select
                      id={roleId}
                      value={u.role === 'responsavel' ? '' : u.role}
                      disabled={!check.ok}
                      onChange={(e) => {
                        const role = e.target.value as SelectableRole
                        if (role && role !== u.role) {
                          setActionError(null)
                          setPending({ target: u, patch: { role } })
                        }
                      }}
                    >
                      {u.role === 'responsavel' ? (
                        <option value="" disabled>
                          Escolher papel…
                        </option>
                      ) : null}
                      {SELECTABLE_ROLES.map((r) => (
                        <option key={r} value={r}>
                          {roleLabel(r)}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <Button
                    variant={u.active ? 'outline' : 'default'}
                    disabled={!check.ok}
                    onClick={() => {
                      setActionError(null)
                      setPending({ target: u, patch: { active: !u.active } })
                    }}
                  >
                    {u.active ? 'Desativar' : 'Ativar'}
                    <span className="sr-only"> {u.full_name || u.email}</span>
                  </Button>
                </div>
                {!check.ok ? (
                  <p className="text-xs text-muted-foreground">{check.reason}</p>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}

      <p className="text-sm text-muted-foreground">
        Excluir a conta de login de verdade é feito no painel do Supabase (Authentication
        &gt; Users).
      </p>

      {pending ? (
        <ConfirmDialog
          {...(() => {
            const d = describe(pending)
            return {
              title: d.title,
              description: d.description,
              confirmLabel: d.confirm,
            }
          })()}
          onConfirm={() => apply(pending)}
          onClose={() => setPending(null)}
        />
      ) : null}
    </div>
  )
}
