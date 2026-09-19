create or replace function public.admin_dashboard_report(
  p_days integer default 30
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_days integer;
  v_today date := (now() at time zone 'Africa/Cairo')::date;
  v_start_date date;
  v_prev_start_date date;
  v_prev_end_date date;
  v_trend_start_date date;
  v_result jsonb;
begin
  if not public.has_admin_permission('dashboard') then
    raise exception 'Not authorized to view dashboard reporting'
      using errcode = '42501';
  end if;

  v_days := case when p_days in (0, 7, 30, 90) then p_days else 30 end;

  if v_days > 0 then
    v_start_date := v_today - (v_days - 1);
    v_prev_end_date := v_start_date - 1;
    v_prev_start_date := v_prev_end_date - (v_days - 1);
  else
    v_start_date := null;
    v_prev_start_date := null;
    v_prev_end_date := null;
  end if;

  v_trend_start_date := case
    when v_days = 0 or v_days > 30 then v_today - 29
    else v_start_date
  end;

  with
  all_customer_orders as (
    select
      o.id,
      case
        when regexp_replace(coalesce(o.phone,''), '[^0-9]', '', 'g') like '0020%'
          then substring(regexp_replace(coalesce(o.phone,''), '[^0-9]', '', 'g') from 5)
        when regexp_replace(coalesce(o.phone,''), '[^0-9]', '', 'g') like '20%'
             and length(regexp_replace(coalesce(o.phone,''), '[^0-9]', '', 'g')) >= 12
          then substring(regexp_replace(coalesce(o.phone,''), '[^0-9]', '', 'g') from 3)
        when regexp_replace(coalesce(o.phone,''), '[^0-9]', '', 'g') like '0%'
          then substring(regexp_replace(coalesce(o.phone,''), '[^0-9]', '', 'g') from 2)
        else regexp_replace(coalesce(o.phone,''), '[^0-9]', '', 'g')
      end as customer_key
    from public.orders o
  ),
  period_orders as (
    select o.*
    from public.orders o
    where v_start_date is null
       or (o.created_at at time zone 'Africa/Cairo')::date between v_start_date and v_today
  ),
  previous_orders as (
    select o.*
    from public.orders o
    where v_days > 0
      and (o.created_at at time zone 'Africa/Cairo')::date between v_prev_start_date and v_prev_end_date
  ),
  period_customer_keys as (
    select distinct
      case
        when regexp_replace(coalesce(po.phone,''), '[^0-9]', '', 'g') like '0020%'
          then substring(regexp_replace(coalesce(po.phone,''), '[^0-9]', '', 'g') from 5)
        when regexp_replace(coalesce(po.phone,''), '[^0-9]', '', 'g') like '20%'
             and length(regexp_replace(coalesce(po.phone,''), '[^0-9]', '', 'g')) >= 12
          then substring(regexp_replace(coalesce(po.phone,''), '[^0-9]', '', 'g') from 3)
        when regexp_replace(coalesce(po.phone,''), '[^0-9]', '', 'g') like '0%'
          then substring(regexp_replace(coalesce(po.phone,''), '[^0-9]', '', 'g') from 2)
        else regexp_replace(coalesce(po.phone,''), '[^0-9]', '', 'g')
      end as customer_key
    from period_orders po
  ),
  customer_lifetime_counts as (
    select customer_key, count(*) as lifetime_orders
    from all_customer_orders
    where customer_key <> ''
    group by customer_key
  ),
  trend_days as (
    select generate_series(v_trend_start_date, v_today, interval '1 day')::date as day
  ),
  trend as (
    select
      d.day,
      count(o.id) as order_count,
      coalesce(sum(case when o.status = 'delivered' then o.total else 0 end), 0) as revenue
    from trend_days d
    left join public.orders o
      on (o.created_at at time zone 'Africa/Cairo')::date = d.day
    group by d.day
    order by d.day
  )
  select jsonb_build_object(
    'period_days', v_days,
    'period_start', v_start_date,
    'period_end', v_today,
    'total_orders', (select count(*) from period_orders),
    'total_sales', (select coalesce(sum(total), 0) from period_orders where status = 'delivered'),
    'average_order_value', (select coalesce(avg(total), 0) from period_orders where status = 'delivered'),
    'delivered_orders', (select count(*) from period_orders where status = 'delivered'),
    'cancelled_orders', (select count(*) from period_orders where status = 'cancelled'),
    'new_orders', (select count(*) from period_orders where status = 'new'),
    'confirmed_orders', (select count(*) from period_orders where status = 'confirmed'),
    'shipped_orders', (select count(*) from period_orders where status = 'shipped'),
    'delivery_rate', (
      select case when count(*) = 0 then 0
                  else round((count(*) filter (where status = 'delivered'))::numeric * 100 / count(*), 1)
             end
      from period_orders
    ),
    'unique_customers', (
      select count(*) from period_customer_keys where customer_key <> ''
    ),
    'returning_customers', (
      select count(*)
      from period_customer_keys pck
      join customer_lifetime_counts clc using (customer_key)
      where pck.customer_key <> '' and clc.lifetime_orders > 1
    ),
    'previous_orders', case when v_days = 0 then null else (select count(*) from previous_orders) end,
    'previous_sales', case when v_days = 0 then null else (select coalesce(sum(total), 0) from previous_orders where status = 'delivered') end,
    'best_selling_products', coalesce((
      select jsonb_agg(jsonb_build_object(
        'product_name', x.product_name,
        'size_ml', x.size_ml,
        'quantity_sold', x.quantity_sold,
        'sales', x.sales
      ) order by x.quantity_sold desc, x.sales desc)
      from (
        select
          oi.product_name,
          oi.size_ml,
          sum(oi.quantity) as quantity_sold,
          sum(oi.line_total) as sales
        from public.order_items oi
        join period_orders po on po.id = oi.order_id
        where po.status <> 'cancelled'
        group by oi.product_name, oi.size_ml
        order by quantity_sold desc, sales desc
        limit 5
      ) x
    ), '[]'::jsonb),
    'top_governorates', coalesce((
      select jsonb_agg(jsonb_build_object(
        'governorate', x.governorate,
        'orders', x.orders,
        'sales', x.sales
      ) order by x.orders desc, x.sales desc)
      from (
        select
          coalesce(nullif(btrim(governorate), ''), 'Unknown') as governorate,
          count(*) as orders,
          coalesce(sum(total), 0) as sales
        from period_orders
        where status <> 'cancelled'
        group by coalesce(nullif(btrim(governorate), ''), 'Unknown')
        order by orders desc, sales desc
        limit 5
      ) x
    ), '[]'::jsonb),
    'daily_trend', coalesce((
      select jsonb_agg(jsonb_build_object(
        'date', t.day,
        'orders', t.order_count,
        'revenue', t.revenue
      ) order by t.day)
      from trend t
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
        select
          order_number,
          concat_ws(' ', first_name, last_name) as customer_name,
          total,
          status,
          created_at
        from period_orders
        order by created_at desc
        limit 5
      ) r
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.admin_dashboard_report(integer) from public;
grant execute on function public.admin_dashboard_report(integer) to authenticated;
