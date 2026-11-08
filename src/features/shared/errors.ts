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
  // Admin (migration 20261109000001_admin_area.sql)
  ['proprio acesso de admin', 'Você não pode tirar o seu próprio acesso de admin.'],
  ['pelo menos um admin ativo', 'O sistema precisa de pelo menos um admin ativo.'],
  ['papel responsavel', 'Escolha um papel com acesso: aluno, professora ou admin.'],
  [
    'settings_pix_complete',
    'Para salvar a chave Pix, informe também o tipo da chave, o nome e a cidade do recebedor.',
  ],
  [
    'settings_whatsapp_format',
    'WhatsApp inválido: use só dígitos com DDI e DDD (ex.: 5511999998888).',
  ],
  ['settings_policy_limits', 'Valor fora do limite permitido para a política.'],
  [
    'settings_late_band_lt_min',
    'A faixa intermediária precisa ser menor que o prazo mínimo de cancelamento.',
  ],
  [
    'plans_billing_fields',
    'Mensalidade precisa de aulas por mês; pacote precisa da quantidade de aulas.',
  ],
  // Financeiro (migrations 20261110000001 e 20261111000001)
  [
    'invoices_billing_fields',
    'Mensalidade precisa do mês de referência; pacote precisa da quantidade de aulas.',
  ],
  ['invoices_monthly_unique', 'Já existe uma mensalidade deste aluno para esse mês.'],
  ['invoices_pix_txid', 'Identificador do Pix inválido: use até 25 letras ou números.'],
  // Mensalidades em lote (migration 20261114000001)
  [
    'somente a equipe gera mensalidades',
    'Somente a professora ou o admin geram mensalidades.',
  ],
  ['dia de vencimento invalido', 'Escolha um dia de vencimento entre 1 e 31.'],
  ['informe o mes de referencia', 'Escolha o mês de referência.'],
  // Vantagens e vencimento (migration 15)
  ['benefits_label_key', 'Essa vantagem já está cadastrada.'],
  ['settings_default_due_day', 'O dia de vencimento deve ser entre 1 e 31.'],
  // Disponibilidade (migration 16)
  [
    'reposicao em ferias ou feriado',
    'Essa data está em férias ou feriado. Escolha outra data para a reposição.',
  ],
  [
    'reposicao fora da disponibilidade',
    'Esse horário está fora da disponibilidade da professora. Escolha um horário disponível.',
  ],
  ['availability_slots_range', 'O horário final precisa ser depois do inicial.'],
  // Interessados (migration 17)
  [
    'interessado ja enviado',
    'Recebemos o seu contato há pouco. A professora vai responder em breve.',
  ],
  ['muitos envios', 'Muitos envios no momento. Tente de novo em alguns minutos.'],
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
