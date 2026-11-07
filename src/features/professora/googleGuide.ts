/** Orientação sobre conta Google (resumo de docs/CONTA-GOOGLE.md), pronta para o WhatsApp. */
export const GOOGLE_ACCOUNT_STEPS: readonly string[] = [
  'Acesse accounts.google.com/signup.',
  'Preencha nome e data de nascimento.',
  'Quando pedir o endereço, escolha "Usar seu endereço de e-mail atual" e digite o seu e-mail.',
  'Confirme o código que o Google enviar para esse e-mail e crie uma senha.',
  'Me mande esse e-mail para eu liberar o seu acesso.',
]

export const GOOGLE_ACCOUNT_URL = 'https://accounts.google.com/signup'

export function googleGuideMessage(studentName?: string): string {
  const first = studentName?.trim().split(/\s+/)[0]
  const greeting = first ? `Oi, ${first}! ` : 'Oi! '
  return [
    `${greeting}Para acessar a área do aluno você precisa de uma conta Google. Se ainda não tiver, dá para criar de graça usando o e-mail que você já usa, sem precisar criar um Gmail:`,
    '',
    ...GOOGLE_ACCOUNT_STEPS.map((s, i) => `${i + 1}. ${s}`),
    '',
    'Se preferir, também pode criar um Gmail novo: é só me mandar o endereço.',
  ].join('\n')
}
