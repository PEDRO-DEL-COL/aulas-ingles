# Plataforma de Aulas de Inglês

Site estático (SPA) para aulas particulares de inglês: landing page, login de alunos, área da professora e área de administração. Interface em português do Brasil, mobile first.

Contexto e decisões: [PROJETO.md](./PROJETO.md). Pendências: [docs/PENDENCIAS.md](./docs/PENDENCIAS.md).

## Stack

- Vite + React 19 + TypeScript (modo estrito)
- Tailwind CSS v4 + shadcn/ui
- React Router 7 (modo biblioteca, rotas com `React.lazy`)
- ESLint (flat config) + Prettier
- Vitest
- Supabase (back-end, acessado direto do navegador)
- Hospedagem: Cloudflare Pages

## Pré-requisitos

- Node.js 22 (ver `.nvmrc`) e npm

## Como rodar

```bash
npm install
cp .env.example .env   # preencha os valores (somente a chave anon pública!)
npm run dev
```

## Scripts

| Script                 | O que faz                          |
| ---------------------- | ---------------------------------- |
| `npm run dev`          | Servidor de desenvolvimento        |
| `npm run build`        | Checa tipos e gera o build em dist |
| `npm run preview`      | Serve o build localmente           |
| `npm run lint`         | ESLint                             |
| `npm run typecheck`    | Checagem de tipos (tsc)            |
| `npm run format`       | Formata com Prettier               |
| `npm run format:check` | Verifica a formatação              |
| `npm run test`         | Testes (Vitest, uma execução)      |
| `npm run test:watch`   | Testes em modo watch               |

## Estrutura de pastas

```
docs/                pendências e decisões em aberto (PENDENCIAS.md)
public/              arquivos estáticos (favicon, _redirects do Cloudflare Pages)
src/
  components/
    landing/         seções da landing page
    layout/          layouts (RootLayout)
    ui/              componentes shadcn/ui
  config/brand.ts    nome, cores e conteúdo da marca (fonte única)
  hooks/             hooks React
  lib/               utilitários: supabase.ts, pix.ts (BR Code), whatsapp.ts
  pages/             páginas por rota (carregadas com lazy)
    app/             áreas logadas: aluno, professora, admin
  router.tsx         definição das rotas
  main.tsx           ponto de entrada
supabase/
  migrations/        SQL versionado (tabelas, funções, RLS)
  tests/             testes pgTAP das políticas de RLS
```

Banco de dados: veja [supabase/README.md](supabase/README.md). Para aplicar e testar as migrations é preciso a Supabase CLI e o Docker.

## Licença

Todos os direitos reservados.
