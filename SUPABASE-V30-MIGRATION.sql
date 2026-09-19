-- DOMARO V30 — Ultimate Core Upgrade
-- Internal production features only. External providers remain disabled until credentials/domain are supplied.

begin;

-- ---------- PRODUCT COST / VARIANT SUMMARY ----------
alter table public.products add column if not exists cost_price numeric(12,2) null check (cost_price is null or cost_price >= 0);
alter table public.products add column if not exists has_variants boolean not null default false;

alter table public.order_items add column if not exists variant_id uuid null;
alter table public.order_items add column if not exists variant_label text null;
alter table public.order_items add column if not exists sku text null;
alter table public.order_items add column if not exists unit_cost numeric(12,2) null;
alter table public.order_items add column if not exists line_cost numeric(12,2) null;
alter table public.orders add column if not exists email text null;
alter table public.orders add column if not exists customer_user_id uuid null references auth.users(id) on delete set null;

create table if not exists public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id text not null references public.products(id) on delete cascade,
  sku text null,
  label text not null,
  size_ml integer not null check (size_ml > 0),
  price numeric(12,2) not null check (price >= 0),
  cost_price numeric(12,2) null check (cost_price is null or cost_price >= 0),
  stock_quantity integer null check (stock_quantity is null or stock_quantity >= 0),
  in_stock boolean not null default true,
  active boolean not null default true,
  is_default boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists product_variants_sku_unique
  on public.product_variants (lower(sku)) where sku is not null and btrim(sku) <> '';
create unique index if not exists product_variants_one_default
  on public.product_variants (product_id) where is_default = true;
create index if not exists product_variants_product_idx
  on public.product_variants(product_id, active, sort_order);

do $$
begin
  if not exists (select 1 from pg_constraint where conname='order_items_variant_id_fkey') then
    alter table public.order_items add constraint order_items_variant_id_fkey foreign key(variant_id) references public.product_variants(id) on delete set null;
  end if;
end$$;

alter table public.product_variants enable row level security;
drop policy if exists "Public can view active product variants" on public.product_variants;
create policy "Public can view active product variants"
on public.product_variants for select
to anon, authenticated
using (
  active = true and exists (
    select 1 from public.products p where p.id = product_id and p.active = true
  )
);

drop policy if exists "Product admins can insert variants" on public.product_variants;
drop policy if exists "Product admins can update variants" on public.product_variants;
drop policy if exists "Product admins can delete variants" on public.product_variants;
create policy "Product admins can insert variants" on public.product_variants for insert to authenticated
with check (public.has_admin_permission('products'));
create policy "Product admins can update variants" on public.product_variants for update to authenticated
using (public.has_admin_permission('products')) with check (public.has_admin_permission('products'));
create policy "Product admins can delete variants" on public.product_variants for delete to authenticated
using (public.has_admin_permission('products'));

grant select on public.product_variants to anon, authenticated;
grant insert, update, delete on public.product_variants to authenticated;

-- Seed one default variant for every existing product without variants.
insert into public.product_variants (
  product_id, sku, label, size_ml, price, cost_price, stock_quantity, in_stock, active, is_default, sort_order
)
select
  p.id,
  upper(regexp_replace(p.id, '[^a-zA-Z0-9]+', '-', 'g')) || '-' || p.size_ml::text,
  p.size_ml::text || ' ML',
  p.size_ml,
  p.price,
  p.cost_price,
  p.stock_quantity,
  p.in_stock,
  true,
  true,
  0
from public.products p
where not exists (select 1 from public.product_variants v where v.product_id = p.id);

