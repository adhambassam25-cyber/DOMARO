-- DOMARO V13 — duplicate-order protection / idempotent checkout

alter table public.orders
add column if not exists checkout_token text null;

create unique index if not exists orders_checkout_token_unique
on public.orders (checkout_token)
where checkout_token is not null;

create or replace function public.place_order(
  p_first_name text,
  p_last_name text,
  p_phone text,
  p_governorate text,
  p_area text,
  p_building text,
  p_address text,
  p_notes text,
  p_items jsonb,
  p_coupon_code text,
  p_checkout_token text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid := gen_random_uuid();
  v_order_number text;
  v_subtotal numeric(12,2) := 0;
  v_shipping numeric(12,2) := 80;
  v_discount numeric(12,2) := 0;
  v_total numeric(12,2);
  v_item jsonb;
  v_product_id text;
  v_qty integer;
  v_product public.products%rowtype;
  v_coupon public.coupons%rowtype;
  v_coupon_code text := null;
  v_existing public.orders%rowtype;
begin
  if trim(coalesce(p_checkout_token, '')) = '' then raise exception 'Checkout token is required'; end if;
  perform pg_advisory_xact_lock(hashtext(p_checkout_token));

  select * into v_existing from public.orders where checkout_token = p_checkout_token limit 1;
  if found then
    return jsonb_build_object('orderNumber',v_existing.order_number,'subtotal',v_existing.subtotal,'discount',v_existing.discount,'couponCode',v_existing.coupon_code,'shipping',v_existing.shipping,'total',v_existing.total,'status',v_existing.status,'duplicate',true);
  end if;

  if trim(coalesce(p_first_name, '')) = '' then raise exception 'First name is required'; end if;
  if trim(coalesce(p_last_name, '')) = '' then raise exception 'Last name is required'; end if;
  if p_phone !~ '^01[0125][0-9]{8}$' then raise exception 'Invalid Egyptian mobile number'; end if;
  if trim(coalesce(p_governorate, '')) = '' then raise exception 'Governorate is required'; end if;
  if trim(coalesce(p_area, '')) = '' then raise exception 'Area is required'; end if;
  if trim(coalesce(p_address, '')) = '' then raise exception 'Address is required'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'Order must contain products'; end if;

  for v_item in select value from jsonb_array_elements(p_items) loop
    v_product_id := v_item ->> 'id';
    v_qty := (v_item ->> 'qty')::integer;
    if v_qty < 1 or v_qty > 10 then raise exception 'Invalid quantity'; end if;
    select * into v_product from public.products where id=v_product_id and active=true and in_stock=true for update;
    if not found then raise exception 'Product is unavailable'; end if;
    if v_product.stock_quantity is not null and v_product.stock_quantity < v_qty then raise exception 'Not enough stock for %', v_product.name; end if;
    v_subtotal := v_subtotal + (v_product.price * v_qty);
  end loop;

  if p_coupon_code is not null and trim(p_coupon_code) <> '' then
    select * into v_coupon from public.coupons where upper(trim(code))=upper(trim(p_coupon_code)) for update;
    if not found then raise exception 'Invalid coupon code'; end if;
    if not v_coupon.active then raise exception 'Coupon is not active'; end if;
    if v_coupon.expires_at is not null and now() > v_coupon.expires_at then raise exception 'Coupon has expired'; end if;
    if v_coupon.usage_limit is not null and v_coupon.used_count >= v_coupon.usage_limit then raise exception 'Coupon usage limit reached'; end if;
    if v_subtotal < v_coupon.min_order_amount then raise exception 'Minimum order amount not reached'; end if;
    if v_coupon.discount_type='percent' then
      v_discount := round(v_subtotal * least(v_coupon.discount_value,100) / 100, 2);
    else
      v_discount := least(v_coupon.discount_value,v_subtotal);
    end if;
    v_coupon_code := upper(trim(v_coupon.code));
  end if;

  v_total := v_subtotal - v_discount + v_shipping;
  v_order_number := 'DOM-' || to_char(current_date,'YYMMDD') || '-' || upper(substr(replace(v_order_id::text,'-',''),1,6));

  insert into public.orders (id,order_number,first_name,last_name,phone,governorate,area,building,address,notes,subtotal,shipping,discount,coupon_code,checkout_token,total,payment_method,status)
  values (v_order_id,v_order_number,trim(p_first_name),trim(p_last_name),p_phone,p_governorate,trim(p_area),trim(coalesce(p_building,'')),trim(p_address),trim(coalesce(p_notes,'')),v_subtotal,v_shipping,v_discount,v_coupon_code,p_checkout_token,v_total,'Cash on Delivery','new');

  for v_item in select value from jsonb_array_elements(p_items) loop
    v_product_id := v_item ->> 'id';
    v_qty := (v_item ->> 'qty')::integer;
    select * into v_product from public.products where id=v_product_id and active=true and in_stock=true for update;
    insert into public.order_items (order_id,product_id,product_name,size_ml,unit_price,quantity,line_total)
    values (v_order_id,v_product.id,v_product.name,v_product.size_ml,v_product.price,v_qty,v_product.price*v_qty);
    if v_product.stock_quantity is not null then
      update public.products set stock_quantity=stock_quantity-v_qty,in_stock=case when stock_quantity-v_qty<=0 then false else true end,updated_at=now() where id=v_product.id;
    end if;
  end loop;

  if v_coupon_code is not null then
    update public.coupons set used_count=used_count+1,updated_at=now() where id=v_coupon.id;
  end if;

  return jsonb_build_object('orderNumber',v_order_number,'subtotal',v_subtotal,'discount',v_discount,'couponCode',v_coupon_code,'shipping',v_shipping,'total',v_total,'status','new','duplicate',false);
end;
$$;

revoke all on function public.place_order(text,text,text,text,text,text,text,text,jsonb,text,text) from public;
grant execute on function public.place_order(text,text,text,text,text,text,text,text,jsonb,text,text) to anon, authenticated;
