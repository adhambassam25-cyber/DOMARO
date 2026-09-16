-- DOMARO v7 — Product Management migration
-- Run this once in Supabase SQL Editor BEFORE deploying v7.

alter table public.products
  add column if not exists description text;

alter table public.products
  add column if not exists in_stock boolean not null default true;

alter table public.products
  add column if not exists updated_at timestamptz not null default now();


-- Admins can see all products, including hidden ones.
drop policy if exists "Admins can view all products" on public.products;
create policy "Admins can view all products"
on public.products
for select
to authenticated
using (public.is_admin());


drop policy if exists "Admins can add products" on public.products;
create policy "Admins can add products"
on public.products
for insert
to authenticated
with check (public.is_admin());


drop policy if exists "Admins can edit products" on public.products;
create policy "Admins can edit products"
on public.products
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());


drop policy if exists "Admins can delete products" on public.products;
create policy "Admins can delete products"
on public.products
for delete
to authenticated
using (public.is_admin());


grant select, insert, update, delete
on public.products
to authenticated;


-- Product image storage bucket.
insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'products',
  'products',
  true,
  5242880,
  array['image/jpeg','image/png','image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;


drop policy if exists "Public can view product images"
on storage.objects;

create policy "Public can view product images"
on storage.objects
for select
to public
using (bucket_id = 'products');


drop policy if exists "Admins can upload product images"
on storage.objects;

create policy "Admins can upload product images"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'products'
  and public.is_admin()
);


drop policy if exists "Admins can update product images"
on storage.objects;

create policy "Admins can update product images"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'products'
  and public.is_admin()
)
with check (
  bucket_id = 'products'
  and public.is_admin()
);


drop policy if exists "Admins can delete product images"
on storage.objects;

create policy "Admins can delete product images"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'products'
  and public.is_admin()
);


-- Recreate order function so hidden/out-of-stock products cannot be ordered.
create or replace function public.place_order(
  p_first_name text,
  p_last_name text,
  p_phone text,
  p_governorate text,
  p_area text,
  p_building text,
  p_address text,
  p_notes text,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid := gen_random_uuid();
  v_order_number text;
  v_subtotal integer := 0;
  v_shipping integer := 80;
  v_total integer;

  v_item jsonb;
  v_product_id text;
  v_qty integer;
  v_product public.products%rowtype;
begin

  if trim(coalesce(p_first_name, '')) = '' then
    raise exception 'First name is required';
  end if;

  if trim(coalesce(p_last_name, '')) = '' then
    raise exception 'Last name is required';
  end if;

  if p_phone !~ '^01[0125][0-9]{8}$' then
    raise exception 'Invalid Egyptian mobile number';
  end if;

  if trim(coalesce(p_governorate, '')) = '' then
    raise exception 'Governorate is required';
  end if;

  if trim(coalesce(p_area, '')) = '' then
    raise exception 'Area is required';
  end if;

  if trim(coalesce(p_address, '')) = '' then
    raise exception 'Address is required';
  end if;

  if jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) = 0 then
    raise exception 'Order must contain products';
  end if;


  for v_item in
    select value from jsonb_array_elements(p_items)
  loop

    v_product_id := v_item ->> 'id';
    v_qty := (v_item ->> 'qty')::integer;

    if v_qty < 1 or v_qty > 10 then
      raise exception 'Invalid quantity';
    end if;

    select *
    into v_product
    from public.products
    where id = v_product_id
      and active = true
      and in_stock = true;

    if not found then
      raise exception 'Product is unavailable';
    end if;

    v_subtotal :=
      v_subtotal + (v_product.price * v_qty);

  end loop;


  v_total := v_subtotal + v_shipping;

  v_order_number :=
    'DOM-' ||
    to_char(current_date, 'YYMMDD') ||
    '-' ||
    upper(
      substr(
        replace(v_order_id::text, '-', ''),
        1,
        6
      )
    );


  insert into public.orders (
    id,
    order_number,
    first_name,
    last_name,
    phone,
    governorate,
    area,
    building,
    address,
    notes,
    subtotal,
    shipping,
    total,
    payment_method,
    status
  )
  values (
    v_order_id,
    v_order_number,
    trim(p_first_name),
    trim(p_last_name),
    p_phone,
    p_governorate,
    trim(p_area),
    trim(coalesce(p_building, '')),
    trim(p_address),
    trim(coalesce(p_notes, '')),
    v_subtotal,
    v_shipping,
    v_total,
    'Cash on Delivery',
    'new'
  );


  for v_item in
    select value from jsonb_array_elements(p_items)
  loop

    v_product_id := v_item ->> 'id';
    v_qty := (v_item ->> 'qty')::integer;

    select *
    into v_product
    from public.products
    where id = v_product_id
      and active = true
      and in_stock = true;

    insert into public.order_items (
      order_id,
      product_id,
      product_name,
      size_ml,
      unit_price,
      quantity,
      line_total
    )
    values (
      v_order_id,
      v_product.id,
      v_product.name,
      v_product.size_ml,
      v_product.price,
      v_qty,
      v_product.price * v_qty
    );

  end loop;


  return jsonb_build_object(
    'orderNumber', v_order_number,
    'subtotal', v_subtotal,
    'shipping', v_shipping,
    'total', v_total,
    'status', 'new'
  );

end;
$$;

revoke all
on function public.place_order(
  text,text,text,text,text,text,text,text,jsonb
)
from public;

grant execute
on function public.place_order(
  text,text,text,text,text,text,text,text,jsonb
)
to anon, authenticated;
