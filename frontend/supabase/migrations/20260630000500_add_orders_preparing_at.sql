alter table public.orders
  add column if not exists preparing_at timestamptz;

notify pgrst, 'reload schema';
