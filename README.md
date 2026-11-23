# Big Pizza — Despesas e contas a pagar

Sistema interno para cadastrar despesas, acompanhar vencimentos, registrar pagamentos e consultar relatórios da pizzaria.

## Escopo

- Dashboard de despesas pagas, categorias e contas em aberto.
- Cadastro, edição e exclusão de despesas, com fornecedor, vencimento, forma de pagamento e observações.
- Repetição mensal de lançamentos, criada pela interface como registros independentes.
- Contas a pagar por mês, incluindo atrasadas de meses anteriores, baixa e estorno de pagamento.
- Categorias de despesas e exportação de lançamentos em CSV.
- Relatórios por período e categoria, com CSV e impressão/PDF pelo navegador.
- Acesso pelo botão "Acessar o site", sem conta (ver **Segurança**).

## Estrutura

- `src/`: telas em React, TypeScript e TanStack Start.
- `src/server/finance/`: API (`/api/*`), que roda no mesmo Cloudflare Worker das telas e conecta direto no PostgreSQL do Supabase. Rota em `src/routes/api/$.ts`.
- `supabase/migrations/20261116000000_finance_tables.sql`: tabelas `transactions` e `categories` usadas pela API.
- `backend/`: API Laravel anterior, **não usada mais**. A API em `src/server/finance/` reproduz as mesmas rotas e regras (comparada resposta a resposta com ela).

## Requisitos

Node.js 20.19+, npm e um projeto Supabase.

## Banco de dados

No Supabase, abra **SQL Editor**, cole o conteúdo de `supabase/migrations/20261116000000_finance_tables.sql` e execute. O script pode rodar mais de uma vez e não recria tabelas que já existam (inclusive as criadas antes pelo Laravel). Ele também liga o RLS dessas tabelas, para a chave pública do Supabase não dar acesso direto a elas.

## Rodar localmente

```bash
npm ci
cp .dev.vars.example .dev.vars   # preencha DATABASE_URL
npm run dev -- --port 8080
```

`DATABASE_URL` é a connection string do Supabase em **Connect > Transaction pooler** (porta 6543). O `.dev.vars` não vai para o Git.

Health check: `http://localhost:8080/api/health`.

## Publicar no Cloudflare Workers

```bash
npx wrangler login                    # uma vez
npx wrangler secret put DATABASE_URL  # uma vez: cole a connection string do Supabase
npm run build
npx wrangler deploy
```

O endereço publicado aparece no fim do deploy (`https://pizza-chef-brain.<subdominio>.workers.dev`). Para atualizar, repita `npm run build` e `npx wrangler deploy`.

## Segurança

O site e a API não pedem login. Antes de divulgar o endereço, proteja o acesso com o **Cloudflare Access** (Workers & Pages > pizza-chef-brain > Settings > Domains & Routes > ativar Access no `workers.dev`) e cadastre os emails autorizados. Como a API roda no mesmo endereço do site, a proteção cobre os dois.

## Períodos

Lançamentos e contas mensais são filtrados por vencimento. Dashboard e relatórios calculam despesas realizadas pela data do pagamento. Os indicadores de contas em aberto no resumo financeiro consideram apenas os vencimentos dentro do período selecionado, incluindo as datas inicial e final. Datas de "hoje" seguem o fuso de São Paulo.

A API ainda aceita entradas e saídas (`type`: `income`/`expense`); a interface trabalha com despesas.

## Verificação

```bash
npx tsc --noEmit
npm run lint
npm run build
npx wrangler deploy --dry-run
```
