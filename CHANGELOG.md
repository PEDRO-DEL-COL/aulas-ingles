# Changelog

Todas as mudanças relevantes deste projeto são registradas aqui.

O formato segue [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e o projeto usa [Versionamento Semântico](https://semver.org/lang/pt-BR/).

## [Não publicado]

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

[Não publicado]: https://github.com/PEDRO-DEL-COL/aulas-ingles/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/PEDRO-DEL-COL/aulas-ingles/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/PEDRO-DEL-COL/aulas-ingles/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/PEDRO-DEL-COL/aulas-ingles/releases/tag/v0.1.0
