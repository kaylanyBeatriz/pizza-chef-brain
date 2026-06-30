# Big Pizza API

API Laravel do sistema Big Pizza. A implementação segue MVC com regras de negócio isoladas em services para pedidos e estoque.

## Requisitos

- PHP 8.2+
- Composer
- SQLite para desenvolvimento local ou outro banco suportado pelo Laravel

## Execução local

```bash
composer install
cp .env.example .env
php artisan key:generate
php artisan migrate --seed
php artisan serve
```

A API fica disponível em `http://127.0.0.1:8000/api`.

## Testes e estilo

```bash
php artisan test
./vendor/bin/pint --test
```

## Endpoints

- `GET /api/health`
- `apiResource /api/ingredients`
- `GET|POST /api/ingredients/{ingredient}/movements`
- `apiResource /api/products`
- `GET|POST /api/products/{product}/recipe`
- `DELETE /api/products/{product}/recipe/{recipeItem}`
- `GET|POST /api/orders`
- `GET /api/orders/{order}`
- `PATCH /api/orders/{order}/status`
- `GET /api/dashboard`
- `GET /api/reports/consumption`
- `GET /api/reports/finance`

Os saldos são bloqueados durante a transação. A conclusão de um pedido valida o estoque, registra uma movimentação por ingrediente e garante que a baixa seja feita uma única vez.

## Acesso inicial

O seeder cria os perfis `admin`, `gerente` e `operador`, além do usuário local `admin@bigpizza.local` com senha `password`. Autenticação e autorização HTTP ainda não estão habilitadas nos endpoints.