create or replace function public.refresh_product_variant_summary(p_product_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
  v_price numeric(12,2);
  v_size integer;
  v_cost numeric(12,2);
  v_stock integer;
  v_has_untracked boolean;
  v_available boolean;
begin
  select
    count(*) filter (where active),
    min(price) filter (where active),
    min(size_ml) filter (where active and is_default),
    min(cost_price) filter (where active and is_default),
    sum(coalesce(stock_quantity,0)) filter (where active and stock_quantity is not null),
    bool_or(active and stock_quantity is null),
    bool_or(active and in_stock and (stock_quantity is null or stock_quantity > 0))
  into v_count, v_price, v_size, v_cost, v_stock, v_has_untracked, v_available
  from public.product_variants
  where product_id = p_product_id;

  if coalesce(v_count,0) = 0 then return; end if;

  update public.products p
  set
    has_variants = (v_count > 1),
    price = coalesce(v_price, p.price),
    size_ml = coalesce(v_size, p.size_ml),
    cost_price = coalesce(v_cost, p.cost_price),
    stock_quantity = case when v_has_untracked then null else coalesce(v_stock,0) end,
    in_stock = coalesce(v_available,false),
    updated_at = now()
  where p.id = p_product_id;
end;
$$;

create or replace function public.v30_variant_refresh_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.refresh_product_variant_summary(case when tg_op='DELETE' then old.product_id else new.product_id end);
  if tg_op='DELETE' then return old; else return new; end if;
end;
$$;

drop trigger if exists trg_v30_variant_refresh on public.product_variants;
create trigger trg_v30_variant_refresh
after insert or update or delete on public.product_variants
for each row execute function public.v30_variant_refresh_trigger();

create or replace function public.v30_product_default_variant_sync()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_default uuid;
begin
  if tg_op = 'INSERT' then
    if not exists (select 1 from public.product_variants where product_id = new.id) then
      insert into public.product_variants(product_id,sku,label,size_ml,price,cost_price,stock_quantity,in_stock,active,is_default,sort_order)
      values (
        new.id,
        upper(regexp_replace(new.id, '[^a-zA-Z0-9]+', '-', 'g')) || '-' || new.size_ml::text,
        new.size_ml::text || ' ML',
        new.size_ml,
        new.price,
        new.cost_price,
        new.stock_quantity,
        new.in_stock,
        true,
        true,
        0
      );
    end if;
    return new;
  end if;

  if coalesce(new.has_variants,false) = false and (
    new.price is distinct from old.price or
    new.size_ml is distinct from old.size_ml or
    new.cost_price is distinct from old.cost_price or
    new.stock_quantity is distinct from old.stock_quantity or
    new.in_stock is distinct from old.in_stock
  ) then
    select id into v_default from public.product_variants where product_id=new.id and is_default=true limit 1;
    if v_default is not null then
      update public.product_variants
      set
        label = new.size_ml::text || ' ML',
        size_ml = new.size_ml,
        price = new.price,
        cost_price = new.cost_price,
        stock_quantity = new.stock_quantity,
        in_stock = new.in_stock,
        updated_at = now()
      where id=v_default;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_v30_product_default_variant_sync on public.products;
create trigger trg_v30_product_default_variant_sync
after insert or update of price,size_ml,cost_price,stock_quantity,in_stock on public.products
for each row execute function public.v30_product_default_variant_sync();

-- Quick stock continues to work for single-variant products; multi-variant stock must be adjusted per variant.
create or replace function public.adjust_product_stock(p_product_id text, p_delta integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product public.products%rowtype;
  v_variant public.product_variants%rowtype;
  v_new integer;
begin
  if not public.has_admin_permission('products') then
    raise exception 'Not authorized to manage products' using errcode='42501';
  end if;
  if p_delta is null or p_delta=0 then raise exception 'Stock adjustment must be non-zero'; end if;

  select * into v_product from public.products where id=p_product_id for update;
  if not found then raise exception 'Product not found'; end if;
  if v_product.has_variants then raise exception 'Use variant stock controls for multi-variant products'; end if;

  select * into v_variant from public.product_variants where product_id=p_product_id and is_default=true for update;
  if not found then raise exception 'Default variant not found'; end if;
  if v_variant.stock_quantity is null then raise exception 'Stock is not tracked for this product'; end if;

  v_new := v_variant.stock_quantity + p_delta;
  if v_new < 0 then raise exception 'Stock cannot go below zero'; end if;

  update public.product_variants
  set stock_quantity=v_new, in_stock=(v_new>0), updated_at=now()
  where id=v_variant.id;

  perform public.refresh_product_variant_summary(p_product_id);
  select * into v_product from public.products where id=p_product_id;
  return to_jsonb(v_product);
end;
$$;
revoke all on function public.adjust_product_stock(text,integer) from public;
grant execute on function public.adjust_product_stock(text,integer) to authenticated;

-- ---------- ADVANCED PRODUCT GALLERY ----------
create table if not exists public.product_images (
  id bigint generated always as identity primary key,
  product_id text not null references public.products(id) on delete cascade,
  image_path text not null,
  alt_text text null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists product_images_product_idx on public.product_images(product_id,sort_order,id);
create unique index if not exists product_images_product_path_unique on public.product_images(product_id,image_path);
alter table public.product_images enable row level security;
drop policy if exists "Public can view product gallery" on public.product_images;
create policy "Public can view product gallery" on public.product_images for select to anon, authenticated
using (exists(select 1 from public.products p where p.id=product_id and p.active=true));
drop policy if exists "Product admins can insert gallery" on public.product_images;
drop policy if exists "Product admins can update gallery" on public.product_images;
drop policy if exists "Product admins can delete gallery" on public.product_images;
create policy "Product admins can insert gallery" on public.product_images for insert to authenticated with check(public.has_admin_permission('products'));
create policy "Product admins can update gallery" on public.product_images for update to authenticated using(public.has_admin_permission('products')) with check(public.has_admin_permission('products'));
create policy "Product admins can delete gallery" on public.product_images for delete to authenticated using(public.has_admin_permission('products'));
grant select on public.product_images to anon,authenticated;
grant insert,update,delete on public.product_images to authenticated;
grant usage,select on sequence public.product_images_id_seq to authenticated;

-- ---------- CUSTOMER ACCOUNTS / WISHLIST ----------
create table if not exists public.customer_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text null,
  first_name text not null default '',
  last_name text not null default '',
  phone text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customer_profiles_phone_format check (phone ~ '^01[0125][0-9]{8}$')
);
create unique index if not exists customer_profiles_phone_unique on public.customer_profiles(phone);
alter table public.customer_profiles enable row level security;
drop policy if exists "Customers can view own profile" on public.customer_profiles;
drop policy if exists "Customers can update own profile" on public.customer_profiles;
create policy "Customers can view own profile" on public.customer_profiles for select to authenticated using(user_id=auth.uid());
create policy "Customers can update own profile" on public.customer_profiles for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
grant select,update on public.customer_profiles to authenticated;

create or replace function public.upsert_customer_profile(p_email text,p_first_name text,p_last_name text,p_phone text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_uid uuid:=auth.uid(); v_row public.customer_profiles%rowtype;
begin
  if v_uid is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if p_phone !~ '^01[0125][0-9]{8}$' then raise exception 'Invalid Egyptian mobile number'; end if;
  insert into public.customer_profiles(user_id,email,first_name,last_name,phone,updated_at)
  values(v_uid,nullif(btrim(p_email),''),btrim(coalesce(p_first_name,'')),btrim(coalesce(p_last_name,'')),p_phone,now())
  on conflict(user_id) do update set email=excluded.email,first_name=excluded.first_name,last_name=excluded.last_name,phone=excluded.phone,updated_at=now()
  returning * into v_row;
  return to_jsonb(v_row);
end;$$;
revoke all on function public.upsert_customer_profile(text,text,text,text) from public;
grant execute on function public.upsert_customer_profile(text,text,text,text) to authenticated;

create table if not exists public.customer_wishlist (
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id text not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(user_id,product_id)
);
alter table public.customer_wishlist enable row level security;
drop policy if exists "Customers can view own wishlist" on public.customer_wishlist;
drop policy if exists "Customers can add own wishlist" on public.customer_wishlist;
drop policy if exists "Customers can delete own wishlist" on public.customer_wishlist;
create policy "Customers can view own wishlist" on public.customer_wishlist for select to authenticated using(user_id=auth.uid());
create policy "Customers can add own wishlist" on public.customer_wishlist for insert to authenticated with check(user_id=auth.uid());
create policy "Customers can delete own wishlist" on public.customer_wishlist for delete to authenticated using(user_id=auth.uid());
grant select,insert,delete on public.customer_wishlist to authenticated;

create or replace function public.set_customer_wishlist(p_product_id text,p_active boolean)
returns void language plpgsql security definer set search_path=public as $$
declare v_uid uuid:=auth.uid();
begin
  if v_uid is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if not exists(select 1 from public.products where id=p_product_id and active=true) then raise exception 'Product not found'; end if;
  if coalesce(p_active,false) then
    insert into public.customer_wishlist(user_id,product_id) values(v_uid,p_product_id) on conflict(user_id,product_id) do nothing;
  else
    delete from public.customer_wishlist where user_id=v_uid and product_id=p_product_id;
  end if;
end;$$;
revoke all on function public.set_customer_wishlist(text,boolean) from public;
grant execute on function public.set_customer_wishlist(text,boolean) to authenticated;

create or replace function public.my_customer_orders()
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_uid uuid:=auth.uid(); v_phone text; v_result jsonb;
begin
  if v_uid is null then raise exception 'Authentication required' using errcode='42501'; end if;
  select phone into v_phone from public.customer_profiles where user_id=v_uid;
  if v_phone is null then return '[]'::jsonb; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',o.id,'order_number',o.order_number,'status',o.status,'subtotal',o.subtotal,'shipping',o.shipping,'discount',o.discount,'total',o.total,
    'payment_method',o.payment_method,'created_at',o.created_at,'governorate',o.governorate,'area',o.area,'address',o.address,
    'items',coalesce((select jsonb_agg(jsonb_build_object('product_name',oi.product_name,'size_ml',oi.size_ml,'variant_label',oi.variant_label,'quantity',oi.quantity,'unit_price',oi.unit_price,'line_total',oi.line_total) order by oi.id) from public.order_items oi where oi.order_id=o.id),'[]'::jsonb)
  ) order by o.created_at desc),'[]'::jsonb)
  into v_result from public.orders o where o.phone=v_phone;
  return v_result;
