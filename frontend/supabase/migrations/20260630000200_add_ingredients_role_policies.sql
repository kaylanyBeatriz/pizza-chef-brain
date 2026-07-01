alter table public.ingredients enable row level security;

drop policy if exists "ingredients_select_authenticated" on public.ingredients;
create policy "ingredients_select_authenticated"
on public.ingredients
for select
to authenticated
using (
  exists (
    select 1
    from public.users
    where users.id = auth.uid()
  )
);

drop policy if exists "ingredients_insert_admin_manager" on public.ingredients;
create policy "ingredients_insert_admin_manager"
on public.ingredients
for insert
to authenticated
with check (
  exists (
    select 1
    from public.users
    where users.id = auth.uid()
      and users.role in ('admin', 'gerente')
  )
);

drop policy if exists "ingredients_update_admin_manager" on public.ingredients;
create policy "ingredients_update_admin_manager"
on public.ingredients
for update
to authenticated
using (
  exists (
    select 1
    from public.users
    where users.id = auth.uid()
      and users.role in ('admin', 'gerente')
  )
)
with check (
  exists (
    select 1
    from public.users
    where users.id = auth.uid()
      and users.role in ('admin', 'gerente')
  )
);

drop policy if exists "ingredients_delete_admin_manager" on public.ingredients;
create policy "ingredients_delete_admin_manager"
on public.ingredients
for delete
to authenticated
using (
  exists (
    select 1
    from public.users
    where users.id = auth.uid()
      and users.role in ('admin', 'gerente')
  )
);

grant select, insert, update, delete
on table public.ingredients
to authenticated;
