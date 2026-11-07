/**
 * Fonte ÚNICA de marca e conteúdo configurável do site.
 * Tudo marcado como PLACEHOLDER precisa ser revisado pela professora antes de publicar.
 */
import { buildWhatsAppLink } from '@/lib/whatsapp'

/**
 * Paleta da marca (fonte documentada). Os MESMOS valores ficam em src/index.css (:root),
 * que é o que o navegador usa: assim não há flash de tema nem JS no caminho crítico.
 * Ao mudar uma cor, altere aqui e em index.css (brand.test.ts confere que estão iguais
 * e que os pares de texto mantêm contraste AA >= 4.5:1).
 */
export const brandColors = {
  '--background': '#FBF8F3', // creme
  '--foreground': '#2E3045', // azul-ardósia suave (não é preto)
  '--card': '#FFFFFF',
  '--card-foreground': '#2E3045',
  '--popover': '#FFFFFF',
  '--popover-foreground': '#2E3045',
  '--primary': '#5650A0', // lavanda profunda
  '--primary-foreground': '#FFFFFF',
  '--secondary': '#E3EEE6', // verde-sálvia claro
  '--secondary-foreground': '#2E3045',
  '--muted': '#EEEBF8', // lavanda clarinho
  '--muted-foreground': '#5B5E78',
  '--accent': '#FDE6D8', // pêssego
  '--accent-foreground': '#2E3045',
  '--border': '#E3DEEE',
  '--input': '#CFC9E4',
  '--ring': '#7B74C9',
  '--sky': '#E4EFFA', // céu claro (fundos)
  '--peach': '#FDE6D8',
  '--sage': '#E3EEE6',
  '--lavender': '#EEEBF8',
  '--peach-text': '#9A4A1E', // pêssego escuro, texto sobre creme/pêssego
  '--sage-text': '#2F6B55', // sálvia escuro, texto sobre creme/sálvia
  '--success': '#2F6F4F',
  '--success-foreground': '#FFFFFF',
  '--warning': '#7A5200', // âmbar escuro (texto)
  '--warning-soft': '#FFF0CC', // fundo de aviso
  '--destructive': '#B3372F',
  '--destructive-foreground': '#FFFFFF',
} as const

const whatsappNumber = (import.meta.env.VITE_WHATSAPP_NUMBER ?? '').trim()
const whatsappMessage =
  'Olá! Vi o site e gostaria de agendar uma aula experimental de inglês.'

if (import.meta.env.DEV && !whatsappNumber) {
  console.warn(
    '[brand] VITE_WHATSAPP_NUMBER não definido: os botões de WhatsApp ficam escondidos. Defina no .env.',
  )
}

export type PlanBilling = 'monthly' | 'package' | 'single'

export type Plan = {
  id: string
  name: string
  /** Modelo de cobrança: mensalidade fixa, pacote de aulas ou aula avulsa */
  billing: PlanBilling
  /** Aulas por mês (monthly), aulas no pacote (package) ou 1 (single) */
  lessons: number
  /** Duração de cada aula, em minutos */
  durationMinutes: number
  /** Preço em reais; null = "a combinar" */
  price: number | null
  highlight: boolean
  description: string
  perks: string[]
}

export type Testimonial = {
  id: string
  name: string
  role: string
  text: string
  /** true = texto de exemplo; exibe selo "Exemplo". Remova a flag ao usar depoimento real. */
  placeholder: boolean
}

export type Faq = { question: string; answer: string }

const plans: Plan[] = [
  // PLACEHOLDER: valores de exemplo. Ajustar antes de publicar (price: null = "a combinar").
  {
    id: 'mensalidade',
    name: 'Mensalidade',
    billing: 'monthly',
    lessons: 4,
    durationMinutes: 50,
    price: 280,
    highlight: true,
    description: 'Uma aula por semana, com valor fixo todo mês. Ótimo para criar ritmo.',
    perks: ['Horário fixo na semana', 'Materiais e tarefas na área do aluno'],
  },
  {
    id: 'pacote',
    name: 'Pacote de aulas',
    billing: 'package',
    lessons: 10,
    durationMinutes: 50,
    price: 650,
    highlight: false,
    description: 'Compre um pacote e use as aulas no seu tempo, sem mensalidade.',
    perks: ['Horários combinados a cada aula', 'Saldo de aulas na área do aluno'],
  },
  {
    id: 'avulsa',
    name: 'Aula avulsa',
    billing: 'single',
    lessons: 1,
    durationMinutes: 50,
    price: 85,
    highlight: false,
    description:
      'Para tirar uma dúvida, treinar uma entrevista ou experimentar o jeito de ensinar.',
    perks: ['Sem compromisso', 'Agende quando precisar'],
  },
]

