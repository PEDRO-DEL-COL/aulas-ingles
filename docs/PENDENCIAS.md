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

## 6. Conteúdo a revisar antes de divulgar

- `src/config/brand.ts`: nome do negócio, nome da professora, slogan, texto "sobre", planos e preços, FAQ, redes sociais, e-mail de contato, foro.
- Depoimentos: hoje são **exemplos** (com selo visível). Trocar por depoimentos reais com autorização dos alunos.
- Foto da professora (hoje há um bloco com iniciais; ver `src/components/landing/About.tsx`).
- `index.html`: título e tags Open Graph estão fixos com o nome provisório.
- **Privacidade e Termos** (`src/pages/Privacidade.tsx`): é um rascunho; precisa de revisão, idealmente por um profissional, e dos dados reais da controladora, prazo de retenção e política de cancelamento.

## 7. Decisões em aberto (perguntas)

1. **Modelo de cobrança:** mensalidade fixa, pacote de aulas ou aula avulsa? (O banco já aceita os três: `billing_model` em `plans` e `invoices`.)
2. **Ela dá aula para menores de idade?** Se sim, o perfil "responsável" e o consentimento do responsável entram no MVP.
3. **Todos os alunos têm conta Google?** Quem não tiver precisará criar uma (o login é só Google).
4. **Só aulas individuais ou também em grupo?** O modelo atual é 1 aluno por aula.
5. **Qual chave Pix aparece e em nome de quem?** (tipo da chave, nome e cidade do recebedor — vão para a tabela `settings`.)
6. **Quantos alunos hoje e em um ano? Algum mora fora do Brasil?** (impacta fuso horário e forma de pagamento.)
7. **Política de cancelamento e reposição:** com quantas horas de antecedência pode remarcar sem custo? Falta conta como aula dada? Quantas reposições por mês?
8. **Nome do negócio, identidade visual (logo, cores, fotos) e se vale pagar o domínio `.com.br`** (~R$ 40/ano).
9. **Quem é o responsável financeiro deve ser o único a ver as cobranças?** Hoje qualquer responsável vinculado ao aluno vê o financeiro (fácil de restringir).
10. **A professora pode editar as configurações (Pix, política)** ou só o admin? Hoje professora e admin podem; trocar papéis e liberar/desativar usuários é só do admin.
