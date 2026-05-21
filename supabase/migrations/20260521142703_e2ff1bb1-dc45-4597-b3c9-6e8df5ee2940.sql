
-- ============ ENUMS ============
create type public.app_role as enum ('admin', 'gerente', 'operador');
create type public.order_status as enum ('pendente', 'preparando', 'concluido', 'cancelado');
create type public.unit_type as enum ('kg', 'g', 'L', 'ml', 'un');

-- ============ PROFILES ============
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

-- ============ USER ROLES ============
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
alter table public.user_roles enable row level security;

-- security definer to avoid recursion in RLS
create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create or replace function public.has_any_role(_user_id uuid, _roles app_role[])
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = any(_roles))
$$;

-- ============ INGREDIENTS ============
create table public.ingredients (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  unit unit_type not null default 'kg',
  stock_quantity numeric(12,3) not null default 0,
  min_stock numeric(12,3) not null default 0,
  cost_per_unit numeric(12,2) not null default 0,
  supplier text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.ingredients enable row level security;

-- ============ PRODUCTS (PIZZAS) ============
create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  category text not null default 'Pizza',
  price numeric(12,2) not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.products enable row level security;

-- ============ RECIPES (product_ingredients) ============
create table public.product_ingredients (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  ingredient_id uuid not null references public.ingredients(id) on delete restrict,
  quantity numeric(12,3) not null,
  unique (product_id, ingredient_id)
);
alter table public.product_ingredients enable row level security;

-- ============ ORDERS ============
create sequence if not exists public.order_number_seq start 1000;

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number int not null default nextval('public.order_number_seq'),
  status order_status not null default 'pendente',
  customer_name text,
  total numeric(12,2) not null default 0,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);
alter table public.orders enable row level security;

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  quantity int not null default 1,
  unit_price numeric(12,2) not null default 0,
  subtotal numeric(12,2) generated always as (quantity * unit_price) stored
);
alter table public.order_items enable row level security;

-- ============ AUTO STOCK DEDUCTION ============
create or replace function public.deduct_stock_on_complete()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'concluido' and (old.status is distinct from 'concluido') then
    update public.ingredients ing
    set stock_quantity = ing.stock_quantity - sub.total_used,
        updated_at = now()
    from (
      select pi.ingredient_id, sum(pi.quantity * oi.quantity) as total_used
      from public.order_items oi
      join public.product_ingredients pi on pi.product_id = oi.product_id
      where oi.order_id = new.id
      group by pi.ingredient_id
    ) sub
    where ing.id = sub.ingredient_id;
    new.completed_at = now();
  end if;
  return new;
end; $$;

create trigger trg_deduct_stock
before update on public.orders
for each row execute function public.deduct_stock_on_complete();

-- ============ updated_at TRIGGERS ============
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create trigger trg_profiles_updated before update on public.profiles for each row execute function public.set_updated_at();
create trigger trg_ingredients_updated before update on public.ingredients for each row execute function public.set_updated_at();
create trigger trg_products_updated before update on public.products for each row execute function public.set_updated_at();
create trigger trg_orders_updated before update on public.orders for each row execute function public.set_updated_at();

-- ============ AUTO PROFILE + DEFAULT ROLE ON SIGNUP ============
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare is_first boolean;
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email), new.email);

  select not exists (select 1 from public.user_roles) into is_first;
  if is_first then
    insert into public.user_roles (user_id, role) values (new.id, 'admin');
  else
    insert into public.user_roles (user_id, role) values (new.id, 'operador');
  end if;
  return new;
end; $$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- ============ RLS POLICIES ============
-- profiles
create policy "profiles_select_own_or_admin" on public.profiles for select to authenticated
  using (id = auth.uid() or public.has_role(auth.uid(), 'admin'));
create policy "profiles_update_own" on public.profiles for update to authenticated
  using (id = auth.uid());

-- user_roles
create policy "roles_select_self_or_admin" on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));
create policy "roles_admin_all" on public.user_roles for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- ingredients
create policy "ingredients_select_auth" on public.ingredients for select to authenticated using (true);
create policy "ingredients_manage_admin_gerente" on public.ingredients for all to authenticated
  using (public.has_any_role(auth.uid(), array['admin','gerente']::app_role[]))
  with check (public.has_any_role(auth.uid(), array['admin','gerente']::app_role[]));

-- products
create policy "products_select_auth" on public.products for select to authenticated using (true);
create policy "products_manage_admin_gerente" on public.products for all to authenticated
  using (public.has_any_role(auth.uid(), array['admin','gerente']::app_role[]))
  with check (public.has_any_role(auth.uid(), array['admin','gerente']::app_role[]));

-- product_ingredients
create policy "recipes_select_auth" on public.product_ingredients for select to authenticated using (true);
create policy "recipes_manage_admin_gerente" on public.product_ingredients for all to authenticated
  using (public.has_any_role(auth.uid(), array['admin','gerente']::app_role[]))
  with check (public.has_any_role(auth.uid(), array['admin','gerente']::app_role[]));

-- orders
create policy "orders_select_auth" on public.orders for select to authenticated using (true);
create policy "orders_insert_auth" on public.orders for insert to authenticated with check (true);
create policy "orders_update_auth" on public.orders for update to authenticated using (true);
create policy "orders_delete_admin_gerente" on public.orders for delete to authenticated
  using (public.has_any_role(auth.uid(), array['admin','gerente']::app_role[]));

-- order_items
create policy "order_items_select_auth" on public.order_items for select to authenticated using (true);
create policy "order_items_insert_auth" on public.order_items for insert to authenticated with check (true);
create policy "order_items_update_auth" on public.order_items for update to authenticated using (true);
create policy "order_items_delete_auth" on public.order_items for delete to authenticated using (true);
