-- DOMARO V30.7 — Boxes + optional coupon cap support
-- Run this once in Supabase SQL Editor before testing capped coupons on Preview.

alter table public.coupons
  add column if not exists max_discount_amount numeric(12,2);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname='coupons_max_discount_amount_positive'
      and conrelid='public.coupons'::regclass
  ) then
    alter table public.coupons
      add constraint coupons_max_discount_amount_positive
      check (max_discount_amount is null or max_discount_amount > 0);
  end if;
end $$;

-- Public checkout coupon validation now applies the optional maximum discount.
create or replace function public.validate_coupon(p_code text, p_subtotal numeric)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_coupon public.coupons%rowtype;
  v_discount numeric(12,2):=0;
begin
  if btrim(coalesce(p_code,''))='' then
    return jsonb_build_object('valid',false,'message','Enter a discount code first.');
  end if;

  select * into v_coupon
  from public.coupons
  where upper(btrim(code))=upper(btrim(p_code))
  limit 1;

  if not found then return jsonb_build_object('valid',false,'message','Invalid coupon code.'); end if;
  if not v_coupon.active then return jsonb_build_object('valid',false,'message','Coupon is not active.'); end if;
  if v_coupon.expires_at is not null and now()>v_coupon.expires_at then return jsonb_build_object('valid',false,'message','Coupon has expired.'); end if;
  if v_coupon.usage_limit is not null and v_coupon.used_count>=v_coupon.usage_limit then return jsonb_build_object('valid',false,'message','Coupon usage limit reached.'); end if;
  if coalesce(p_subtotal,0)<v_coupon.min_order_amount then
    return jsonb_build_object('valid',false,'message','Minimum order amount not reached.');
  end if;

  if v_coupon.discount_type='percent' then
    v_discount:=round(coalesce(p_subtotal,0)*least(v_coupon.discount_value,100)/100,2);
  else
    v_discount:=least(v_coupon.discount_value,coalesce(p_subtotal,0));
  end if;

  if v_coupon.max_discount_amount is not null then
    v_discount:=least(v_discount,v_coupon.max_discount_amount);
  end if;

  return jsonb_build_object(
    'valid',true,
    'message','Coupon applied.',
    'code',upper(btrim(v_coupon.code)),
    'discount',v_discount,
    'maxDiscount',v_coupon.max_discount_amount
  );
end;
$$;

revoke all on function public.validate_coupon(text,numeric) from public;
grant execute on function public.validate_coupon(text,numeric) to anon,authenticated;

