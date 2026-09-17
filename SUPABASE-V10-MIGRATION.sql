-- DOMARO V10 — secure customer order tracking
-- Customer must provide BOTH order number and the same phone number used at checkout.
-- The function intentionally returns no customer name, address, or notes.

drop function if exists public.track_order(text, text);

create function public.track_order(
  p_order_number text,
  p_phone text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  if p_order_number is null
     or btrim(p_order_number) = ''
     or p_phone is null
     or btrim(p_phone) = '' then
    return null;
  end if;

  select jsonb_build_object(
    'order_number', o.order_number,
    'status', o.status,
    'created_at', o.created_at,
    'total', o.total,
    'payment_method', o.payment_method,
    'items',
      coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'product_name', oi.product_name,
              'size_ml', oi.size_ml,
              'quantity', oi.quantity,
              'unit_price', oi.unit_price,
              'line_total', oi.line_total
            )
            order by oi.id
          )
          from public.order_items oi
          where oi.order_id = o.id
        ),
        '[]'::jsonb
      )
  )
  into v_result
  from public.orders o
  where upper(btrim(o.order_number)) = upper(btrim(p_order_number))
    and regexp_replace(o.phone, '[^0-9]', '', 'g')
        = regexp_replace(p_phone, '[^0-9]', '', 'g')
  limit 1;

  return v_result;
end;
$$;

revoke all on function public.track_order(text, text) from public;
grant execute on function public.track_order(text, text) to anon, authenticated;