end;$$;
revoke all on function public.my_customer_orders() from public;
grant execute on function public.my_customer_orders() to authenticated;

-- ---------- RETURNS / REFUNDS ----------
create table if not exists public.returns (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  order_number text not null,
  phone text not null,
  reason text not null,
  details text null,
  status text not null default 'requested' check(status in('requested','approved','rejected','received','refunded','closed')),
  refund_amount numeric(12,2) null check(refund_amount is null or refund_amount>=0),
  admin_note text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz null
);
create index if not exists returns_order_idx on public.returns(order_id,created_at desc);
alter table public.returns enable row level security;
drop policy if exists "Order admins can view returns" on public.returns;
create policy "Order admins can view returns" on public.returns for select to authenticated using(public.has_admin_permission('orders'));
grant select on public.returns to authenticated;

create or replace function public.request_return(p_order_number text,p_phone text,p_reason text,p_details text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_order public.orders%rowtype; v_row public.returns%rowtype;
begin
  select * into v_order from public.orders where upper(order_number)=upper(btrim(p_order_number)) and phone=p_phone limit 1;
  if not found then raise exception 'Order not found'; end if;
  if v_order.status <> 'delivered' then raise exception 'Returns can be requested after delivery'; end if;
  if btrim(coalesce(p_reason,''))='' then raise exception 'Return reason is required'; end if;
  if exists(select 1 from public.returns where order_id=v_order.id and status in('requested','approved','received')) then raise exception 'A return request is already open for this order'; end if;
  insert into public.returns(order_id,order_number,phone,reason,details)
  values(v_order.id,v_order.order_number,v_order.phone,btrim(p_reason),nullif(btrim(coalesce(p_details,'')),'')) returning * into v_row;
  return to_jsonb(v_row);
end;$$;
revoke all on function public.request_return(text,text,text,text) from public;
grant execute on function public.request_return(text,text,text,text) to anon,authenticated;

create or replace function public.update_return_status(p_return_id uuid,p_status text,p_refund_amount numeric default null,p_admin_note text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_row public.returns%rowtype;
begin
  if not public.has_admin_permission('orders') then raise exception 'Not authorized' using errcode='42501'; end if;
  if p_status not in('requested','approved','rejected','received','refunded','closed') then raise exception 'Invalid return status'; end if;
  update public.returns set status=p_status,refund_amount=p_refund_amount,admin_note=nullif(btrim(coalesce(p_admin_note,'')),''),updated_at=now(),resolved_at=case when p_status in('refunded','rejected','closed') then now() else null end where id=p_return_id returning * into v_row;
  if not found then raise exception 'Return request not found'; end if;
  return to_jsonb(v_row);
end;$$;
revoke all on function public.update_return_status(uuid,text,numeric,text) from public;
grant execute on function public.update_return_status(uuid,text,numeric,text) to authenticated;

-- ---------- ABANDONED CHECKOUT ----------
create table if not exists public.checkout_sessions (
  token text primary key,
  phone text null,
  first_name text null,
  last_name text null,
  cart_items jsonb not null default '[]'::jsonb,
  status text not null default 'active' check(status in('active','converted')),
  order_id uuid null references public.orders(id) on delete set null,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
alter table public.checkout_sessions enable row level security;
drop policy if exists "Order admins can view checkout sessions" on public.checkout_sessions;
create policy "Order admins can view checkout sessions" on public.checkout_sessions for select to authenticated using(public.has_admin_permission('orders'));
grant select on public.checkout_sessions to authenticated;

create or replace function public.save_checkout_session(p_token text,p_phone text,p_first_name text,p_last_name text,p_items jsonb)
returns void language plpgsql security definer set search_path=public as $$
begin
  if btrim(coalesce(p_token,''))='' then return; end if;
  if jsonb_typeof(p_items) <> 'array' then return; end if;
  insert into public.checkout_sessions(token,phone,first_name,last_name,cart_items,last_seen_at)
  values(btrim(p_token),nullif(btrim(coalesce(p_phone,'')),''),nullif(btrim(coalesce(p_first_name,'')),''),nullif(btrim(coalesce(p_last_name,'')),''),p_items,now())
  on conflict(token) do update set phone=excluded.phone,first_name=excluded.first_name,last_name=excluded.last_name,cart_items=excluded.cart_items,last_seen_at=now();
end;$$;
revoke all on function public.save_checkout_session(text,text,text,text,jsonb) from public;
grant execute on function public.save_checkout_session(text,text,text,text,jsonb) to anon,authenticated;

-- ---------- STORE SETTINGS / HOMEPAGE / GOAL / INTEGRATION IDS ----------
create table if not exists public.store_settings (
  id integer primary key default 1 check(id=1),
  hero_eyebrow text not null default 'DOMARO FRAGRANCES',
  hero_title text not null default 'A SCENT THAT BECOMES YOU',
  hero_subtitle text not null default 'Discover fragrances selected for presence, character and memory.',
  hero_cta_label text not null default 'SHOP THE COLLECTION',
  hero_cta_href text not null default 'shop.html',
  announcement text null,
  promo_title text null,
  promo_text text null,
  promo_link_label text null,
  promo_link_href text null,
  monthly_sales_goal numeric(12,2) not null default 0 check(monthly_sales_goal>=0),
  ga4_id text null,
  meta_pixel_id text null,
  tiktok_pixel_id text null,
  updated_at timestamptz not null default now()
);
insert into public.store_settings(id) values(1) on conflict(id) do nothing;
alter table public.store_settings enable row level security;
drop policy if exists "Owner can view store settings" on public.store_settings;
drop policy if exists "Owner can update store settings" on public.store_settings;
create policy "Owner can view store settings" on public.store_settings for select to authenticated using(public.is_owner());
create policy "Owner can update store settings" on public.store_settings for update to authenticated using(public.is_owner()) with check(public.is_owner());
grant select,update on public.store_settings to authenticated;

create or replace function public.get_public_store_settings()
returns jsonb language sql stable security definer set search_path=public as $$
  select jsonb_build_object(
    'hero_eyebrow',hero_eyebrow,'hero_title',hero_title,'hero_subtitle',hero_subtitle,'hero_cta_label',hero_cta_label,'hero_cta_href',hero_cta_href,
    'announcement',announcement,'promo_title',promo_title,'promo_text',promo_text,'promo_link_label',promo_link_label,'promo_link_href',promo_link_href,
    'ga4_id',ga4_id,'meta_pixel_id',meta_pixel_id,'tiktok_pixel_id',tiktok_pixel_id
  ) from public.store_settings where id=1;
$$;
revoke all on function public.get_public_store_settings() from public;
grant execute on function public.get_public_store_settings() to anon,authenticated;

-- ---------- V30 ORDER PLACEMENT WITH VARIANTS / COST SNAPSHOT ----------
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

-- ---------- PROFIT / SALES GOAL METRICS ----------
create or replace function public.admin_v30_metrics(p_days integer default 30)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_days integer; v_start timestamptz; v_goal numeric(12,2); v_month_sales numeric(12,2); v_result jsonb;
begin
  if not public.has_admin_permission('dashboard') then raise exception 'Not authorized' using errcode='42501'; end if;
  v_days:=case when p_days in(0,7,30,90) then p_days else 30 end;
  v_start:=case when v_days=0 then null else now()-make_interval(days=>v_days) end;
  select monthly_sales_goal into v_goal from public.store_settings where id=1;
  select coalesce(sum(total),0) into v_month_sales from public.orders where status='delivered' and date_trunc('month',created_at at time zone 'Africa/Cairo')=date_trunc('month',now() at time zone 'Africa/Cairo');
  select jsonb_build_object(
    'known_cost',coalesce(sum(case when o.status='delivered' then oi.line_cost else 0 end),0),
    'known_profit',coalesce(sum(case when o.status='delivered' and oi.line_cost is not null then oi.line_total-oi.line_cost else 0 end),0),
    'costed_items',count(*) filter(where o.status='delivered' and oi.line_cost is not null),
    'delivered_items',count(*) filter(where o.status='delivered'),
    'monthly_sales_goal',coalesce(v_goal,0),
    'month_delivered_sales',v_month_sales
  ) into v_result
  from public.order_items oi join public.orders o on o.id=oi.order_id
  where v_start is null or o.created_at>=v_start;
  return v_result;
end;$$;
revoke all on function public.admin_v30_metrics(integer) from public;
grant execute on function public.admin_v30_metrics(integer) to authenticated;

-- ---------- AUDIT LOG ----------
create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  table_name text not null,
  record_id text null,
  action text not null,
  actor_user_id uuid null,
  actor_email text null,
  old_data jsonb null,
  new_data jsonb null,
  created_at timestamptz not null default now()
);
create index if not exists audit_log_created_idx on public.audit_log(created_at desc);
alter table public.audit_log enable row level security;
drop policy if exists "Owner can view audit log" on public.audit_log;
create policy "Owner can view audit log" on public.audit_log for select to authenticated using(public.is_owner());
grant select on public.audit_log to authenticated;

create or replace function public.v30_audit_change()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_actor uuid:=auth.uid(); v_email text; v_id text;
begin
  select email into v_email from public.admins where user_id=v_actor limit 1;
  if tg_op='DELETE' then v_id:=coalesce(to_jsonb(old)->>'id',to_jsonb(old)->>'product_id');
  else v_id:=coalesce(to_jsonb(new)->>'id',to_jsonb(new)->>'product_id'); end if;
  insert into public.audit_log(table_name,record_id,action,actor_user_id,actor_email,old_data,new_data)
  values(tg_table_name,v_id,tg_op,v_actor,v_email,case when tg_op in('UPDATE','DELETE') then to_jsonb(old) end,case when tg_op in('INSERT','UPDATE') then to_jsonb(new) end);
  if tg_op='DELETE' then return old; else return new; end if;
end;$$;

-- Install only once per table.
do $$
declare t text;
begin
  foreach t in array array['products','product_variants','product_images','coupons','store_settings','returns'] loop
    execute format('drop trigger if exists trg_v30_audit_%I on public.%I',t,t);
    execute format('create trigger trg_v30_audit_%I after insert or update or delete on public.%I for each row execute function public.v30_audit_change()',t,t);
  end loop;
end$$;

-- ---------- OWNER BACKUP / SAFE MERGE RESTORE ----------
create or replace function public.owner_store_backup()
returns jsonb language plpgsql security definer set search_path=public as $$
begin
  if not public.is_owner() then raise exception 'Owner access required' using errcode='42501'; end if;
  return jsonb_build_object(
    'version','DOMARO-V30',
    'created_at',now(),
    'products',(select coalesce(jsonb_agg(to_jsonb(p) order by p.created_at),'[]'::jsonb) from public.products p),
    'variants',(select coalesce(jsonb_agg(to_jsonb(v) order by v.product_id,v.sort_order),'[]'::jsonb) from public.product_variants v),
    'images',(select coalesce(jsonb_agg(to_jsonb(i) order by i.product_id,i.sort_order),'[]'::jsonb) from public.product_images i),
    'coupons',(select coalesce(jsonb_agg(to_jsonb(c) order by c.created_at),'[]'::jsonb) from public.coupons c),
    'settings',(select to_jsonb(s) from public.store_settings s where id=1)
  );
end;$$;
revoke all on function public.owner_store_backup() from public;
grant execute on function public.owner_store_backup() to authenticated;

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
      hero_eyebrow=coalesce(p_backup->'settings'->>'hero_eyebrow',hero_eyebrow),hero_title=coalesce(p_backup->'settings'->>'hero_title',hero_title),hero_subtitle=coalesce(p_backup->'settings'->>'hero_subtitle',hero_subtitle),hero_cta_label=coalesce(p_backup->'settings'->>'hero_cta_label',hero_cta_label),hero_cta_href=coalesce(p_backup->'settings'->>'hero_cta_href',hero_cta_href),announcement=p_backup->'settings'->>'announcement',promo_title=p_backup->'settings'->>'promo_title',promo_text=p_backup->'settings'->>'promo_text',promo_link_label=p_backup->'settings'->>'promo_link_label',promo_link_href=p_backup->'settings'->>'promo_link_href',monthly_sales_goal=coalesce(nullif(p_backup->'settings'->>'monthly_sales_goal','')::numeric,monthly_sales_goal),ga4_id=p_backup->'settings'->>'ga4_id',meta_pixel_id=p_backup->'settings'->>'meta_pixel_id',tiktok_pixel_id=p_backup->'settings'->>'tiktok_pixel_id',updated_at=now() where id=1;
  end if;
  return jsonb_build_object('ok',true,'products_merged',v_count);
end;$$;
revoke all on function public.owner_restore_store_backup(jsonb) from public;
grant execute on function public.owner_restore_store_backup(jsonb) to authenticated;

commit;
