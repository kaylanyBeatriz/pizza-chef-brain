drop trigger if exists trg_deduct_stock on public.orders;
drop function if exists public.deduct_stock_on_complete();

notify pgrst, 'reload schema';
