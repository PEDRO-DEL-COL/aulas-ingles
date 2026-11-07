# Plataforma de Aulas de Inglês — Briefing do Projeto

> Cópia de PROJETO.md com adendo de convenções (seção 13). Ao mudar o briefing, atualize os dois.

## 1. Contexto

A irmã do desenvolvedor dá aulas particulares de inglês e vai passar a trabalhar só com isso. Ela precisa de um site para:

- os alunos entrarem (login) e verem informações das aulas e do financeiro;
- ela se organizar (agenda, alunos, registro de aulas, controle de pagamentos);
- uma landing page simples e bonita para divulgar as aulas.

O desenvolvedor (usuário deste projeto) também terá acesso de admin.

## 2. Decisões já tomadas

- **Custo zero.** Tudo em planos gratuitos. Único gasto opcional: domínio .com.br (~R$ 40/ano no Registro.br).
- **Sem pagamento online por enquanto.** Nada de gateway. O financeiro é um controle manual da professora; o aluno vê valor, vencimento, status e um Pix copia e cola.
- **Sem servidor próprio.** Site estático falando direto com o Supabase.
- **Login só com conta Google**, apenas para e-mails que a professora liberou. Sem e-mail automático no MVP (o e-mail padrão do Supabase só envia para a equipe do projeto, 2 por hora).
- **Aulas no Google Meet**, com link fixo por aluno, colado na ficha. Materiais ficam no Google Drive dela (só guardamos links no banco).
- **Lembretes pelo WhatsApp** com mensagem pronta (link `wa.me`), sem automação.
- Interface em **português do Brasil**, **mobile first** (a maioria dos alunos abrirá no celular).

## 3. Stack

| Camada | Escolha |
| --- | --- |
| Site | Vite + React + TypeScript |
| Visual | Tailwind CSS + shadcn/ui |
| Rotas | React Router |
| Backend | Supabase Free (Postgres, Auth com Google, Row Level Security) |
| Cliente | supabase-js |
| Datas | date-fns |
| QR Code | qrcode.react (o código Pix copia e cola é gerado por função própria, padrão BR Code do Banco Central, com CRC16) |
| Hospedagem | Cloudflare Pages (site estático) |
| Automação | GitHub Actions (backup semanal e consulta agendada contra a pausa) |
| Ferramentas locais | Node.js, Git, VS Code, Supabase CLI |

Por que não Vercel: o plano gratuito proíbe uso comercial, e anunciar a venda de um serviço conta como comercial. Por que não Next.js com servidor: o plano gratuito de Workers da Cloudflare dá 10 ms de CPU por requisição. Firebase fica como plano B (armazenamento de arquivos só no plano pago; banco não relacional).

## 4. Perfis de acesso

| Perfil | Como entra | O que faz |
| --- | --- | --- |
| Visitante | Sem login | Landing page, botão de WhatsApp, privacidade e termos |
| Aluno | Google, se o e-mail foi liberado | Próxima aula com botão do Meet, agenda, histórico, materiais, financeiro, Pix |
| Responsável (opcional) | E-mail Google liberado e vinculado ao aluno | Financeiro e acompanhamento do filho menor de idade |
| Professora | Google | Agenda, fichas, registro de aulas, materiais, financeiro |
| Admin | Google | Tudo da professora + usuários, configurações, backup. Pode ser só um papel a mais sobre a área da professora |

**Fluxo de liberação:** a professora cadastra o aluno com o e-mail Google dele na tabela `students`. No primeiro login, um gatilho no banco liga a conta (`auth.users`) à ficha pelo e-mail. Quem não estiver na lista vê "acesso não liberado" e não lê nada.

## 5. Funcionalidades e fases

**MVP**
- Landing: página com apresentação, sobre, como funcionam as aulas, planos, depoimentos, FAQ; botão de aula experimental/contato que abre o WhatsApp com mensagem pronta.
- Aluno: painel com próxima aula, contagem regressiva e botão "Entrar na aula" (abre o Meet); agenda; histórico de aulas (data, tema, resumo, tarefa, materiais); financeiro (valor, vencimento, status pago/em aberto/atrasado); Pix copia e cola e QR Code com o valor; materiais (links do Drive, PDFs, áudios).
- Professora: agenda do dia e da semana com link do Meet; aulas recorrentes geradas automaticamente; ficha do aluno (contato, nível, objetivo, plano, quem paga, anotações); registro pós-aula (presença, conteúdo, tarefa, anotação privada); materiais por aula ou aluno; financeiro (lançar mensalidade, marcar como pago, ver em aberto e atrasados).
- Admin: usuários (liberar e-mail Google, desativar, trocar perfil); configurações (planos, valores, chave Pix, política de cancelamento); backup do banco e rotina contra a pausa do Supabase.

