import { TriangleAlert } from 'lucide-react'
import { Link } from 'react-router'

import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'

export const PATTERN_PANEL_PATH = '/app/professora/calendario?painel=horario'

/**
 * Aviso forte e persistente: sem horário padrão ativo o banco aceita qualquer horário
 * (fora férias/feriados). Com `onDefine` abre o painel direto; sem ele, navega para ele.
 */
export function NoPatternAlert({ onDefine }: { onDefine?: () => void }) {
  return (
    <Alert
      variant="warning"
      className="flex flex-col gap-3 border-2 border-warning sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex min-w-0 gap-2">
        <TriangleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
        <div className="space-y-1">
          <p className="font-semibold">Você ainda não definiu o horário padrão</p>
          <p className="leading-relaxed">
            Sem horário padrão, o sistema aceita qualquer horário de aula, só evitando
            férias e feriados. Depois de definido, o horário padrão passa a ser a regra de
            todas as aulas: novas, remarcadas e geradas pelos horários fixos.
          </p>
        </div>
      </div>
      {onDefine ? (
        <Button className="shrink-0" onClick={onDefine}>
          Definir horário padrão
        </Button>
      ) : (
        <Button asChild className="shrink-0">
          <Link to={PATTERN_PANEL_PATH}>Definir horário padrão</Link>
        </Button>
      )}
    </Alert>
  )
}
