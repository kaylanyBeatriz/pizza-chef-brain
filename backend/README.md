# Big Pizza API

API Laravel responsável por autenticação de requisições, autorização, dados e regras de negócio da Big Pizza.

## Responsabilidades

- Validar tokens do Supabase Auth.
- Aplicar permissões de admin, gerente e operador.
- CRUD de ingredientes, pizzas e receitas.
- Criar pedidos de forma transacional.
- Deduzir estoque ao concluir pedidos.
- Produzir dados de dashboard, consumo e financeiro.

## Estoque

A conclusão do pedido é processada por `OrderService` e `StockService` dentro de uma transação. Os ingredientes são bloqueados com `FOR UPDATE`, todo o estoque é validado antes da dedução e `stock_deducted` impede repetição.

Não deve existir trigger de dedução no PostgreSQL. Execute a migration SQL de remoção antes de usar esta API.

## Configuração

Consulte o README da raiz para as variáveis `DB_URL`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` e `FRONTEND_URL`.

## Verificação

```bash
php artisan test
./vendor/bin/pint --test
php artisan route:list --path=api
```
