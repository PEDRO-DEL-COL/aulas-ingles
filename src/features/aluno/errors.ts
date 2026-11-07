/** Converte erros do Supabase/Postgres em mensagens amigáveis em pt-BR. */

type ErrorLike = { message?: string; code?: string } | null | undefined

const KNOWN: readonly [needle: string, message: string][] = [
  ['ja comecou', 'Essa aula já começou e não pode mais ser cancelada.'],
  [
    'so aulas agendadas',
    'Só aulas agendadas ou reposições podem ser canceladas. Atualize a página.',
  ],
  ['aula nao encontrada', 'Aula não encontrada. Atualize a página e tente de novo.'],
  [
    'cobranca nao encontrada',
    'Cobrança não encontrada ou já encerrada. Atualize a página.',
  ],
  ['acesso nao liberado', 'Seu acesso ainda não foi liberado.'],
]

export const GENERIC_ERROR = 'Algo deu errado. Verifique a conexão e tente de novo.'

export function friendlyError(error: unknown, fallback: string = GENERIC_ERROR): string {
  const e = error as ErrorLike
  const msg = (e?.message ?? '').toLowerCase()
  for (const [needle, message] of KNOWN) {
    if (msg.includes(needle)) return message
  }
  if (e?.code === '42501') return 'Você não tem permissão para fazer isso.'
  if (msg.includes('failed to fetch') || msg.includes('networkerror')) {
    return 'Sem conexão com o servidor. Verifique a internet e tente de novo.'
  }
  return fallback
}
