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
  [
    'reposicoes no mes atingido',
    'Este aluno já atingiu o limite de reposições no mês dessa data. Escolha outro mês.',
  ],
  ['nao tem direito a reposicao', 'A aula de origem não tem direito a reposição.'],
  ['ja tem reposicao', 'Essa aula já tem uma reposição agendada.'],
  ['reposicao deve ser no futuro', 'A reposição precisa ser em uma data e hora futuras.'],
  ['aula realizada nao pode', 'Uma aula realizada não pode ser cancelada.'],
  ['intervalo maximo', 'O intervalo para gerar aulas é de no máximo 366 dias.'],
  ['somente a equipe', 'Somente a equipe pode fazer isso.'],
  ['so aulas canceladas pelo aluno', 'Essa decisão já foi tomada ou não se aplica mais.'],
  ['students_email', 'Já existe um aluno cadastrado com esse e-mail.'],
]

export const GENERIC_ERROR = 'Algo deu errado. Verifique a conexão e tente de novo.'

export function friendlyError(error: unknown, fallback: string = GENERIC_ERROR): string {
  const e = error as ErrorLike
  const msg = (e?.message ?? '').toLowerCase()
  for (const [needle, message] of KNOWN) {
    if (msg.includes(needle)) return message
  }
  if (e?.code === '23505') return 'Já existe um cadastro igual a este.'
  if (e?.code === '42501') return 'Você não tem permissão para fazer isso.'
  if (msg.includes('failed to fetch') || msg.includes('networkerror')) {
    return 'Sem conexão com o servidor. Verifique a internet e tente de novo.'
  }
  return fallback
}
