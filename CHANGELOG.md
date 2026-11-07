# Changelog

Todas as mudanças relevantes deste projeto são registradas aqui.

O formato segue [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e o projeto usa [Versionamento Semântico](https://semver.org/lang/pt-BR/).

## [Não publicado]

## [0.9.0] - 2026-11-07

### Adicionado

- Financeiro da professora/admin (`/app/professora/financeiro`): lançar cobrança nos 3 modelos (mensalidade, pacote, avulsa) com pré-preenchimento pelo plano, resumo (em aberto, atrasado, recebido no mês), abas atrasadas/em aberto/pagas/canceladas, marcar como pago e desfazer, cancelar, avisos de "Já paguei" em destaque e lembrete de cobrança por WhatsApp (telefone do pagador ou do aluno).
- Materiais (`/app/professora/materiais`): links gerais para todos os alunos, por aluno ou por aula, com filtro, edição e exclusão.
- Férias e feriados (`/app/professora/feriados`): períodos bloqueados que a geração de aulas recorrentes pula, com aviso quando já existem aulas agendadas no período.
- Tela "Mais" na navegação da professora (Materiais, Férias e feriados e, para admin, Administração); atalhos para o financeiro em Hoje e na ficha do aluno.
- Migration `20261110000001_invoices_finance.sql`: desfazer pagamento limpa `paid_at`/`confirmed_by`, `atrasado` nunca é gravado, mensalidade exige mês de referência e pacote exige quantidade de aulas.

### Alterado

- Navegação da professora: Hoje, Agenda, Alunos, Financeiro e Mais (o item "Admin" foi para "Mais").

## [0.8.0] - 2026-11-07

### Adicionado

- Área do admin (`/app/admin`): Usuários e acessos (busca, filtro, ativar/desativar, trocar papel), Planos e valores (CRUD com os 3 modelos de cobrança), Políticas do negócio (prazo de cancelamento, faixa intermediária, máximo de reposições por mês, texto da política) e Pix e contato (chave, tipo, nome e cidade do recebedor, WhatsApp da professora; tudo pode ficar vazio, com prévia do código Pix).
- Navegação do admin com acesso às telas da professora (e item "Admin" na navegação da professora para quem é admin).
- Migration `20261109000001_admin_area.sql`: no banco, o admin não rebaixa/desativa a si mesmo e o sistema nunca fica sem admin ativo; o app não atribui o papel `responsavel`; `settings` normaliza vazios para `NULL` e valida WhatsApp, Pix completo e limites da política; `plans` exige aulas por mês (mensalidade) ou do pacote (pacote).
- Testes pgTAP `admin_finance.test.sql` e mensagens amigáveis para os novos erros do banco.

### Alterado

- Navegação das áreas extraída para `AreaNav`.

## [0.7.0] - 2026-11-07

### Adicionado

- Área da professora (`/app/professora`): Hoje (aulas do dia, Meet, lembrete por WhatsApp, cobranças atrasadas e decisões de reposição), Agenda da semana (marcar realizada/falta, cancelar, agendar reposição, gerar aulas recorrentes), Alunos (busca e filtro), Ficha do aluno (dados, consentimento do responsável, horários fixos, responsáveis/pagador, anotações privadas, últimas aulas) e Registro da aula (presença, conteúdo, resumo, tarefa, anotação privada, materiais).
- Utilitários testados: conversão de data/hora local para UTC e semana no fuso (só Intl), mensagem de lembrete, validação de e-mail, Meet e telefone, agrupamento por dia.
- Tipos do banco para schedules, private_notes, payers, student_guardians, blocked_dates, leads e RPCs generate_lessons, decide_makeup e schedule_makeup.

### Alterado

- Utilitários compartilhados (datas, erros, relógio, estados de tela) movidos para `src/features/shared/`.

## [0.6.0] - 2026-11-07

### Adicionado

- Área do aluno: Início (próxima aula, contagem regressiva, botão "Entrar na aula" a partir de 15 min antes), Agenda com cancelamento (prévia da regra e resultado real do banco), Histórico e detalhe da aula, Materiais, Financeiro (só as próprias cobranças, "Já paguei"), Pagar via Pix (QR Code e copia e cola; "Pix ainda não configurado" sem chave) e Meu perfil.
- Datas guardadas em UTC e exibidas no fuso do perfil.
- Componentes de UI (card, badge, alert, skeleton, campos, diálogo) e hook de dados simples, sem bibliotecas extras.
- Dependências: `date-fns` e `qrcode.react` (carregado só na tela do Pix).

### Corrigido

- `refreshProfile` não desmonta mais a tela enquanto recarrega o perfil.

## [0.5.0] - 2026-11-07

### Adicionado

- Login com Google via Supabase Auth (PKCE) e página de callback.
- `AuthProvider`/`useAuth`, carregado só nas rotas logadas (a landing não baixa o supabase-js).
- Guarda de rotas por papel (aluno, professora, admin), com retorno seguro à página de origem.
- Telas "Acesso não liberado" (com orientação para criar conta Google) e aceite de termos no primeiro acesso.
- Layout da área logada; tudo degrada com mensagem clara quando o Supabase não está configurado.

## [0.4.0] - 2026-11-07

### Adicionado

- Nova identidade visual: paleta suave (lavanda, pêssego, sálvia, creme) com contraste AA testado, fonte Nunito auto-hospedada, logo em SVG, ilustrações SVG e microanimações que respeitam `prefers-reduced-motion`.
- Landing refeita com a nova identidade; planos de exemplo para mensalidade, pacote e aula avulsa; FAQ sobre aulas individuais e conta Google.
- Política de cancelamento e reposição aplicada no banco: com reposição a partir de 24h (configurável), faixa intermediária opcional, falta sem reposição, limite de reposições por mês; RPCs `cancel_lesson`, `decide_makeup`, `schedule_makeup` e `makeups_used_in_month`.
- Testes pgTAP das regras de cancelamento; `docs/CONTA-GOOGLE.md`.

### Alterado

- Responsável deixa de ser perfil de login (fica como dado da ficha: pagador e consentimento de menor).
- Só admin edita configurações, planos/valores, papéis e exclusões; professora edita alunos, aulas, agenda, materiais e financeiro.
- E-mail da ficha do aluno precisa ter formato válido e ser de uma conta Google.

### Segurança

- Override do `minimatch` para versão corrigida (dependência de desenvolvimento).

## [0.3.0] - 2026-11-07

### Adicionado

- Migrations do Supabase: enums, 14 tabelas (incluindo `payers` e `student_guardians` para separar pagador e responsável do aluno), view `invoices_with_status`, triggers e RPCs (`mark_invoice_as_paid_notice`, `accept_terms`, `generate_lessons`).
- Row Level Security em todas as tabelas: aluno só vê o próprio, responsável vê o do aluno vinculado, professora/admin veem tudo, `private_notes` só para staff, `leads` com inserção pública.
- Gatilho que liga `auth.users` à ficha em `students`/`student_guardians` pelo e-mail (confirmado) no primeiro login, ou quando a ficha é criada depois.
- Testes pgTAP das políticas (`supabase/tests/rls.test.sql`).
- `src/lib/supabase.ts` (cliente sob demanda, só chave anon) e `src/lib/pix.ts` (BR Code Pix com CRC16, com testes usando o exemplo do manual do Banco Central).
- `docs/PENDENCIAS.md` com o passo a passo do que depende do usuário e as decisões em aberto.

## [0.2.0] - 2026-11-07

### Adicionado

- Landing page em pt-BR, mobile first: hero, sobre, como funcionam as aulas, planos, depoimentos (exemplos marcados), FAQ, CTA final e rodapé.
- Botões de WhatsApp (`wa.me` com mensagem pronta) usando `VITE_WHATSAPP_NUMBER`, incluindo botão flutuante no celular.
- `src/config/brand.ts` como fonte única de nome, cores, planos, depoimentos e FAQ (valores provisórios).
- Página de Política de Privacidade e Termos de Uso (rascunho LGPD a revisar).
- Título e meta description por página; tags Open Graph.

## [0.1.0] - 2026-11-07

### Adicionado

- Scaffold com Vite 6, React 19, TypeScript estrito, Tailwind CSS v4 e shadcn/ui.
- React Router 7 com rotas carregadas sob demanda (`/`, `/privacidade`, `/login`, `/app/aluno/*`, `/app/professora/*`, `/app/admin/*`, 404).
- ESLint (type-aware), Prettier, Vitest e scripts `dev`, `build`, `lint`, `typecheck`, `test`, `format`.
- `.env.example`, `_redirects` para SPA no Cloudflare Pages, README em pt-BR, `CLAUDE.md` e briefing do projeto.

[Não publicado]: https://github.com/PEDRO-DEL-COL/aulas-ingles/compare/v0.7.0...HEAD
[0.7.0]: https://github.com/PEDRO-DEL-COL/aulas-ingles/compare/v0.6.0...v0.7.0
[0.6.0]: https://github.com/PEDRO-DEL-COL/aulas-ingles/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/PEDRO-DEL-COL/aulas-ingles/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/PEDRO-DEL-COL/aulas-ingles/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/PEDRO-DEL-COL/aulas-ingles/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/PEDRO-DEL-COL/aulas-ingles/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/PEDRO-DEL-COL/aulas-ingles/releases/tag/v0.1.0
