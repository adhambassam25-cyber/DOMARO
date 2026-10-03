-- DOMARO V30.9.2 — Product display order

alter table public.products
  add column if not exists display_order integer;

with ranked as (
  select id, row_number() over (order by created_at asc, id asc)::integer as rn
  from public.products
)
update public.products p
set display_order = ranked.rn
from ranked
where p.id = ranked.id
  and p.display_order is null;

create or replace function public.products_assign_display_order()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.display_order is null or new.display_order < 1 then
    select coalesce(max(display_order),0)+1
      into new.display_order
    from public.products;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_products_assign_display_order on public.products;
create trigger trg_products_assign_display_order
before insert on public.products
for each row execute function public.products_assign_display_order();

create or replace function public.set_product_display_order(
  p_product_id text,
  p_position integer
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current integer;
  v_target integer;
  v_count integer;
begin
  if not public.has_admin_permission('products') then
    raise exception 'Not authorized';
  end if;

  if p_position is null or p_position < 1 then
    raise exception 'Display position must be 1 or greater';
  end if;

  lock table public.products in share row exclusive mode;

  select display_order
    into v_current
  from public.products
  where id = p_product_id;

  if not found then
    raise exception 'Product not found';
  end if;

  select count(*)::integer into v_count from public.products;
  v_target := least(greatest(p_position,1),greatest(v_count,1));

  if v_current is null then
    select coalesce(max(display_order),0)+1 into v_current from public.products;
    update public.products set display_order=v_current where id=p_product_id;
  end if;

  if v_target < v_current then
    update public.products
      set display_order = display_order + 1
    where id <> p_product_id
      and display_order >= v_target
      and display_order < v_current;
  elsif v_target > v_current then
    update public.products
      set display_order = display_order - 1
    where id <> p_product_id
      and display_order > v_current
      and display_order <= v_target;
  end if;

  update public.products
    set display_order = v_target,
        updated_at = now()
  where id = p_product_id;

  return v_target;
end;
$$;

revoke all on function public.set_product_display_order(text, integer) from public;
grant execute on function public.set_product_display_order(text, integer) to authenticated;

create or replace function public.products_close_display_order_gap()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.display_order is not null then
    update public.products
      set display_order = display_order - 1
    where display_order > old.display_order;
  end if;
  return old;
end;
$$;

drop trigger if exists trg_products_close_display_order_gap on public.products;
create trigger trg_products_close_display_order_gap
after delete on public.products
for each row execute function public.products_close_display_order_gap();

create index if not exists products_display_order_idx
  on public.products(display_order, created_at);
