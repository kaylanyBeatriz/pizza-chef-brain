alter table public.orders enable row level security;
alter table public.order_items enable row level security;

drop policy if exists "orders_select_authenticated" on public.orders;
create policy "orders_select_authenticated"
on public.orders for select to authenticated
using (exists (
  select 1 from public.users where users.id = auth.uid()
));

drop policy if exists "orders_insert_authenticated" on public.orders;
create policy "orders_insert_authenticated"
on public.orders for insert to authenticated
with check (exists (
  select 1 from public.users where users.id = auth.uid()
));

drop policy if exists "orders_update_authenticated" on public.orders;
create policy "orders_update_authenticated"
on public.orders for update to authenticated
using (exists (
  select 1 from public.users where users.id = auth.uid()
))
with check (exists (
  select 1 from public.users where users.id = auth.uid()
));

drop policy if exists "orders_delete_admin_manager" on public.orders;
create policy "orders_delete_admin_manager"
on public.orders for delete to authenticated
using (exists (
  select 1 from public.users
  where users.id = auth.uid()
    and users.role in ('admin', 'gerente')
));

drop policy if exists "order_items_select_authenticated" on public.order_items;
create policy "order_items_select_authenticated"
on public.order_items for select to authenticated
using (exists (
  select 1 from public.users where users.id = auth.uid()
));

drop policy if exists "order_items_insert_authenticated" on public.order_items;
create policy "order_items_insert_authenticated"
on public.order_items for insert to authenticated
with check (exists (
  select 1 from public.users where users.id = auth.uid()
));

drop policy if exists "order_items_update_authenticated" on public.order_items;
create policy "order_items_update_authenticated"
on public.order_items for update to authenticated
using (exists (
  select 1 from public.users where users.id = auth.uid()
))
with check (exists (
  select 1 from public.users where users.id = auth.uid()
));

drop policy if exists "order_items_delete_authenticated" on public.order_items;
create policy "order_items_delete_authenticated"
on public.order_items for delete to authenticated
using (exists (
  select 1 from public.users where users.id = auth.uid()
));

grant select, insert, update, delete on table public.orders to authenticated;
grant select, insert, update, delete on table public.order_items to authenticated;
grant usage, select on all sequences in schema public to authenticated;

notify pgrst, 'reload schema';
