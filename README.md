# Big Pizza — Despesas e contas a pagar

Sistema interno para cadastrar despesas, acompanhar vencimentos, registrar pagamentos e consultar relatórios da pizzaria.

## Escopo

- Dashboard de despesas pagas, categorias e contas em aberto.
- Cadastro, edição e exclusão de despesas, com fornecedor, vencimento, forma de pagamento e observações.
- Repetição mensal de lançamentos, criada pela interface como registros independentes.
- Contas a pagar por mês, incluindo atrasadas de meses anteriores, baixa e estorno de pagamento.
- Categorias de despesas e exportação de lançamentos em CSV.
- Relatórios por período e categoria, com CSV e impressão/PDF pelo navegador.
- Cadastro, login e recuperação de senha pelo Supabase Auth.
- Administração de perfis e ativação/desativação de usuários.

## Estrutura

- `src/`: frontend React, TypeScript e TanStack Start, na raiz do repositório.
- `backend/`: API Laravel, responsável por dados, permissões e regras de negócio.
- `backend/database/migrations/`: estrutura do banco da aplicação.
- `supabase/migrations/`: sincronização opcional entre Supabase Auth e usuários da aplicação.

O navegador usa Supabase apenas para autenticação e envia o token no cabeçalho `Authorization` à API Laravel. Os dados financeiros são acessados pela API, que se conecta ao PostgreSQL do Supabase.

## Requisitos

Node.js 20.19+, npm, PHP 8.3+, Composer e um projeto Supabase com acesso ao PostgreSQL.

## Backend

```bash
cd backend
composer install
cp .env.example .env
php artisan key:generate
```

Configure `backend/.env`:

```env
APP_URL=http://localhost:8000
FRONTEND_URL=http://localhost:8080,http://localhost:5173
DB_CONNECTION=pgsql
DB_URL=postgresql://USUARIO:SENHA@HOST:PORTA/postgres
DB_SSLMODE=require
SUPABASE_URL=https://SEU_PROJECT_REF.supabase.co
SUPABASE_PUBLISHABLE_KEY=SUA_CHAVE_PUBLICA
```

A conexão PostgreSQL está em **Connect > Connection string** no Supabase. A chave pública não é a senha do banco.

Em um banco novo, execute `php artisan migrate` antes de aplicar os scripts de sincronização de usuários em `supabase/migrations/`, em ordem cronológica, pelo SQL Editor. Esses scripts pressupõem a tabela `public.users` criada pelo Laravel.

A API também cria automaticamente o cadastro local de identidades válidas ausentes, com perfil `operador`. O administrador precisa promover os usuários que terão acesso ao financeiro. Sem os scripts de sincronização, o primeiro administrador deve ser provisionado com o mesmo UUID da conta no Supabase Auth; o seeder local não cria uma identidade no Supabase.

```bash
php artisan serve --host=127.0.0.1 --port=8000
```

Health check: `http://127.0.0.1:8000/api/health`.

## Frontend

Na raiz do repositório:

```bash
npm ci
cp .env.example .env
npm run dev -- --port 8080
```

Preencha as variáveis Supabase e `VITE_API_URL=http://localhost:8000/api`. Configure no Supabase os endereços de redirecionamento de confirmação de email e recuperação de senha.

## Permissões e períodos

Administradores e gerentes acessam o financeiro; somente administradores gerenciam usuários. O perfil operador permanece para contas sem acesso financeiro, até a liberação por um administrador.

Lançamentos e contas mensais são filtrados por vencimento. Dashboard e relatórios calculam despesas realizadas pela data do pagamento. Os indicadores de contas em aberto no resumo financeiro consideram apenas os vencimentos dentro do período selecionado, incluindo as datas inicial e final.

O contrato financeiro existente ainda aceita entradas e saídas na API; a interface trabalha com despesas.

## Bancos existentes

A limpeza de código não executa exclusão de tabelas, registros ou dados locais do navegador. Os endpoints e a implementação do antigo escopo operacional foram retirados. As migrations antigas permanecem como marcadores vazios para preservar os identificadores do histórico, sem criar ou excluir tabelas. Em instalações existentes, suas tabelas e dados permanecem no banco. Esses marcadores não recriam o schema antigo em rollbacks; use a versão correspondente no Git para manutenção do escopo anterior. Não use `migrate:fresh` em bancos com dados a preservar.

A antiga tela `/financeiro`, que armazenava contas somente no navegador, foi retirada. Seus registros locais não são importados automaticamente para a API.

## Verificação

```bash
cd backend
php artisan test
./vendor/bin/pint --test
php artisan route:list --path=api
```

Na raiz:

```bash
npx tsc --noEmit
npm run build
npm run lint
```
