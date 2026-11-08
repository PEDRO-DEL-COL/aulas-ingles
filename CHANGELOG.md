# Changelog

Todas as mudanças relevantes deste projeto são registradas aqui.

O formato segue [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e o projeto usa [Versionamento Semântico](https://semver.org/lang/pt-BR/).

## [Não publicado]

## [0.20.0] - 2026-11-08

### Adicionado

- Calendário da professora/admin (`/app/professora/calendario`), componente próprio sem bibliotecas novas e carregado só nessa rota: visões Mês (estado de cada dia por cor + ícone + texto e contagem de aulas), Semana (grade de horas com disponibilidade, bloqueios e aulas lado a lado; um dia por vez no celular) e Dia (lista); navegação Hoje/anterior/próximo/ir para data; visão e data na URL; legenda acessível.
- Exceções por data pelo painel do dia ou arrastando na grade (toque longo no celular): fechar/abrir o dia, mudar o horário só daquele dia, horário extra, bloquear intervalo; atualização otimista e "Desfazer".
- Assistente "Definir horário padrão": dias, início/fim, intervalos, horários diferentes por dia, duração padrão da aula, vigência (o ano todo, até o fim do ano, sem fim) e prévia (dias que mudam, aulas que ficariam fora).
- Feriados nacionais do Brasil sugeridos por regra (com Carnaval e Corpus Christi facultativos), feriados municipais/pessoais e férias por intervalo, com contagem das aulas que serão canceladas antes de confirmar.
- Conflitos: mudanças que removem horário mostram as aulas afetadas e deixam escolher manter, cancelar (com reposição) ou voltar.
- Clicar numa aula abre as ações já existentes (realizada, falta, cancelar, reposição); "Gerar aulas" recorrentes na barra.

### Alterado

- Navegação: "Agenda" virou "Calendário"; Disponibilidade e Férias e feriados saíram do menu Mais. As rotas antigas redirecionam para o calendário e as telas antigas foram removidas.

> A v0.18.0 (GitHub Actions de keepalive e backup) está pronta só localmente, aguardando autorização do escopo `workflow`; esta linha (branch `calendario`) parte da v0.17.0.

## [0.19.0] - 2026-11-08

### Adicionado

- Migration `20261118000001_availability_calendar.sql`: horário padrão com vigência (`availability_patterns`), exceções por data (`availability_exceptions`: fechado, substituir, extra, bloqueio), fuso da professora em `settings.teacher_timezone` e regra efetiva única (`availability_minutes`, `is_slot_available`) usada pela reposição; faixas existentes migradas para um padrão sem fim. Testes pgTAP `availability_calendar.test.sql`.
- Motor puro do calendário (`src/features/calendar/engine.ts`) espelhando a regra do banco, com testes (inclui horário de verão histórico de São Paulo e viradas de dia); feriados nacionais do Brasil calculados localmente (Páscoa, Carnaval, Sexta-feira Santa, Corpus Christi); camada de dados do calendário.

### Alterado

- Tela Disponibilidade cria as faixas dentro do horário padrão (compatível com o modelo novo).

## [0.17.0] - 2026-11-07

### Adicionado

- Planilhas (`/app/professora/planilhas`, em Mais e em Alunos): importar alunos por CSV com modelo para baixar, instruções para Excel e Google Planilhas, validação linha a linha (e-mail Google obrigatório, duplicados, telefone, plano pelo nome), prévia com erros e importação idempotente (e-mails já cadastrados são pulados).
- Exportar alunos, aulas e pagamentos em CSV (separador `;` e BOM para abrir certo no Excel; proteção contra fórmulas).
- Parser/serializador CSV próprio (sem dependências), carregado só nessa tela.

## [0.16.0] - 2026-11-07

### Adicionado

- Formulário "Quero uma aula experimental" na landing (nome, WhatsApp, mensagem, consentimento), com honeypot e tempo mínimo anti-robô, enviado por `fetch` REST com a anon key (sem supabase-js na landing).
- Tela Interessados da professora: filtro por situação, busca, abrir WhatsApp com mensagem pronta, marcar contatado/descartado, anotações e "Converter em aluno" (pré-preenche a ficha e marca o interessado como convertido).
- Migration `20261117000001_leads_guard.sql` (limite de repetição e de envios por hora) e testes pgTAP `leads_guard.test.sql`.

## [0.15.0] - 2026-11-07

### Adicionado

- Disponibilidade da professora (`/app/professora/disponibilidade`, em Mais): faixas semanais por dia (adicionar, editar, ativar/desativar, excluir), aviso de sobreposição e de quando ainda não há faixas.
- Reposição só dentro da disponibilidade e fora de férias/feriados, no banco (trigger) e na tela de agendar reposição (dica das faixas do dia e checagem antes de enviar, com mensagem clara).
- Migration `20261116000001_teacher_availability.sql` e testes pgTAP `availability.test.sql`.

## [0.14.0] - 2026-11-07

### Adicionado

- Vantagens dos planos: catálogo reutilizável (criar, renomear, excluir) e seleção/ordem das vantagens em cada plano, na tela Planos e valores (só admin); a landing mostra as vantagens dos planos ativos.
- Dia de vencimento padrão das mensalidades em Políticas do negócio (`settings.default_due_day`, só admin); "Gerar mensalidades do mês" usa esse padrão (pode ser mudado só para o lote).
- Migration `20261115000001_plan_benefits_due_day.sql` e testes pgTAP `plan_benefits.test.sql`.

### Alterado

- O dia de vencimento do lote deixa de ser lembrado no navegador.

## [0.13.0] - 2026-11-07

### Adicionado

- Seletor "Ver como" (Aluno / Professora / Admin) logo abaixo do botão "Sair", só para admin real: troca menus, rotas e telas para as do papel escolhido e leva à home dele; aviso permanente "Visualizando como … — só prévia" com atalho para voltar a Admin; escolha salva no navegador e validada. Não altera o papel no banco nem a RLS.
- Pré-visualização da área do aluno pelo admin: escolha de um aluno real, somente leitura (ações de escrita desabilitadas).
- Placeholders "Em breve" para Interessados, Meu perfil (professora) e Backup e exportação; menu "Mais" do admin.

### Alterado

- Guardas de rota decidem pelo papel efetivo (real para aluno e professora; o escolhido no seletor para admin); "termos" e "acesso não liberado" continuam pelo perfil real.
- Navegação do admin: Usuários, Planos, Políticas, Pix e contato e Mais (a área da professora fica em Mais).
- Área do aluno filtra materiais e o detalhe da aula pelo aluno explicitamente (antes dependia só da RLS).

## [0.12.0] - 2026-11-07

### Adicionado

- Migration `20261114000001_monthly_invoices_batch.sql`: RPC `generate_monthly_invoices` (só professora/admin) com prévia (`p_dry_run`) e geração idempotente das mensalidades do mês a partir do plano de cada aluno ativo; pula quem já tem a mensalidade do mês, sem plano, plano inativo e planos de pacote/avulsa; testes pgTAP `monthly_invoices.test.sql`.
- Financeiro: "Gerar mensalidades do mês" com mês de referência, dia de vencimento (lembrado no navegador), prévia agrupada com total e confirmação.

## [0.11.0] - 2026-11-07

### Adicionado

- Migration `20261113000001_blocked_dates_cancel.sql`: ao cadastrar (ou ampliar) férias/feriados, o banco cancela as aulas agendadas do período como "cancelada pela professora", com direito a reposição, motivo e vínculo com o período (`lessons.blocked_date_id`); testes pgTAP `blocked_dates.test.sql`.
- Férias e feriados: prévia de quantas aulas serão canceladas (com confirmação), resumo das canceladas depois de salvar com "Agendar reposição" em cada uma, e contagem de aulas canceladas por período.
- Hoje: seção "Reposições a agendar" (aulas com direito a reposição ainda sem reposição).
- Aluno: motivo do cancelamento e situação da reposição ("a professora vai agendar" ou "Reposição agendada para …") na agenda, no histórico e no detalhe da aula.

### Alterado

- Reposição de aula cancelada pela professora (por férias/feriado ou não) deixa de contar no limite mensal de reposições do aluno.

## [0.10.0] - 2026-11-07

### Adicionado

- Migration `20261112000001_public_site_info.sql`: RPC pública `public_site_info()` com exposição mínima (só o WhatsApp da professora e os planos ativos), sem abrir `settings`/`plans` ao visitante; testes pgTAP `public_site_info.test.sql`.
- Landing lê o WhatsApp e os planos ativos do banco por um `fetch` REST simples (sem supabase-js na landing), com estado inicial imediato (cache local ou fallback) e troca silenciosa quando os dados chegam.
- Privacidade e "Acesso não liberado" usam o mesmo WhatsApp; cartão "Falar com a professora" no perfil do aluno (WhatsApp de `settings`).

### Alterado

- `VITE_WHATSAPP_NUMBER` e os planos de `src/config/brand.ts` viram apenas fallback (banco indisponível, não configurado ou vazio).

## [0.9.1] - 2026-11-07

### Corrigido

- `invoices.pix_txid` aceitava 35 caracteres no banco, mas o BR Code só aceita 25: migration `20261111000001_pix_txid_limit.sql` (check `invoices_pix_txid_chk`, valores inválidos viram `NULL`) e validação no front (`isValidTxid`; a tela do Pix ignora txid inválido e gera um novo; o financeiro rejeita antes de gravar).
- Geração de aulas recorrentes não fica mais presa à semana exibida: a Agenda permite escolher a semana exibida ou as próximas 4 ou 8 semanas.

### Documentação

- `src/types/database.ts` continua escrito à mão (gerar exige banco com as migrations); cabeçalho e `supabase/README.md` explicam como regenerar e a regra de atualizar no mesmo commit da migration.

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
