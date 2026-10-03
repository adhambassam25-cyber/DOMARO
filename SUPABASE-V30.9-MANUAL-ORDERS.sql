-- DOMARO V30.9 — Manual Orders
-- Admin-only offline/friends sales that count in delivered sales and profit reporting.

alter table public.orders
add column if not exists order_source text not null default 'website';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'orders_order_source_check'
      and conrelid = 'public.orders'::regclass
  ) then
    alter table public.orders
      add constraint orders_order_source_check
      check (order_source in ('website','manual'));
  end if;
end $$;

create or replace function public.manual_order_catalog()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  if not public.has_admin_permission('orders') then
    raise exception 'Not authorized' using errcode='42501';
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', p.id,
      'name', p.name,
      'brand', p.brand,
      'has_variants', p.has_variants,
      'size_ml', p.size_ml,
      'price', p.price,
      'stock_quantity', p.stock_quantity,
      'in_stock', p.in_stock,
      'variants', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'id', v.id,
            'label', v.label,
            'sku', v.sku,
            'size_ml', v.size_ml,
            'price', v.price,
            'stock_quantity', v.stock_quantity,
            'in_stock', v.in_stock,
            'is_default', v.is_default
          )
          order by v.is_default desc, v.sort_order asc, v.created_at asc
        )
        from public.product_variants v
        where v.product_id=p.id and v.active=true
      ), '[]'::jsonb)
    )
    order by coalesce(p.brand,''), p.name
  ), '[]'::jsonb)
  into v_result
  from public.products p
  where p.active=true;

  return v_result;
end;
$$;

revoke all on function public.manual_order_catalog() from public;
grant execute on function public.manual_order_catalog() to authenticated;

create or replace function public.create_manual_order(
  p_items jsonb,
  p_first_name text default 'Manual',
  p_last_name text default 'Order',
  p_phone text default '',
  p_shipping numeric default 0,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid := gen_random_uuid();
  v_order_number text;
  v_item jsonb;
  v_product public.products%rowtype;
  v_variant public.product_variants%rowtype;
  v_product_id text;
  v_variant_id uuid;
  v_qty integer;
  v_unit_price numeric;
  v_unit_price_int integer;
  v_unit_cost numeric;
  v_subtotal integer := 0;
  v_shipping integer;
  v_line_total integer;
  v_actor_email text;
begin
  if not public.has_admin_permission('orders') then
    raise exception 'Not authorized' using errcode='42501';
  end if;

  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items)=0 then
    raise exception 'Add at least one item';
  end if;

  if p_shipping is null or p_shipping < 0 or p_shipping <> trunc(p_shipping) then
    raise exception 'Shipping must be a whole non-negative EGP amount';
  end if;
  v_shipping := p_shipping::integer;

  v_order_number := 'DOM-M-' || to_char(current_date,'YYMMDD') || '-' ||
    upper(substr(replace(v_order_id::text,'-',''),1,6));

  insert into public.orders(
    id,order_number,first_name,last_name,phone,governorate,area,building,address,
    notes,subtotal,shipping,discount,coupon_code,total,payment_method,status,order_source
  )
  values(
    v_order_id,
    v_order_number,
    coalesce(nullif(btrim(p_first_name),''),'Manual'),
    coalesce(nullif(btrim(p_last_name),''),'Order'),
    coalesce(btrim(p_phone),''),
    'Manual sale',
    'Manual sale',
    null,
    'Manual order',
    nullif(btrim(coalesce(p_notes,'')),''),
    0,
    v_shipping,
    0,
    null,
    0,
    'Manual sale',
    'delivered',
    'manual'
  );

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_product_id := nullif(btrim(v_item->>'product_id'),'');
    if v_product_id is null then raise exception 'Product is required'; end if;

    v_qty := coalesce(nullif(v_item->>'quantity','')::integer,0);
    if v_qty <= 0 then raise exception 'Quantity must be greater than zero'; end if;

    v_unit_price := nullif(v_item->>'unit_price','')::numeric;
    if v_unit_price is null or v_unit_price < 0 or v_unit_price <> trunc(v_unit_price) then
      raise exception 'Selling price must be a whole non-negative EGP amount';
    end if;
    v_unit_price_int := v_unit_price::integer;

    select * into v_product
    from public.products
    where id=v_product_id and active=true
    for update;

    if not found then raise exception 'Product not found or inactive'; end if;

    v_variant_id := null;
    if nullif(v_item->>'variant_id','') is not null then
      v_variant_id := (v_item->>'variant_id')::uuid;
    end if;

    if v_product.has_variants then
      if v_variant_id is null then raise exception 'Choose a variant for %', v_product.name; end if;

      select * into v_variant
      from public.product_variants
      where id=v_variant_id and product_id=v_product.id and active=true
      for update;

      if not found then raise exception 'Variant not found for %', v_product.name; end if;

      if v_variant.stock_quantity is not null then
        if v_variant.stock_quantity < v_qty then
          raise exception 'Not enough stock for % - %', v_product.name, v_variant.label;
        end if;
        update public.product_variants
        set stock_quantity=stock_quantity-v_qty,
            in_stock=(stock_quantity-v_qty)>0,
            updated_at=now()
        where id=v_variant.id;
      end if;

      v_unit_cost := v_variant.cost_price;
      v_line_total := v_unit_price_int * v_qty;

      insert into public.order_items(
        order_id,product_id,product_name,size_ml,unit_price,quantity,line_total,
        variant_id,variant_label,sku,unit_cost,line_cost
      )
      values(
        v_order_id,v_product.id,v_product.name,v_variant.size_ml,v_unit_price_int,v_qty,v_line_total,
        v_variant.id,v_variant.label,v_variant.sku,v_unit_cost,
        case when v_unit_cost is null then null else v_unit_cost*v_qty end
      );

      perform public.refresh_product_variant_summary(v_product.id);
    else
      if v_product.stock_quantity is not null then
        if v_product.stock_quantity < v_qty then
          raise exception 'Not enough stock for %', v_product.name;
        end if;
        update public.products
        set stock_quantity=stock_quantity-v_qty,
            in_stock=(stock_quantity-v_qty)>0,
            updated_at=now()
        where id=v_product.id;
      end if;

      v_unit_cost := v_product.cost_price;
      v_line_total := v_unit_price_int * v_qty;

      insert into public.order_items(
        order_id,product_id,product_name,size_ml,unit_price,quantity,line_total,
        variant_id,variant_label,sku,unit_cost,line_cost
      )
      values(
        v_order_id,v_product.id,v_product.name,v_product.size_ml,v_unit_price_int,v_qty,v_line_total,
        null,null,null,v_unit_cost,
        case when v_unit_cost is null then null else v_unit_cost*v_qty end
      );
    end if;

    v_subtotal := v_subtotal + v_line_total;
  end loop;

  update public.orders
  set subtotal=v_subtotal,
      total=v_subtotal+v_shipping
  where id=v_order_id;

  select email into v_actor_email from public.admins where user_id=auth.uid();

  insert into public.order_activity(order_id,event_type,new_status,actor_user_id,actor_email)
  values(v_order_id,'created','delivered',auth.uid(),v_actor_email);

  return jsonb_build_object(
    'id',v_order_id,
    'order_number',v_order_number,
    'status','delivered',
    'subtotal',v_subtotal,
    'shipping',v_shipping,
    'total',v_subtotal+v_shipping,
    'order_source','manual'
  );
end;
$$;

revoke all on function public.create_manual_order(jsonb,text,text,text,numeric,text) from public;
grant execute on function public.create_manual_order(jsonb,text,text,text,numeric,text) to authenticated;
