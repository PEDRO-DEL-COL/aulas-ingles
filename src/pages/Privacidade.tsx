import { ArrowLeft, TriangleAlert } from 'lucide-react'
import type { ReactNode } from 'react'
import { useEffect, useMemo } from 'react'
import { Link, useLocation } from 'react-router'

import { PublicSiteProvider } from '@/components/landing/PublicSiteProvider'
import { usePublicSite } from '@/components/landing/usePublicSite'
import { brand, LEGAL_LAST_UPDATED } from '@/config/brand'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'

type Section = { id: string; title: string; body: ReactNode }

const controller = `${brand.teacherName} (${brand.name})`
const contact = brand.contactEmail

function buildPrivacidade(hasWhatsapp: boolean): Section[] {
  return [
    {
      id: 'controladora',
      title: '1. Quem é a controladora',
      body: (
        <p>
          A controladora dos dados pessoais tratados neste site é {controller}, que pode
          ser contatada em {contact}
          {hasWhatsapp ? ` ou pelo WhatsApp` : ''}. Este texto segue a Lei Geral de
          Proteção de Dados (LGPD, Lei nº 13.709/2018).
        </p>
      ),
    },
    {
      id: 'dados',
      title: '2. Quais dados coletamos',
      body: (
        <ul>
          <li>
            Nome e e-mail da conta Google usada para entrar (fornecidos pelo login do
            Google).
          </li>
          <li>Telefone/WhatsApp, nível de inglês, objetivo e preferências de horário.</li>
          <li>Dados das aulas: datas, presença, conteúdo, tarefas e resumos.</li>
          <li>
            Dados de pagamentos: valores, vencimentos e situação (não guardamos dados de
            cartão).
          </li>
          <li>Anotações pedagógicas feitas pela professora sobre o seu progresso.</li>
          <li>
            Se você falar conosco pelo WhatsApp, a conversa fica no próprio aplicativo.
          </li>
        </ul>
      ),
    },
    {
      id: 'finalidades',
      title: '3. Para que usamos e bases legais',
      body: (
        <ul>
          <li>
            <strong>Execução de contrato</strong> (art. 7º, V): liberar seu acesso,
            agendar e registrar aulas, organizar materiais e o controle financeiro.
          </li>
          <li>
            <strong>Legítimo interesse</strong> (art. 7º, IX): segurança do sistema,
            prevenção a fraudes e melhoria do serviço, respeitando seus direitos.
          </li>
          <li>
            <strong>Consentimento</strong> (art. 7º, I): quando necessário, por exemplo
            para contatos de divulgação ou para dados de menores de idade. Pode ser
            retirado a qualquer momento.
          </li>
          <li>
            <strong>Obrigação legal</strong> (art. 7º, II): guarda de registros
            financeiros quando exigida por lei.
          </li>
        </ul>
      ),
    },
    {
      id: 'menores',
      title: '4. Crianças e adolescentes',
      body: (
        <p>
          Os dados de menores de 18 anos são tratados no melhor interesse do aluno e com o
          consentimento específico de pelo menos um dos pais ou do responsável legal (art.
          14 da LGPD). O responsável pode acompanhar o financeiro e o progresso, e pedir a
          exclusão dos dados a qualquer momento.
        </p>
      ),
    },
    {
      id: 'compartilhamento',
      title: '5. Com quem compartilhamos',
      body: (
        <>
          <p>Usamos prestadores (operadores) apenas para fazer o serviço funcionar:</p>
          <ul>
            <li>
              <strong>Supabase</strong>: banco de dados e autenticação.
            </li>
            <li>
              <strong>Google</strong>: login com conta Google, Google Meet (aulas) e
              Google Drive (materiais).
            </li>
            <li>
              <strong>Cloudflare</strong>: hospedagem do site.
            </li>
          </ul>
          <p>
            Esses prestadores podem armazenar dados em servidores fora do Brasil
            (transferência internacional, art. 33 da LGPD), com garantias contratuais
            adequadas. Não vendemos seus dados.
          </p>
        </>
      ),
    },
    {
      id: 'retencao',
      title: '6. Por quanto tempo guardamos',
      body: (
        <p>
          Guardamos os dados enquanto você for aluno e, depois, pelo tempo necessário para
          cumprir obrigações legais e resolver eventuais questões (prazo de referência:
          [definir, ex.: 5 anos para registros financeiros]). Depois disso, os dados são
          excluídos ou anonimizados.
        </p>
      ),
    },
    {
      id: 'direitos',
      title: '7. Seus direitos (art. 18)',
      body: (
        <>
          <p>
            Você pode pedir: confirmação de que tratamos seus dados; acesso; correção;
            anonimização, bloqueio ou eliminação de dados desnecessários; portabilidade;
            informação sobre compartilhamentos; revogação do consentimento; e eliminação
            dos dados tratados com consentimento.
          </p>
          <p>
            Para exercer qualquer direito, escreva para {contact}. Responderemos em prazo
            razoável. Você também pode reclamar à Autoridade Nacional de Proteção de Dados
            (ANPD).
          </p>
        </>
      ),
    },
    {
      id: 'seguranca',
      title: '8. Segurança',
      body: (
        <p>
          Cada aluno só acessa os próprios dados (controle de acesso no banco de dados), a
          conexão é criptografada e o login é feito pelo Google, sem senha própria. Nenhum
          sistema é totalmente seguro; em caso de incidente relevante, avisaremos os
          afetados e a ANPD conforme a lei.
        </p>
      ),
    },
    {
      id: 'cookies',
      title: '9. Cookies',
      body: (
        <p>
          Usamos apenas armazenamento essencial para manter sua sessão e autenticação. Não
          usamos cookies de publicidade nem de rastreamento.
        </p>
      ),
    },
    {
      id: 'alteracoes',
      title: '10. Alterações',
      body: (
        <p>
          Este texto pode ser atualizado. A data da última atualização aparece no topo da
          página, e mudanças relevantes serão comunicadas.
        </p>
      ),
    },
  ]
}