**Fase 2**
- Aluno: botão "Já paguei" (só avisa a professora, não comprova); pedido de remarcação/cancelamento respeitando o prazo; tarefas com entrega e correção; progresso (nível, metas, aulas feitas, saldo do pacote).
- Professora: mensalidades do mês geradas a partir do plano de cada aluno; lembrete de aula/pagamento por WhatsApp em um clique; lista de interessados vindos de um formulário na landing; exportar alunos, aulas e pagamentos para planilha.

**Depois**
- Agendamento pelo próprio aluno; gravações das aulas; relatórios (receita por mês, faltas, alunos ativos); turmas em grupo; cobrança online com baixa automática; histórico de alterações; domínio próprio e e-mail automático.

## 6. Mapa de telas (24)

- **Público:** Landing page, Privacidade e termos.
- **Login:** conta Google, só e-mails liberados.
- **Aluno:** Início (botão do Meet), Agenda de aulas, Histórico de aulas, Detalhe da aula, Materiais, Financeiro, Pagar via Pix, Meu perfil.
- **Professora:** Hoje, Agenda da semana, Lista de alunos, Ficha do aluno, Registro da aula, Materiais, Financeiro, Interessados (Fase 2).
- **Admin:** Usuários e acessos, Planos e valores, Políticas do negócio, Backup e exportação.

## 7. Modelo de dados (Supabase / Postgres)

| Tabela | O que guarda |
| --- | --- |
| `profiles` | Toda pessoa com login: nome, e-mail, telefone, papel (aluno, responsável, professora, admin), fuso horário |
| `students` | E-mail Google liberado, perfil (ligado no primeiro login), nível, objetivo, responsável financeiro, plano, link fixo do Meet, situação (ativo, pausado, saiu) |
| `plans` | Nome, aulas por mês, duração da aula, valor, ativo |
| `schedules` | Horário fixo do aluno: dia da semana, hora, duração, início e fim |
| `lessons` | Aluno, data e hora (UTC), duração, estado, link do Meet |
| `lesson_notes` | Registro visível ao aluno: conteúdo, resumo, tarefa |
| `private_notes` | Anotações só da professora (tabela separada de propósito) |
| `materials` | Título, tipo, link do Drive, aula ou aluno vinculado |
| `invoices` | Aluno, pagador, mês de referência, valor, vencimento, situação, aviso do aluno, data do pagamento, confirmado pela professora |
| `settings` | Chave Pix, nome e cidade do recebedor, política de cancelamento, WhatsApp |
| `leads` | Interessados da landing page |
| `blocked_dates` | Férias e feriados |

## 8. Regras de negócio e detalhes que não podem passar

**Segurança e privacidade (LGPD)**
- Row Level Security em todas as tabelas: o aluno só lê os próprios dados; a segurança vale no banco, não só na tela.
- `private_notes` nunca visível ao aluno.
- Política de privacidade e termos na landing, com aceite no primeiro acesso. Aluno menor de idade: o responsável aceita e consente.
- Nunca colocar chave de serviço (service role) no front-end; só a chave pública (anon) com RLS.

**Agenda**
- Horários em UTC no banco, exibidos no fuso de cada pessoa.
- Estados da aula: agendada, realizada, falta do aluno, cancelada pela professora, reposição.
- Política de cancelamento configurável (ex.: até 24h antes remarca sem custo). O sistema aplica o que ela definir.
- Férias e feriados bloqueiam datas; aulas recorrentes pulam essas datas.

**Meet**
- Link fixo por aluno no MVP. Botão "Entrar na aula" em destaque a partir de ~15 minutos antes.
- Conta Google gratuita: 60 minutos com 3 ou mais pessoas; individual vai até 24h. Gravação nativa só em Workspace pago (Business Standard ou superior) e exige consentimento.

**Financeiro**
- Confirmação manual: a professora confere o extrato e marca como pago. "Já paguei" só avisa.
- Modelo de cobrança ainda em aberto (mensalidade fixa, pacote ou avulsa). Separar aluno de responsável financeiro desde o início.
- Pix copia e cola gerado no front-end com chave, valor e identificador do aluno. Nota fiscal fica fora por enquanto.

