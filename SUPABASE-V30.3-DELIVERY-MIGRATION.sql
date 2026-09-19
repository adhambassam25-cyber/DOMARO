-- DOMARO V30.3 — Delivery controls
-- Safe additive migration. Run once in Supabase SQL Editor before deploying V30.3.

begin;

alter table public.store_settings
  add column if not exists shipping_fee numeric(12,2) not null default 80 check (shipping_fee >= 0);

-- Replace only the legacy/default shipping announcement. Preserve any custom owner announcement.
update public.store_settings
set announcement = 'DELIVERY ACROSS EGYPT', updated_at = now()
where id = 1
  and (
    announcement is null
    or btrim(announcement) = ''
    or upper(btrim(announcement)) = 'FLAT SHIPPING 80 EGP ACROSS EGYPT'
  );

create or replace function public.get_public_store_settings()
returns jsonb language sql stable security definer set search_path=public as $$
  select jsonb_build_object(
    'hero_eyebrow',hero_eyebrow,'hero_title',hero_title,'hero_subtitle',hero_subtitle,'hero_cta_label',hero_cta_label,'hero_cta_href',hero_cta_href,
    'announcement',announcement,'promo_title',promo_title,'promo_text',promo_text,'promo_link_label',promo_link_label,'promo_link_href',promo_link_href,
    'shipping_fee',shipping_fee,
    'ga4_id',ga4_id,'meta_pixel_id',meta_pixel_id,'tiktok_pixel_id',tiktok_pixel_id
  ) from public.store_settings where id=1;
$$;
revoke all on function public.get_public_store_settings() from public;
grant execute on function public.get_public_store_settings() to anon,authenticated;

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
begin
  select coalesce(shipping_fee,80) into v_shipping from public.store_settings where id=1;
  if not found then v_shipping:=80; end if;
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

