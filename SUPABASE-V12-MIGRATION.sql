drop function if exists public.admin_dashboard_stats();

create function public.admin_dashboard_stats()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  if not public.is_admin() then
    raise exception 'Not authorized';
  end if;

  select jsonb_build_object(
    'total_orders', (select count(*) from public.orders),
    'total_sales', (select coalesce(sum(total), 0) from public.orders where status = 'delivered'),
    'delivered_orders', (select count(*) from public.orders where status = 'delivered'),
    'cancelled_orders', (select count(*) from public.orders where status = 'cancelled'),
    'new_orders', (select count(*) from public.orders where status = 'new'),
    'confirmed_orders', (select count(*) from public.orders where status = 'confirmed'),
    'shipped_orders', (select count(*) from public.orders where status = 'shipped'),
    'best_selling_products', coalesce((
      select jsonb_agg(jsonb_build_object(
        'product_name', x.product_name,
        'size_ml', x.size_ml,
        'quantity_sold', x.quantity_sold,
        'sales', x.sales
      ) order by x.quantity_sold desc)
      from (
        select oi.product_name, oi.size_ml, sum(oi.quantity) as quantity_sold, sum(oi.line_total) as sales
        from public.order_items oi
        join public.orders o on o.id = oi.order_id
        where o.status <> 'cancelled'
        group by oi.product_name, oi.size_ml
        order by quantity_sold desc
        limit 5
      ) x
    ), '[]'::jsonb),
    'recent_orders', coalesce((
      select jsonb_agg(jsonb_build_object(
        'order_number', r.order_number,
        'customer_name', r.customer_name,
        'total', r.total,
        'status', r.status,
        'created_at', r.created_at
      ) order by r.created_at desc)
      from (
        select order_number, first_name || ' ' || last_name as customer_name, total, status, created_at
        from public.orders
        order by created_at desc
        limit 5
      ) r
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.admin_dashboard_stats() from public;
grant execute on function public.admin_dashboard_stats() to authenticated;
