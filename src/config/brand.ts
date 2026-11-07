/**
 * Fonte ÚNICA de marca e conteúdo configurável do site.
 * Tudo marcado como PLACEHOLDER precisa ser revisado pela professora antes de publicar.
 */
import { buildWhatsAppLink } from '@/lib/whatsapp'

/**
 * Cores do tema. Aplicadas como variáveis CSS em :root por applyBrandTheme() (main.tsx).
 * Os mesmos valores aparecem em src/index.css apenas como padrão antes do JS carregar.
 */
export const brandColors = {
  '--background': 'oklch(0.975 0.016 85)', // creme
  '--foreground': 'oklch(0.25 0.035 200)', // verde-azulado muito escuro
  '--card': 'oklch(0.99 0.01 85)',
  '--card-foreground': 'oklch(0.25 0.035 200)',
  '--popover': 'oklch(0.99 0.01 85)',
  '--popover-foreground': 'oklch(0.25 0.035 200)',
  '--primary': 'oklch(0.42 0.075 195)', // verde-azulado profundo
  '--primary-foreground': 'oklch(0.98 0.012 85)',
  '--secondary': 'oklch(0.94 0.025 85)',
  '--secondary-foreground': 'oklch(0.3 0.04 200)',
  '--muted': 'oklch(0.945 0.022 85)',
  '--muted-foreground': 'oklch(0.45 0.03 200)',
  '--accent': 'oklch(0.93 0.035 70)',
  '--accent-foreground': 'oklch(0.3 0.04 200)',
  '--border': 'oklch(0.87 0.03 80)',
  '--input': 'oklch(0.87 0.03 80)',
  '--ring': 'oklch(0.55 0.1 195)',
  '--coral': 'oklch(0.7 0.15 42)', // destaque decorativo (não usar como cor de texto)
  '--coral-text': 'oklch(0.5 0.15 38)', // coral escuro, contraste AA sobre creme
  '--sand': 'oklch(0.92 0.04 78)', // fundo de seções alternadas
} as const

export function applyBrandTheme(root: HTMLElement = document.documentElement) {
  for (const [name, value] of Object.entries(brandColors)) {
    root.style.setProperty(name, value)
  }
}

const whatsappNumber = (import.meta.env.VITE_WHATSAPP_NUMBER ?? '').trim()
const whatsappMessage =
  'Olá! Vi o site e gostaria de agendar uma aula experimental de inglês.'

if (import.meta.env.DEV && !whatsappNumber) {
  console.warn(
    '[brand] VITE_WHATSAPP_NUMBER não definido: os botões de WhatsApp ficam escondidos. Defina no .env.',
  )
}

export type Plan = {
  id: string
  name: string
  /** Aulas por mês (0 = não se aplica) */
  lessonsPerMonth: number
  /** Duração de cada aula, em minutos (0 = não se aplica) */
  durationMinutes: number
  /** Preço mensal em reais; null = "a combinar" */
  price: number | null
  highlight: boolean
  description: string
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
    id: 'essencial',
    name: 'Essencial',
    lessonsPerMonth: 4,
    durationMinutes: 50,
    price: 280,
    highlight: false,
    description: 'Uma aula por semana para manter o ritmo.',
  },
  {
    id: 'intensivo',
    name: 'Intensivo',
    lessonsPerMonth: 8,
    durationMinutes: 50,
    price: 520,
    highlight: true,
    description: 'Duas aulas por semana para evoluir mais rápido.',
  },
  {
    id: 'sob-medida',
    name: 'Sob medida',
    lessonsPerMonth: 0,
    durationMinutes: 0,
    price: null,
    highlight: false,
    description: 'Preparação para entrevista, viagem ou prova. Vamos conversar.',
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
    question: 'Preciso instalar algum programa?',
    answer:
      'Não. As aulas acontecem pelo Google Meet, direto no navegador ou no aplicativo do celular. Você recebe um link fixo e usa sempre o mesmo.',
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