const termos: Section[] = [
  {
    id: 'objeto',
    title: '1. Objeto',
    body: (
      <p>
        Estes termos regulam as aulas particulares de inglês online oferecidas por{' '}
        {controller}, realizadas pelo Google Meet, e o uso da área do aluno neste site.
      </p>
    ),
  },
  {
    id: 'agendamento',
    title: '2. Agendamento e cancelamento',
    body: (
      <p>
        Os horários são combinados com a professora. A política de remarcação e
        cancelamento é definida pela professora e exibida na área do aluno [definir: ex.:
        remarcação sem custo até 24 horas antes da aula].
      </p>
    ),
  },
  {
    id: 'pagamentos',
    title: '3. Pagamentos',
    body: (
      <p>
        Os pagamentos são feitos por Pix, conforme valor e vencimento informados na área
        do aluno. A confirmação é manual: a professora confere o recebimento e marca como
        pago. O botão &quot;Já paguei&quot;, quando existir, apenas avisa a professora e
        não comprova o pagamento.
      </p>
    ),
  },
  {
    id: 'conduta',
    title: '4. Conduta',
    body: (
      <p>
        Esperamos respeito mútuo durante as aulas. O link do Meet é pessoal e não deve ser
        compartilhado. Aulas não podem ser gravadas sem consentimento de todos os
        participantes.
      </p>
    ),
  },
  {
    id: 'materiais',
    title: '5. Propriedade dos materiais',
    body: (
      <p>
        Os materiais didáticos são da professora ou usados com autorização, e servem para
        uso pessoal do aluno. É proibido copiar, revender ou divulgar sem permissão.
      </p>
    ),
  },
  {
    id: 'limitacao',
    title: '6. Limitação de responsabilidade',
    body: (
      <p>
        O aprendizado depende também da dedicação do aluno, por isso não prometemos
        resultados específicos. Não nos responsabilizamos por falhas de internet, do
        Google Meet ou de outros serviços de terceiros, mas faremos o possível para repor
        aulas afetadas conforme a política de cancelamento.
      </p>
    ),
  },
  {
    id: 'foro',
    title: '7. Foro',
    body: (
      <p>
        Fica eleito o foro de {brand.forum} para resolver questões deste termo, salvo
        disposição legal em contrário (como o foro do consumidor).
      </p>
    ),
  },
]

