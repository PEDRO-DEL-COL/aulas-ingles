# Pendências que dependem do usuário

Itens que precisam de contas, segredos ou decisões suas. O código já está preparado para cada um.

## 1. Criar o projeto no Supabase

1. Crie uma conta em <https://supabase.com> e um projeto (região **South America (São Paulo)**, plano Free). Guarde a senha do banco num gerenciador de senhas.
2. Instale a Supabase CLI (`npm i -g supabase` ou <https://supabase.com/docs/guides/cli>) e o Docker Desktop (necessário só para rodar o banco local e os testes).
3. Na raiz do projeto:
   ```bash
   supabase login
   supabase link --project-ref <ref-do-projeto>
   supabase db push          # aplica supabase/migrations/
   ```
4. **Validar as migrations e o RLS antes de usar com alunos reais** (o SQL ainda não foi executado em nenhum Postgres — não havia Docker/CLI nesta máquina):
   ```bash
   supabase start
   supabase db reset         # aplica as migrations no banco local
   supabase test db          # roda supabase/tests/rls.test.sql (pgTAP)
   ```
   Se algo falhar, me mande a saída.
5. Em **Project Settings → API**, copie a `Project URL` e a chave `anon public` para o `.env` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`). **Nunca** use a `service_role` no front.
6. Em **Authentication → Providers**: deixe **Email desativado** (login só com Google).
7. Primeiro admin: depois do seu primeiro login com Google, rode no SQL Editor (ver `supabase/seed.sql`):
   ```sql
   update public.profiles set role = 'admin', active = true where email = 'seu-email@gmail.com';
   ```
   Faça o mesmo com `role = 'professora'` para a conta da sua irmã.

## 2. Login com Google (Google Cloud)

1. Em <https://console.cloud.google.com> crie um projeto → **APIs e serviços → Tela de consentimento OAuth**: tipo **Externo**, escopos apenas `email`, `profile` e `openid`, link da política de privacidade (`https://<site>/privacidade`).
2. **Credenciais → Criar ID do cliente OAuth → Aplicativo da Web**:
   - Origens JavaScript: `http://localhost:5173` e `https://<seu-site>.pages.dev`
   - URI de redirecionamento: `https://<ref-do-projeto>.supabase.co/auth/v1/callback`
3. No Supabase, **Authentication → Providers → Google**: cole o Client ID e o Client Secret (o secret fica só no Supabase, nunca no repositório).
4. **Authentication → URL Configuration**: `Site URL` = URL do Cloudflare Pages; em Redirect URLs adicione também `http://localhost:5173/**`.
5. **Publique o app** na tela de consentimento (em modo de teste só contas testadoras conseguem entrar).

## 3. Publicar no Cloudflare Pages

1. Conta em <https://dash.cloudflare.com> → **Workers & Pages → Create → Pages → Connect to Git** → repositório `PEDRO-DEL-COL/aulas-ingles`.
2. Configuração de build:
   - Framework preset: **Vite** (ou nenhum)
   - Build command: `npm run build`
   - Build output directory: `dist`
   - Variável de ambiente `NODE_VERSION` = `22`
3. Variáveis de ambiente (Production e Preview): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_WHATSAPP_NUMBER` (formato `55DDDNUMERO`, só dígitos).
4. O arquivo `public/_redirects` já faz as rotas da SPA funcionarem.
5. Depois do primeiro deploy, atualize as URLs no Google Cloud e no Supabase (itens 2.2 e 2.4).

## 4. GitHub Actions (próxima rodada)

Para o backup semanal e a consulta contra a pausa do Supabase vou precisar que você cadastre em **Settings → Secrets and variables → Actions**:

- `SUPABASE_DB_URL` (connection string do banco, em Project Settings → Database);
- `BACKUP_PASSPHRASE` (senha para criptografar o dump);
- `SUPABASE_URL` e `SUPABASE_ANON_KEY` (para a consulta periódica).

## 5. Ambiente local

- O Node instalado é o 22.3. Recomendo atualizar para o **Node 22 LTS mais recente (≥ 22.12)**: as versões novas do Vite (7/8) e do Vitest exigem isso. Hoje o projeto usa Vite 6 e Vitest 3 para funcionar no 22.3.
- Copie `.env.example` para `.env` e preencha.
- `npm audit`: o aviso do `minimatch` foi corrigido com `overrides` no `package.json`. Restam avisos do **Vitest 3** (`@vitest/mocker` e `tinypool`), usado só para rodar testes locais — nada disso vai para o site publicado. A correção é o Vitest ≥ 4.1.12, mas o npm 10.8 desta máquina falha ao resolver as dependências (erro `edgesOut`). Depois de atualizar Node/npm, rode `npm i -D vitest@latest` e `npm test`.

## 6. Conteúdo a revisar antes de divulgar

- `src/config/brand.ts`: nome do negócio, nome da professora, slogan, texto "sobre", planos e preços, FAQ, redes sociais, e-mail de contato, foro.
- Depoimentos: hoje são **exemplos** (com selo visível). Trocar por depoimentos reais com autorização dos alunos.
- Foto da professora (hoje há um bloco com iniciais; ver `src/components/landing/About.tsx`).
- `index.html`: título e tags Open Graph estão fixos com o nome provisório.
- **Privacidade e Termos** (`src/pages/Privacidade.tsx`): é um rascunho; precisa de revisão, idealmente por um profissional, e dos dados reais da controladora, prazo de retenção e política de cancelamento.

## 7. Decisões tomadas (rodada 2)

| Tema             | Decisão                                                                                                                                                                | Onde está no código                                                       |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Cobrança         | Os 3 modelos (mensalidade, pacote, avulsa), sem custo                                                                                                                  | `billing_model` em `plans`/`invoices`; planos de exemplo em `brand.ts`    |
| Menores de idade | Podem existir; o responsável é só **dado na ficha** (pagador/consentimento), **sem login**                                                                             | `student_guardians`, `payers`, `students.consent_by_guardian_at`          |
| Conta Google     | Obrigatória para o aluno                                                                                                                                               | [CONTA-GOOGLE.md](CONTA-GOOGLE.md) e tela "Acesso não liberado"           |
| Aulas            | Só individuais                                                                                                                                                         | `lessons.student_id` obrigatório                                          |
| Pix              | Ainda não existe: campos vazios em `settings`; a tela mostra "Pix ainda não configurado"                                                                               | `settings.pix_key` (nullable)                                             |
| Fuso             | Todos no Brasil; padrão `America/Sao_Paulo` (campo mantido)                                                                                                            | `profiles.timezone`, `schedules.timezone`                                 |
| Cancelamento     | ≥ 24h: com reposição; < 24h: sem; falta: sem; máx. 2 reposições/mês; faixa intermediária opcional (desligada). Aplicado **no banco**                                   | `settings.*`, triggers e RPCs em `20261108000004_cancellation_policy.sql` |
| Domínio          | Só gratuito: `<nome>.pages.dev`                                                                                                                                        | Cloudflare Pages                                                          |
| Perfis           | aluno, professora, admin. Professora edita alunos, aulas, materiais, agenda e financeiro; **só admin** edita regras, política, planos/valores, Pix, papéis e exclusões | `20261108000003_rls_roles.sql`                                            |

## 8. Perguntas que ainda restam

1. **Confirmar interpretação do financeiro do aluno:** só professora e admin acessam a _gestão_ financeira (lançar cobrança, marcar pago, ver a lista geral). O aluno vê **somente as próprias cobranças** (valor, vencimento, status) e o Pix, apenas leitura, e pode clicar em "Já paguei" (só avisa). Está certo assim?
2. **Mês da reposição:** o limite de 2 reposições conta pelo mês **em que a reposição acontece** (não o mês da aula cancelada). Ok?
3. **Faixa intermediária de cancelamento:** se ligada, cancelamentos entre X h e 24 h ficam "a critério da professora". Querem usar? Com qual X?
4. **Reposição de reposição:** se o aluno cancelar uma reposição com ≥ 24h, ganha nova reposição (contando no limite). Ok?
5. **Nome do negócio e da professora, foto, textos e preços reais**, e o subdomínio desejado em `pages.dev`.
6. **Chave Pix** (tipo, nome e cidade do recebedor) quando existir — agora o admin cadastra em **Admin > Pix e contato**.
7. **Revisão jurídica** do texto de Privacidade e Termos.

## 9. Migrations a aplicar no Supabase remoto

Já aplicadas: todas até `20261118000001_availability_calendar`.

Pendente (v0.21.0):

1. `20261119000001_availability_primary_rule.sql` — disponibilidade como regra primária de todas as aulas (trigger `lessons_availability_rule`), geração recorrente que pula e relata (`generate_recurring_lessons`).

Testes pgTAP ainda não executados (sem Docker).

Atenção (já vigente): excluir o login do último admin ativo é bloqueado pelo banco; promova outro admin antes.

## 9.1 Topologia do git

- `origin/main` está na **v0.17.0**. A `main` **local** tem a **v0.18.0** (GitHub Actions + `docs/BACKUP.md`), sem push, aguardando o escopo `workflow` (`gh auth refresh -h github.com -s workflow`). Na rodada 8 o backup foi redesenhado nessa linha (envio do `.gpg` para um repositório **privado** com `BACKUP_REPO`/`BACKUP_REPO_TOKEN`, sem artefato público) e a tag local `v0.18.0` foi movida para incluir isso (nunca foi publicada).
- A linha do calendário está na branch pública **`calendario`** (parte da v0.17.0) com as tags **v0.19.0, v0.20.0, v0.21.0 e v0.21.1**. O CHANGELOG dessa branch não tem a seção 0.18.0.
- Para juntar: com o escopo liberado, merge de `calendario` na `main` local (conflitos esperados em `CHANGELOG.md`, `package.json`/`package-lock.json` e `docs/PENDENCIAS.md`) e push de `main` + tag `v0.18.0`.

## 9.2 Varredura de segredos (rodada 8)

`git log --all -p` (inclui a `main` local) procurado por `sbp_`, `sb_secret_`, `service_role`, `GOCSPX-`, JWT (`eyJhbGciOiJIUzI1NiIs…`), URLs `postgres://usuario:senha@`, `ghp_`/`github_pat_`, chaves AWS, chaves privadas PEM e `senha/password = "…"`: **nenhum segredo encontrado**. `service_role` aparece só em textos dizendo para não usá-la. O único arquivo `.env*` já versionado é `.env.example`, com URL e anon key vazias e um número de WhatsApp fictício. `.env`, `.env.*` (exceto o exemplo) estão no `.gitignore`.

## 10. Decisões da rodada 4 (respondidas)

| Tema                          | Decisão                                                                                       | Onde                                                         |
| ----------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| WhatsApp                      | Vem de `settings.whatsapp_number` (admin edita); `VITE_WHATSAPP_NUMBER` só como fallback      | `public_site_info`, `src/lib/publicSite.ts`, Perfil do aluno |
| Planos da landing             | Planos ativos do banco; `brand.ts` só como fallback                                           | `public_site_info`, `Plans.tsx`                              |
| Férias com aulas já agendadas | Cancelamento automático como "cancelada pela professora", com reposição fora do limite mensal | migration 13                                                 |
| Mensalidades em lote          | Por mês, a partir do plano de mensalidade; pacote/avulsa não geram em lote                    | migration 14, Financeiro                                     |

## 11. Decisões da rodada 5 (para as próximas rodadas)

Decididas pelo usuário; ainda **não implementadas**, salvo o item 1:

1. **Limite de reposições:** o limite de 2 por mês conta **somente** reposições de cancelamentos feitos pelo **aluno**. Já é o comportamento atual (desde a migration 13, reposição de aula cancelada pela professora, inclusive por férias/feriado, não conta) — confirmado.
2. **Vantagens dos planos:** lista de vantagens reutilizáveis já cadastradas, com a opção de adicionar novas, associadas a cada plano e exibidas na landing (precisa de tabela/coluna nova e de entrar em `public_site_info`).
3. **Vencimento padrão das mensalidades:** guardado em `settings` (banco, editável pelo admin), não no navegador; a tela de mensalidades em lote passa a usar esse valor como padrão.
4. **Reposição só na disponibilidade da professora:** reposição só pode ser agendada em dias/horários em que a professora tem disponibilidade; no futuro, uma agenda virtual de disponibilidade para gerenciar isso, e `schedule_makeup` bloqueando fora da disponibilidade, inclusive em férias/feriados.

## 12. "Ver como" (v0.13.0)

- Só para admin real (papel no banco). Troca **apenas a visualização** (menus, rotas e telas); o papel real, a RLS e os triggers não mudam. A escolha fica no `localStorage` (`view-as:v1`) e é validada na leitura.
- **Visão Aluno:** o admin escolhe um aluno real para pré-visualizar, **somente leitura** (cancelar aula, "Já paguei" e editar perfil ficam desabilitados). Os dados vêm da leitura que o admin já tem pela RLS; consultas que dependiam da RLS do aluno (materiais, detalhe de aula) passaram a filtrar pelo aluno escolhido. O bloqueio de escrita é só no front.
- **Visão Professora:** é a área da professora de verdade; ações de escrita funcionam como sempre funcionaram para o admin.
- Telas ainda inexistentes (Interessados, Meu perfil da professora, Backup e exportação) mostram "Em breve".

## 13. Calendário (v0.19.0–v0.20.0): decisões tomadas sem resposta

- **Uma tela só** (`/app/professora/calendario`) substitui Agenda da semana, Disponibilidade e Férias e feriados (as rotas antigas redirecionam).
- **Padrão do assistente:** segunda a sexta, 09:00–17:00, sem intervalo pré-definido (o almoço é adicionado com "+ intervalo"), aulas de 60 min (opções 30/45/50/60/90 ou personalizada), vigência a partir de hoje sem data de fim (atalhos "o ano todo" e "até o fim do ano"). Fins de semana desmarcados por padrão.
- **Sem padrão cadastrado** o dia inteiro conta como disponível (comportamento anterior), mostrado como "não configurado".
- **Padrões que se sobrepõem** somam as faixas; o botão "Horário padrão" edita o primeiro padrão ativo.
- **Feriados:** só nacionais calculados por regra; Carnaval e Corpus Christi vêm como facultativos (desmarcados). Feriados municipais/pessoais são manuais. Aplicar um feriado cria `blocked_dates` e, como já era, cancela as aulas do dia (com aviso e contagem antes).
- **Exceções que removem horário** (fechar dia, substituir, bloquear) ou mudança do padrão: aulas afetadas aparecem antes e a professora escolhe manter, cancelar (como "cancelada pela professora", com reposição) ou desfazer. Nada é cancelado sem perguntar. Desfazer (toast de 6 s) reverte a exceção, mas não reativa aulas já canceladas.
- **Semana:** grade 06:00–23:00 (estende se houver aula fora), linhas de 30 min, seleção com encaixe de 15 min; no celular um dia por vez; visão padrão Dia no celular e Mês no desktop.
- **Fora do escopo:** aulas canceladas não aparecem na grade da semana (aparecem no Dia e no painel do dia); criação de exceção pela grade só com mouse/toque (pelo teclado, usar o painel do dia).

## 14. O que ainda falta construir

- Backup/exportação na área do admin e Meu perfil da professora; agenda virtual para o aluno ver horários livres e pedir reposição.
- Publicar a v0.18.0 (Actions) quando o escopo `workflow` for liberado; deploy no Cloudflare Pages.
- Validar todas as migrations e os testes pgTAP num Supabase local (`supabase start` + `supabase test db`) e testar o fluxo completo com 2 ou 3 alunos reais.
- Regenerar `src/types/database.ts` a partir do banco (hoje escrito à mão; ver `supabase/README.md`).

## 15. Decisões da rodada 8

1. **Sem horário padrão:** o banco continua **permissivo** (qualquer horário fora de férias/feriados/dias fechados/bloqueios) para não travar a operação; o app mostra um alerta forte e persistente no Calendário e em Hoje até existir um padrão. Motivo: bloquear tudo impediria gerar aulas e marcar reposições antes de a professora configurar, e a migração não deve quebrar o que já existe.
2. **Disponibilidade é a regra primária** de todas as aulas (avulsas, horários fixos, reposições e remarcações), no banco (`lessons_availability_rule` → `is_slot_available`) e na tela (sugestões de horários). Aulas existentes não são revalidadas; canceladas/realizadas/falta nunca.
3. **Licença:** repositório público só para leitura/portfólio, sem licença de reuso (`LICENSE`, Pedro Del Col, 2026).
4. **Backup:** o `.gpg` vai para um repositório privado separado (ver `docs/BACKUP.md` na `main` local), mantendo os 12 mais recentes.

## 16. Perguntas em aberto

1. Remarcar uma aula gerada por horário fixo e gerar o mesmo período de novo recria a aula no horário original (limitação antiga). Querem que a remarcação "desligue" a ocorrência original?
2. Criar aula no passado (registro retroativo) hoje não é possível pela tela; precisa?
3. As decisões do calendário da seção 13 (60 min, 09–17 seg–sex, Carnaval/Corpus Christi facultativos) estão boas?
