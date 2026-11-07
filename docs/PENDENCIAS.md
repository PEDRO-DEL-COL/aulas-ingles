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

## 9. Migrations a aplicar no Supabase remoto (v0.8.0 a v0.9.1)

Aplicar **nesta ordem** (`supabase db push` aplica as pendentes em ordem):

1. `20261109000001_admin_area.sql` — proteção de admins (não se rebaixa/desativa; nunca fica sem admin ativo), normalização e checks de `settings` (Pix vazio ou completo, WhatsApp só dígitos, limites da política) e de `plans`.
2. `20261110000001_invoices_finance.sql` — desfazer pagamento limpa `paid_at`/`confirmed_by`; `atrasado` nunca gravado; mensalidade exige mês, pacote exige quantidade de aulas.
3. `20261111000001_pix_txid_limit.sql` — `pix_txid` limitado a 25 alfanuméricos.

Atenção: depois da 1ª, **excluir o login do último admin ativo** (Authentication > Users) passa a ser bloqueado pelo banco; promova outro admin antes. Os checks novos de `plans`, `invoices` e parte de `settings` são `NOT VALID` (não travam por dados antigos, mas valem para inserções e edições). Os testes pgTAP (`supabase/tests/admin_finance.test.sql` e ajustes em `rls.test.sql`) ainda não foram executados (sem Docker).

## 10. Perguntas novas (v0.8–v0.9)

1. **WhatsApp da professora** (`settings.whatsapp_number`, editável pelo admin): hoje só é guardado. Querem que a landing e a área do aluno usem esse número em vez do `VITE_WHATSAPP_NUMBER` do build?
2. **Planos da landing**: a landing ainda mostra os planos de `src/config/brand.ts`. Querem que ela leia os planos ativos do banco (tela Planos e valores)?
3. **Feriados com aulas já geradas**: hoje a tela só avisa quantas aulas existem no período; a professora cancela na Agenda. Preferem cancelamento automático (como "cancelada pela professora", com direito a reposição)?
4. **Mensalidades do mês em lote** (gerar as cobranças de todos os alunos a partir do plano) — é a próxima prioridade do financeiro?

## 11. O que ainda falta construir

- Interessados (leads da landing, Fase 2), backup/exportação (admin) e mensalidades geradas em lote.
- GitHub Actions (consulta contra a pausa e backup) e deploy no Cloudflare Pages — dependem das contas e segredos acima.
- Validar todas as migrations e os testes pgTAP num Supabase local (`supabase start` + `supabase test db`) e testar o fluxo completo com 2 ou 3 alunos reais.
- Regenerar `src/types/database.ts` a partir do banco (hoje escrito à mão; ver `supabase/README.md`).
