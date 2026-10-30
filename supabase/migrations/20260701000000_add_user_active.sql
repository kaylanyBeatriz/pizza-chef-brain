alter table public.users
  add column if not exists active boolean not null default true;

update public.users
set active = true
where active is null;

notify pgrst, 'reload schema';
