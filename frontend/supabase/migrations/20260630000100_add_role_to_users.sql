alter table public.users
  add column if not exists role text;

update public.users
set role = 'operador'
where role is null;

alter table public.users
  alter column role set default 'operador',
  alter column role set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'users_role_check'
  ) then
    alter table public.users
      add constraint users_role_check
      check (role in ('admin', 'gerente', 'operador'));
  end if;
end;
$$;

update public.users
set role = 'admin'
where id = (
  select public_users.id
  from public.users public_users
  join auth.users auth_users on auth_users.id = public_users.id
  order by auth_users.created_at
  limit 1
)
and not exists (
  select 1 from public.users where role = 'admin'
);

create or replace function public.sync_auth_user_to_public_users()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  initial_role text;
begin
  perform pg_advisory_xact_lock(hashtext('big_pizza_user_signup'));

  initial_role := case
    when exists (select 1 from public.users where role = 'admin') then 'operador'
    else 'admin'
  end;

  insert into public.users (id, name, email, password, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    new.email,
    '',
    initial_role
  )
  on conflict (id) do update
  set name = excluded.name,
      email = excluded.email;

  return new;
end;
$$;

revoke execute on function public.sync_auth_user_to_public_users()
from public, anon, authenticated;

grant select (role) on table public.users to authenticated;
