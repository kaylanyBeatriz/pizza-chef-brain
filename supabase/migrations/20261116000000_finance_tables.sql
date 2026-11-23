-- Tabelas do financeiro usadas pela API que roda no Cloudflare Workers (src/server/finance).
-- Mesma estrutura das migrations do Laravel (backend/database/migrations/2026_10_29_*),
-- então é seguro rodar num banco onde o Laravel já criou as tabelas: nada é recriado.

create table if not exists public.transactions (
  id bigserial primary key,
  type varchar(10) not null,
  description varchar(255) not null,
  category varchar(80) not null default 'Outros',
  amount numeric(12, 2) not null,
  payment_method varchar(30),
  counterparty varchar(255),
  due_date date not null,
  paid_at date,
  notes text,
  created_at timestamp(0) without time zone,
  updated_at timestamp(0) without time zone
);

create index if not exists transactions_type_index on public.transactions (type);
create index if not exists transactions_due_date_index on public.transactions (due_date);
create index if not exists transactions_paid_at_index on public.transactions (paid_at);

create table if not exists public.categories (
  id bigserial primary key,
  type varchar(10) not null,
  name varchar(80) not null,
  created_at timestamp(0) without time zone,
  updated_at timestamp(0) without time zone,
  constraint categories_type_name_unique unique (type, name)
);

insert into public.categories (type, name, created_at, updated_at)
select v.type, v.name, now(), now()
from (values
  ('income', 'Vendas balcão'), ('income', 'Delivery'), ('income', 'Eventos'), ('income', 'Outras receitas'),
  ('expense', 'Aluguel'), ('expense', 'Luz'), ('expense', 'Água'), ('expense', 'Gás'), ('expense', 'Impostos'),
  ('expense', 'Marketing'), ('expense', 'Manutenção'), ('expense', 'Entregas'), ('expense', 'Outras despesas')
) as v(type, name)
on conflict (type, name) do nothing;

-- A chave pública do Supabase fica no navegador. Sem RLS, ela permitiria ler e alterar
-- estas tabelas pela API REST do Supabase. Com RLS ligado e nenhuma policy, esse caminho
-- fica fechado; a API do Workers conecta direto no Postgres e não é afetada.
alter table public.transactions enable row level security;
alter table public.categories enable row level security;