const dateFmt = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long', timeZone: 'UTC' })

function Block({
  id,
  heading,
  items,
}: {
  id: string
  heading: string
  items: Section[]
}) {
  return (
    <section id={id} aria-labelledby={`${id}-titulo`} className="scroll-mt-6">
      <h2 id={`${id}-titulo`} className="text-3xl font-extrabold">
        {heading}
      </h2>
      {items.map((s) => (
        <section
          key={s.id}
          id={s.id}
          aria-labelledby={`${s.id}-titulo`}
          className="scroll-mt-6"
        >
          <h3 id={`${s.id}-titulo`} className="mt-8 text-xl font-semibold">
            {s.title}
          </h3>
          <div className="mt-2 space-y-3 text-muted-foreground [&_li]:ml-5 [&_li]:list-disc [&_li]:py-0.5 [&_strong]:text-foreground">
            {s.body}
          </div>
        </section>
      ))}
    </section>
  )
}

function PrivacidadePage() {
  const { whatsappNumber } = usePublicSite()
  const privacidade = useMemo(() => buildPrivacidade(!!whatsappNumber), [whatsappNumber])
  useDocumentTitle(
    'Política de Privacidade e Termos de Uso',
    `Como ${brand.name} trata seus dados pessoais (LGPD) e as regras de uso das aulas.`,
  )
  const { hash } = useLocation()
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView()
  }, [hash])
  const updated = dateFmt.format(new Date(`${LEGAL_LAST_UPDATED}T00:00:00Z`))
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <header>
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Voltar para a página inicial
        </Link>
      </header>
      <main className="mt-6">
        <h1 className="text-4xl leading-tight font-extrabold">
          Política de Privacidade e Termos de Uso
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {brand.name} · Última atualização:{' '}
          <time dateTime={LEGAL_LAST_UPDATED}>{updated}</time>
        </p>

        <div
          role="note"
          className="mt-6 flex gap-3 rounded-2xl border-2 border-peach-text bg-accent p-4 font-medium"
        >
          <TriangleAlert
            className="mt-0.5 size-5 shrink-0 text-peach-text"
            aria-hidden="true"
          />
          <p>
            RASCUNHO — texto base a ser revisado antes da publicação (idealmente por um
            profissional).
          </p>
        </div>

        <nav aria-label="Sumário" className="mt-8 rounded-2xl border bg-card p-5">
          <p className="font-semibold">Sumário</p>
          <div className="mt-3 grid gap-6 text-sm sm:grid-cols-2">
            <div>
              <a href="#privacidade" className="font-medium underline underline-offset-4">
                Política de Privacidade
              </a>
              <ul className="mt-2 space-y-1">
                {privacidade.map((s) => (
                  <li key={s.id}>
                    <a
                      href={`#${s.id}`}
                      className="text-muted-foreground hover:underline"
                    >
                      {s.title}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <a href="#termos" className="font-medium underline underline-offset-4">
                Termos de Uso
              </a>
              <ul className="mt-2 space-y-1">
                {termos.map((s) => (
                  <li key={s.id}>
                    <a
                      href={`#${s.id}`}
                      className="text-muted-foreground hover:underline"
                    >
                      {s.title}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </nav>

        <div className="mt-12 space-y-16">
          <Block id="privacidade" heading="Política de Privacidade" items={privacidade} />
          <Block id="termos" heading="Termos de Uso" items={termos} />
        </div>
      </main>
      <footer className="mt-16 border-t pt-6 text-sm text-muted-foreground">
        <Link to="/" className="underline underline-offset-4">
          Voltar para a página inicial
        </Link>
      </footer>
    </div>
  )
}

export default function Privacidade() {
  return (
    <PublicSiteProvider>
      <PrivacidadePage />
    </PublicSiteProvider>
  )
}
