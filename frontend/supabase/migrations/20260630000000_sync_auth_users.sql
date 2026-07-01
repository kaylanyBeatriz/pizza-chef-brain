create or replace function public.sync_auth_user_to_public_users()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, name, email, password)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    new.email,
    ''
  )
  on conflict (id) do update
  set name = excluded.name,
      email = excluded.email;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert or update of email, raw_user_meta_data on auth.users
for each row execute function public.sync_auth_user_to_public_users();

insert into public.users (id, name, email, password)
select
  auth_users.id,
  coalesce(auth_users.raw_user_meta_data->>'full_name', auth_users.email),
  auth_users.email,
  ''
from auth.users auth_users
on conflict (id) do update
set name = excluded.name,
    email = excluded.email;

alter table public.users enable row level security;

drop policy if exists "users_select_own" on public.users;
create policy "users_select_own" on public.users
for select to authenticated
using (id = auth.uid());

revoke select on table public.users from anon, authenticated;
grant select (id, name, email) on table public.users to authenticated;
