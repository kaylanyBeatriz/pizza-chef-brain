# Big Pizza API

API Laravel para despesas, contas a pagar, pagamentos, categorias e administração de usuários.

## Responsabilidades

- Validar tokens do Supabase Auth e bloquear usuários desativados.
- Aplicar permissões de administrador e gerente ao financeiro.
- Cadastrar, consultar, editar e excluir lançamentos financeiros.
- Registrar pagamentos e desfazer baixas.
- Gerenciar categorias e atualizar os lançamentos ao renomeá-las.
- Produzir totais realizados por data de pagamento, séries diárias e agrupamentos por categoria.
- Administrar perfis e status de usuários, protegendo o próprio acesso e o último administrador ativo.

## Endpoints

- `GET /api/health`: disponibilidade da API.
- `GET /api/me`: perfil autenticado.
- `/api/finance/summary`: resumo financeiro.
- `/api/finance/transactions`: cadastro e consulta de lançamentos.
- `/api/finance/transactions/{id}/pay` e `/unpay`: baixa e estorno.
- `/api/finance/categories`: cadastro de categorias.
- `/api/users`: administração de usuários.

O financeiro exige perfil `admin` ou `gerente`; usuários exigem `admin`. Consulte `routes/api.php` para os métodos de cada operação.

A repetição mensal é feita pelo frontend através de múltiplos cadastros; não há agendamento de recorrências no backend. O contrato de entradas e saídas foi preservado, enquanto a interface é dedicada a despesas.

## Configuração e banco

Consulte o README da raiz para instalação, variáveis de ambiente, migrations e sincronização com Supabase Auth. Nenhuma remoção de dados existentes faz parte da limpeza do escopo operacional.

## Verificação

```bash
php artisan test
./vendor/bin/pint --test
php artisan route:list --path=api
```

Os testes de API usam SQLite em memória. Os testes financeiros e administrativos utilizam bypass de autenticação; os testes específicos de autenticação simulam as respostas HTTP do Supabase.