## 9. Limites do plano gratuito e contornos

| Limite | Contorno |
| --- | --- |
| Supabase pausa o projeto após 1 semana sem uso | GitHub Action agendada (a cada ~3 dias) consulta o banco |
| Supabase Free não faz backup | GitHub Action semanal com `pg_dump`, criptografado, e exportação em planilha |
| E-mail padrão do Supabase só envia para a equipe do projeto (2/hora) | Login só com Google; se precisar de e-mail depois, Brevo grátis (300/dia), que pede domínio próprio |
| 500 MB de banco, 1 GB de arquivos | Só texto e links no Supabase; arquivos no Drive |
| Login Google em modo de teste só aceita contas testadoras | Publicar o app de login no Google Cloud pedindo só e-mail e perfil |
| Cloudflare Pages: 500 publicações por mês | Sem efeito prático |
| Sem domínio próprio | Site fica em `nome.pages.dev` |

## 10. Ordem de construção sugerida

1. **Fase 0:** criar contas (GitHub, Cloudflare, Supabase, Google Cloud); identidade visual (logo, cores, fotos); decidir modelo de cobrança.
2. **Fase 1 (MVP):**
   1. Criar projeto Vite + React + TS + Tailwind + shadcn/ui + React Router; subir no GitHub; publicar no Cloudflare Pages.
   2. Landing page (responsiva, seções em sequência, botão de WhatsApp).
   3. Supabase: tabelas, migrations via Supabase CLI, RLS, gatilho que liga o login à ficha.
   4. Login com Google e proteção de rotas por papel.
   5. Área do aluno, depois área da professora, depois admin básico.
   6. Financeiro manual + Pix copia e cola + QR Code.
   7. GitHub Actions: consulta agendada e backup.
   8. Importar alunos atuais por planilha e testar com 2 ou 3 alunos reais.
3. **Fase 2 e depois:** conforme a seção 5.

## 11. Decisões em aberto (perguntar antes de assumir)

- Modelo de cobrança: mensalidade fixa, pacote de aulas ou aula avulsa?
- Ela dá aula para menores de idade? (define o perfil de responsável)
- Todos os alunos têm conta Google?
- Só aulas individuais ou também em grupo?
- Qual chave Pix aparece e em nome de quem?
- Quantos alunos hoje e em um ano? Algum mora fora do Brasil?
- Política de cancelamento e reposição.
- Nome do negócio, identidade visual e se vale pagar o domínio.

## 12. Como o Claude deve trabalhar neste projeto

- Escrever em TypeScript estrito; textos de interface em português do Brasil.
- Mobile first; componentes do shadcn/ui; visual limpo e acolhedor, sem aparência de template genérico.
- Todo acesso a dados passa por RLS; testar as políticas com um aluno e um aluno de outro cadastro.
- Migrations versionadas no repositório; nunca alterar tabelas só pelo painel.
- Segredos em variáveis de ambiente; nada sensível no repositório.
- Começar pelo passo 1 da seção 10 e avançar em pequenas etapas, explicando o que foi feito a cada uma.

---

## 13. Convenções do repositório (adendo para o Claude)

**Comandos:** `npm run dev` · `npm run build` · `npm run lint` · `npm run typecheck` · `npm test` · `npm run format`. Antes de commitar: typecheck, lint, test e build precisam passar.

**Estrutura:**
- `src/config/brand.ts` — nome do negócio, cores, contatos e valores (fonte única; não espalhar textos de marca pelo código).
- `src/pages/` — uma página por rota, sempre carregada com `React.lazy` em `src/router.tsx`.
- `src/components/ui/` — componentes shadcn/ui; `src/components/` — componentes do projeto.
- `src/lib/` — utilitários (`supabase.ts`, `pix.ts`), com testes `*.test.ts` (vitest).
- `supabase/migrations/` — SQL versionado (nunca alterar tabelas pelo painel); `supabase/tests/` — validação de RLS.
- `docs/PENDENCIAS.md` — o que depende do usuário e decisões em aberto.

**Commits e versões:** Conventional Commits em português (`feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`), pequenos e atômicos; rodapé `Co-Authored-By:` do modelo que escreveu. SemVer com tags anotadas (`vX.Y.Z`) + GitHub Release; registrar mudanças em `CHANGELOG.md` (Keep a Changelog).

**Segredos:** só variáveis `VITE_*` públicas no front (URL e anon key do Supabase, número do WhatsApp). Nunca commitar `.env` nem a service role key.