create or replace function public.owner_restore_store_backup(p_backup jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare x jsonb; v_count int:=0;
begin
  if not public.is_owner() then raise exception 'Owner access required' using errcode='42501'; end if;
  if coalesce(p_backup->>'version','') <> 'DOMARO-V30' then raise exception 'Unsupported backup version'; end if;

  for x in select value from jsonb_array_elements(coalesce(p_backup->'products','[]'::jsonb)) loop
    insert into public.products(id,name,category,size_ml,price,image_path,active,description,in_stock,stock_quantity,brand,story,top_notes,heart_notes,base_notes,cost_price,updated_at)
    values(x->>'id',x->>'name',x->>'category',(x->>'size_ml')::int,(x->>'price')::numeric,x->>'image_path',coalesce((x->>'active')::boolean,true),x->>'description',coalesce((x->>'in_stock')::boolean,true),nullif(x->>'stock_quantity','')::int,x->>'brand',x->>'story',x->>'top_notes',x->>'heart_notes',x->>'base_notes',nullif(x->>'cost_price','')::numeric,now())
    on conflict(id) do update set name=excluded.name,category=excluded.category,size_ml=excluded.size_ml,price=excluded.price,image_path=excluded.image_path,active=excluded.active,description=excluded.description,in_stock=excluded.in_stock,stock_quantity=excluded.stock_quantity,brand=excluded.brand,story=excluded.story,top_notes=excluded.top_notes,heart_notes=excluded.heart_notes,base_notes=excluded.base_notes,cost_price=excluded.cost_price,updated_at=now();
    v_count:=v_count+1;
  end loop;

  -- Clear current default flags for products present in this backup first.
  -- This avoids a temporary unique-index conflict while restoring a different default variant.
  update public.product_variants v
  set is_default=false, updated_at=now()
  where v.product_id in (
    select distinct value->>'product_id'
    from jsonb_array_elements(coalesce(p_backup->'variants','[]'::jsonb))
  );

  for x in select value from jsonb_array_elements(coalesce(p_backup->'variants','[]'::jsonb)) loop
    insert into public.product_variants(id,product_id,sku,label,size_ml,price,cost_price,stock_quantity,in_stock,active,is_default,sort_order,updated_at)
    values((x->>'id')::uuid,x->>'product_id',nullif(x->>'sku',''),x->>'label',(x->>'size_ml')::int,(x->>'price')::numeric,nullif(x->>'cost_price','')::numeric,nullif(x->>'stock_quantity','')::int,coalesce((x->>'in_stock')::boolean,true),coalesce((x->>'active')::boolean,true),coalesce((x->>'is_default')::boolean,false),coalesce((x->>'sort_order')::int,0),now())
    on conflict(id) do update set product_id=excluded.product_id,sku=excluded.sku,label=excluded.label,size_ml=excluded.size_ml,price=excluded.price,cost_price=excluded.cost_price,stock_quantity=excluded.stock_quantity,in_stock=excluded.in_stock,active=excluded.active,is_default=excluded.is_default,sort_order=excluded.sort_order,updated_at=now();
  end loop;

  for x in select value from jsonb_array_elements(coalesce(p_backup->'images','[]'::jsonb)) loop
    insert into public.product_images(product_id,image_path,alt_text,sort_order)
    values(x->>'product_id',x->>'image_path',x->>'alt_text',coalesce((x->>'sort_order')::int,0))
    on conflict(product_id,image_path) do update set alt_text=excluded.alt_text,sort_order=excluded.sort_order;
  end loop;

  for x in select value from jsonb_array_elements(coalesce(p_backup->'coupons','[]'::jsonb)) loop
    insert into public.coupons(id,code,discount_type,discount_value,min_order_amount,active,expires_at,usage_limit,used_count,updated_at)
    values((x->>'id')::uuid,x->>'code',x->>'discount_type',(x->>'discount_value')::numeric,coalesce((x->>'min_order_amount')::numeric,0),coalesce((x->>'active')::boolean,true),nullif(x->>'expires_at','')::timestamptz,nullif(x->>'usage_limit','')::int,coalesce((x->>'used_count')::int,0),now())
    on conflict(id) do update set code=excluded.code,discount_type=excluded.discount_type,discount_value=excluded.discount_value,min_order_amount=excluded.min_order_amount,active=excluded.active,expires_at=excluded.expires_at,usage_limit=excluded.usage_limit,used_count=excluded.used_count,updated_at=now();
  end loop;

  if p_backup ? 'settings' and jsonb_typeof(p_backup->'settings')='object' then
    update public.store_settings set
      hero_eyebrow=coalesce(p_backup->'settings'->>'hero_eyebrow',hero_eyebrow),hero_title=coalesce(p_backup->'settings'->>'hero_title',hero_title),hero_subtitle=coalesce(p_backup->'settings'->>'hero_subtitle',hero_subtitle),hero_cta_label=coalesce(p_backup->'settings'->>'hero_cta_label',hero_cta_label),hero_cta_href=coalesce(p_backup->'settings'->>'hero_cta_href',hero_cta_href),announcement=p_backup->'settings'->>'announcement',promo_title=p_backup->'settings'->>'promo_title',promo_text=p_backup->'settings'->>'promo_text',promo_link_label=p_backup->'settings'->>'promo_link_label',promo_link_href=p_backup->'settings'->>'promo_link_href',monthly_sales_goal=coalesce(nullif(p_backup->'settings'->>'monthly_sales_goal','')::numeric,monthly_sales_goal),shipping_fee=coalesce(nullif(p_backup->'settings'->>'shipping_fee','')::numeric,shipping_fee),ga4_id=p_backup->'settings'->>'ga4_id',meta_pixel_id=p_backup->'settings'->>'meta_pixel_id',tiktok_pixel_id=p_backup->'settings'->>'tiktok_pixel_id',updated_at=now() where id=1;
  end if;
  return jsonb_build_object('ok',true,'products_merged',v_count);
end;$$;
revoke all on function public.owner_restore_store_backup(jsonb) from public;
grant execute on function public.owner_restore_store_backup(jsonb) to authenticated;

commit;
