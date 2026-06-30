# Big Pizza

Monorepo do sistema de controle da Big Pizza.

- `frontend/`: aplicação React com TanStack Start e Supabase.
- `backend/`: API PHP com Laravel.

> Atualmente, o frontend ainda consulta o Supabase diretamente. A integração das telas com a API Laravel será feita em uma etapa posterior.

## Requisitos

- Node.js 20.19 ou superior
- npm
- PHP 8.3 ou superior
- Composer
- Projeto Supabase configurado para autenticação e dados do frontend

## Clonar o projeto

```bash
git clone https://github.com/kaylanyBeatriz/pizza-chef-brain.git
cd pizza-chef-brain
```

## Frontend

Entre no diretório e instale as dependências:

```bash
cd frontend
npm ci
```

Crie o arquivo `frontend/.env`:

```env
SUPABASE_PROJECT_ID=seu-project-id
SUPABASE_PUBLISHABLE_KEY=sua-chave-publica
SUPABASE_URL=https://seu-projeto.supabase.co

VITE_SUPABASE_PROJECT_ID=seu-project-id
VITE_SUPABASE_PUBLISHABLE_KEY=sua-chave-publica
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
```

Use apenas a chave pública no frontend. Não coloque a chave `service_role` em variáveis expostas pelo Vite.

Inicie o servidor:

```bash
npm run dev
```

O Vite informará o endereço local, normalmente `http://localhost:5173`.

### Migrations do Supabase

Para aplicar as migrations em um projeto com acesso autorizado:

```bash
supabase login
supabase link --project-ref bagskxysamopkkzuqxav
supabase db push
```

## Backend

Em outro terminal:

```bash
cd backend
composer install
cp .env.example .env
php artisan key:generate
touch database/database.sqlite
php artisan migrate --seed
php artisan serve
```

A API ficará disponível em:

- API: `http://127.0.0.1:8000/api`
- Health check: `http://127.0.0.1:8000/api/health`

O seeder local cria:

- E-mail: `admin@bigpizza.local`
- Senha: `password`

Esse usuário pertence ao Laravel e ainda não autentica o frontend, que continua usando o Supabase Auth.

## Testes

Backend:

```bash
cd backend
php artisan test
./vendor/bin/pint --test
```

Frontend:

```bash
cd frontend
npx tsc --noEmit
npm run build
```

## Estrutura

```text
pizza-chef-brain/
|-- backend/   API Laravel, regras de pedidos e estoque
|-- frontend/  Interface React, autenticação e acesso atual ao Supabase
`-- README.md
```