const testimonials: Testimonial[] = [
  // PLACEHOLDER: substituir por depoimentos reais (e remover placeholder: true).
  {
    id: 't1',
    name: '[Nome do aluno]',
    role: 'Analista de marketing',
    text: 'Perdi o medo de falar em reuniões em inglês. As aulas são leves e muito focadas no que eu preciso.',
    placeholder: true,
  },
  {
    id: 't2',
    name: '[Nome do aluno]',
    role: 'Estudante',
    text: 'Gosto de poder rever o resumo e a tarefa de cada aula na área do aluno. Fica tudo organizado.',
    placeholder: true,
  },
  {
    id: 't3',
    name: '[Nome do aluno]',
    role: 'Mãe de aluno de 12 anos',
    text: 'Meu filho espera ansioso pela aula. A professora é paciente e acompanha o progresso de perto.',
    placeholder: true,
  },
]

const faq: Faq[] = [
  {
    question: 'Como funciona a aula experimental?',
    answer:
      'Você chama no WhatsApp, combinamos um horário e fazemos uma conversa online para entender seu nível e seus objetivos. Depois montamos o plano ideal para você.',
  },
  {
    question: 'As aulas são individuais? Preciso instalar algum programa?',
    answer:
      'As aulas são individuais e online, pelo Google Meet, direto no navegador ou no aplicativo do celular. Você recebe um link fixo e usa sempre o mesmo. Não precisa instalar nada.',
  },
  {
    question: 'Preciso de uma conta Google?',
    answer:
      'Sim, para acessar a área do aluno (agenda, materiais e financeiro) você entra com uma conta Google. Se não tiver, dá para criar uma de graça usando o e-mail que você já usa, inclusive de outro provedor.',
  },
  {
    question: 'Para qual nível são as aulas?',
    answer:
      'Do zero ao avançado. O conteúdo é adaptado ao seu nível, ao seu objetivo e ao tempo que você tem disponível.',
  },
  {
    question: 'Como funciona o pagamento?',
    answer:
      'O pagamento é feito por Pix. Na área do aluno você vê o valor, o vencimento e o código Pix copia e cola. A confirmação é feita manualmente pela professora.',
  },
  {
    question: 'E se eu precisar remarcar uma aula?',
    answer:
      'A política de remarcação e cancelamento fica registrada na área do aluno. Avise com antecedência e combinamos uma nova data.',
  },
  {
    question: 'Menores de idade podem ter aulas?',
    answer:
      'Sim, com o consentimento do responsável, que também acompanha o financeiro e o progresso do aluno.',
  },
]

export const brand = {
  name: 'Inglês com [Nome]',
  teacherName: '[Nome da professora]',
  tagline: 'Aulas particulares de inglês online, no seu ritmo',
  description:
    'Aulas particulares de inglês online pelo Google Meet, com plano sob medida, materiais e acompanhamento na área do aluno.',
  /** Opcional, ex.: 'Belo Horizonte, MG'. Vazio = não exibe. */
  city: '',
  /** PLACEHOLDER (usado na página de privacidade) */
  contactEmail: '[e-mail de contato]',
  /** PLACEHOLDER: foro dos termos */
  forum: '[cidade/UF do foro]',
  whatsapp: {
    number: whatsappNumber,
    message: whatsappMessage,
    /** null quando o número não está configurado */
    link: whatsappNumber ? buildWhatsAppLink(whatsappNumber, whatsappMessage) : null,
  },
  /** Redes sociais opcionais: deixe '' para esconder. */
  social: { instagram: '', youtube: '' },
  about: {
    headline: 'Inglês que cabe na sua vida',
    // PLACEHOLDER: substituir pela apresentação real da professora.
    paragraphs: [
      'Sou [Nome da professora], professora de inglês. Ajudo adultos e jovens a ganharem confiança para falar, entender e usar o idioma no trabalho, nos estudos e em viagens.',
      'Cada aluno tem um plano próprio: começamos pelo seu objetivo, conversamos bastante e usamos materiais que fazem sentido para a sua rotina.',
    ],
    highlights: ['Aulas individuais', 'Foco em conversação', 'Todos os níveis'],
  },
  plans,
  testimonials,
  faq,
}

/** Data da última atualização do texto de privacidade e termos (ISO). */
export const LEGAL_LAST_UPDATED = '2026-11-07'