create or replace function public.place_order_v30(
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
  p_checkout_token text,
  p_email text default null
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_order_id uuid:=gen_random_uuid();
  v_order_number text;
  v_subtotal numeric(12,2):=0;
  v_shipping numeric(12,2):=80;
  v_discount numeric(12,2):=0;
  v_total numeric(12,2);
  v_item jsonb;
  v_product_id text;
  v_variant_id uuid;
  v_qty integer;
  v_product public.products%rowtype;
  v_variant public.product_variants%rowtype;
  v_coupon public.coupons%rowtype;
  v_coupon_code text:=null;
  v_existing public.orders%rowtype;
  v_customer_uid uuid:=auth.uid();
  v_delivery_quote jsonb;
begin
  if btrim(coalesce(p_checkout_token,''))='' then raise exception 'Checkout token is required'; end if;
  perform pg_advisory_xact_lock(hashtext(p_checkout_token));
  select * into v_existing from public.orders where checkout_token=p_checkout_token limit 1;
  if found then return jsonb_build_object('orderNumber',v_existing.order_number,'subtotal',v_existing.subtotal,'discount',v_existing.discount,'couponCode',v_existing.coupon_code,'shipping',v_existing.shipping,'total',v_existing.total,'status',v_existing.status,'duplicate',true); end if;

  if btrim(coalesce(p_first_name,''))='' then raise exception 'First name is required'; end if;
  if btrim(coalesce(p_last_name,''))='' then raise exception 'Last name is required'; end if;
  if p_phone !~ '^01[0125][0-9]{8}$' then raise exception 'Invalid Egyptian mobile number'; end if;
  if btrim(coalesce(p_governorate,''))='' then raise exception 'Governorate is required'; end if;
  if btrim(coalesce(p_area,''))='' then raise exception 'Area is required'; end if;
  if btrim(coalesce(p_address,''))='' then raise exception 'Address is required'; end if;
  if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)=0 then raise exception 'Order must contain products'; end if;

  v_delivery_quote:=public.get_delivery_quote(p_governorate,p_area);
  v_shipping:=coalesce(nullif(v_delivery_quote->>'fee','')::numeric,80);

  for v_item in select value from jsonb_array_elements(p_items) loop
    v_product_id:=v_item->>'id';
    v_qty:=(v_item->>'qty')::integer;
    if v_qty<1 or v_qty>10 then raise exception 'Invalid quantity'; end if;
    select * into v_product from public.products where id=v_product_id and active=true for update;
    if not found then raise exception 'Product is unavailable'; end if;

    begin v_variant_id:=nullif(v_item->>'variant_id','')::uuid; exception when others then v_variant_id:=null; end;
    if v_variant_id is not null then
      select * into v_variant from public.product_variants where id=v_variant_id and product_id=v_product_id and active=true for update;
    else
      select * into v_variant from public.product_variants where product_id=v_product_id and active=true order by is_default desc,sort_order,id limit 1 for update;
    end if;
    if not found or not v_variant.in_stock then raise exception 'Product variant is unavailable'; end if;
    if v_variant.stock_quantity is not null and v_variant.stock_quantity<v_qty then raise exception 'Not enough stock for %',v_product.name; end if;
    v_subtotal:=v_subtotal+(v_variant.price*v_qty);
  end loop;

  if p_coupon_code is not null and btrim(p_coupon_code)<>'' then
    select * into v_coupon from public.coupons where upper(btrim(code))=upper(btrim(p_coupon_code)) for update;
    if not found then raise exception 'Invalid coupon code'; end if;
    if not v_coupon.active then raise exception 'Coupon is not active'; end if;
    if v_coupon.expires_at is not null and now()>v_coupon.expires_at then raise exception 'Coupon has expired'; end if;
    if v_coupon.usage_limit is not null and v_coupon.used_count>=v_coupon.usage_limit then raise exception 'Coupon usage limit reached'; end if;
    if v_subtotal<v_coupon.min_order_amount then raise exception 'Minimum order amount not reached'; end if;
    if v_coupon.discount_type='percent' then v_discount:=round(v_subtotal*least(v_coupon.discount_value,100)/100,2); else v_discount:=least(v_coupon.discount_value,v_subtotal); end if;
    if v_coupon.max_discount_amount is not null then
      v_discount:=least(v_discount,v_coupon.max_discount_amount);
    end if;
    v_coupon_code:=upper(btrim(v_coupon.code));
  end if;

  v_total:=v_subtotal-v_discount+v_shipping;
  v_order_number:='DOM-'||to_char(current_date,'YYMMDD')||'-'||upper(substr(replace(v_order_id::text,'-',''),1,6));

  insert into public.orders(id,order_number,first_name,last_name,phone,email,customer_user_id,governorate,area,building,address,notes,subtotal,shipping,discount,coupon_code,checkout_token,total,payment_method,status)
  values(v_order_id,v_order_number,btrim(p_first_name),btrim(p_last_name),p_phone,nullif(btrim(coalesce(p_email,'')),''),v_customer_uid,p_governorate,btrim(p_area),btrim(coalesce(p_building,'')),btrim(p_address),btrim(coalesce(p_notes,'')),v_subtotal,v_shipping,v_discount,v_coupon_code,p_checkout_token,v_total,'Cash on Delivery','new');

  for v_item in select value from jsonb_array_elements(p_items) loop
    v_product_id:=v_item->>'id'; v_qty:=(v_item->>'qty')::integer;
    begin v_variant_id:=nullif(v_item->>'variant_id','')::uuid; exception when others then v_variant_id:=null; end;
    select * into v_product from public.products where id=v_product_id for update;
    if v_variant_id is not null then select * into v_variant from public.product_variants where id=v_variant_id for update;
    else select * into v_variant from public.product_variants where product_id=v_product_id and active=true order by is_default desc,sort_order,id limit 1 for update; end if;

    insert into public.order_items(order_id,product_id,product_name,size_ml,unit_price,quantity,line_total,variant_id,variant_label,sku,unit_cost,line_cost)
    values(v_order_id,v_product.id,v_product.name,v_variant.size_ml,v_variant.price,v_qty,v_variant.price*v_qty,v_variant.id,v_variant.label,v_variant.sku,v_variant.cost_price,case when v_variant.cost_price is null then null else v_variant.cost_price*v_qty end);

    if v_variant.stock_quantity is not null then
      update public.product_variants set stock_quantity=stock_quantity-v_qty,in_stock=(stock_quantity-v_qty>0),updated_at=now() where id=v_variant.id;
    end if;
    perform public.refresh_product_variant_summary(v_product.id);
  end loop;

  if v_coupon_code is not null then update public.coupons set used_count=used_count+1,updated_at=now() where id=v_coupon.id; end if;
  update public.checkout_sessions set status='converted',order_id=v_order_id,last_seen_at=now() where token=p_checkout_token;

  return jsonb_build_object('orderNumber',v_order_number,'subtotal',v_subtotal,'discount',v_discount,'couponCode',v_coupon_code,'shipping',v_shipping,'total',v_total,'status','new','duplicate',false);
end;
$$;
revoke all on function public.place_order_v30(text,text,text,text,text,text,text,text,jsonb,text,text,text) from public;
grant execute on function public.place_order_v30(text,text,text,text,text,text,text,text,jsonb,text,text,text) to anon,authenticated;

-- Note: "boxes" uses the existing products.category field, so no product-table migration is required.
