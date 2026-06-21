
ALTER TABLE public.orders 
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS stock_deducted BOOLEAN NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.deduct_stock_on_complete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
begin
  if new.status = 'concluido' and (old.status is distinct from 'concluido') and coalesce(old.stock_deducted, false) = false then
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
    new.stock_deducted = true;
  end if;
  if new.status = 'preparando' and (old.status is distinct from 'preparando') and new.started_at is null then
    new.started_at = now();
  end if;
  if new.status = 'cancelado' and (old.status is distinct from 'cancelado') and new.cancelled_at is null then
    new.cancelled_at = now();
  end if;
  return new;
end; $function$;
