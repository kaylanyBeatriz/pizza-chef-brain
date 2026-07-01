# Big Pizza

Monorepo do sistema de gestão da Big Pizza.

- `frontend/`: React com TanStack Start. Usa Supabase apenas para autenticação.
- `backend/`: API Laravel responsável por todas as consultas, permissões e regras de negócio.
- Supabase PostgreSQL: armazenamento dos dados do sistema.

## Requisitos

- Node.js 20.19+
- npm
- PHP 8.3+
- Composer
- Projeto Supabase e senha do banco PostgreSQL

## Supabase

Antes de testar, execute as migrations SQL pendentes no SQL Editor. Em especial, remova a implementação antiga de estoque no banco usando:

`frontend/supabase/migrations/20260630000600_remove_order_stock_trigger.sql`

A baixa de estoque é executada exclusivamente pelo Laravel.

## Backend

```bash
cd backend
composer install
cp .env.example .env
php artisan key:generate
```

Preencha o `backend/.env`:

```env
APP_URL=http://localhost:8000
FRONTEND_URL=http://localhost:8080,http://localhost:5173

DB_CONNECTION=pgsql
DB_URL=postgresql://USUARIO:SENHA@HOST:PORTA/postgres
DB_SSLMODE=require

SUPABASE_URL=https://SEU_PROJECT_REF.supabase.co
SUPABASE_PUBLISHABLE_KEY=SUA_CHAVE_PUBLICA
```

A string PostgreSQL está no painel Supabase em **Connect > Connection string**. Não use a chave pública como senha do banco.

Inicie a API:

```bash
php artisan serve --host=127.0.0.1 --port=8000
```

Teste o health check em `http://127.0.0.1:8000/api/health`.

## Frontend

```bash
cd frontend
npm ci
cp .env.example .env
npm run dev -- --port 8080
```

Configure as variáveis Supabase e mantenha:

```env
VITE_API_URL=http://localhost:8000/api
```

O frontend envia o token do Supabase Auth no cabeçalho `Authorization`. Nenhuma tabela é acessada diretamente pelo navegador.

## Testes

```bash
cd backend
php artisan test
./vendor/bin/pint --test

cd ../frontend
npm run build
```
