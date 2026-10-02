-- DOMARO V30.8 — customer return / exchange workflow upgrade

begin;

alter table public.returns
  add column if not exists request_type text not null default 'return';

alter table public.returns
  add column if not exists item_label text null;

alter table public.returns
  add column if not exists evidence_urls jsonb not null default '[]'::jsonb;

alter table public.returns
  drop constraint if exists returns_request_type_check;

alter table public.returns
  add constraint returns_request_type_check
  check (request_type in ('return','exchange'));

alter table public.returns
  drop constraint if exists returns_status_check;

alter table public.returns
  add constraint returns_status_check
  check (status in ('requested','under_review','approved','rejected','received','refunded','completed','closed'));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values(
  'return-evidence',
  'return-evidence',
  true,
  5242880,
  array['image/jpeg','image/png','image/webp']::text[]
)
on conflict(id) do update set
  public=excluded.public,
  file_size_limit=excluded.file_size_limit,
  allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "Customers can upload return evidence" on storage.objects;
create policy "Customers can upload return evidence"
on storage.objects for insert
to anon, authenticated
with check (bucket_id='return-evidence');

drop policy if exists "Order admins can manage return evidence" on storage.objects;
create policy "Order admins can manage return evidence"
on storage.objects for all
to authenticated
using (bucket_id='return-evidence' and public.has_admin_permission('orders'))
with check (bucket_id='return-evidence' and public.has_admin_permission('orders'));

create or replace function public.request_after_sales(
  p_order_number text,
  p_phone text,
  p_request_type text,
  p_item_label text,
  p_reason text,
  p_details text default null,
  p_evidence_urls jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_order public.orders%rowtype;
  v_row public.returns%rowtype;
  v_type text := lower(btrim(coalesce(p_request_type,'')));
  v_item text := btrim(coalesce(p_item_label,''));
begin
  select * into v_order
  from public.orders
  where upper(order_number)=upper(btrim(p_order_number))
    and phone=btrim(p_phone)
  limit 1;

  if not found then raise exception 'Order not found'; end if;
  if v_order.status <> 'delivered' then raise exception 'Return or exchange requests can be submitted after delivery'; end if;
  if v_type not in ('return','exchange') then raise exception 'Choose return or exchange'; end if;
  if v_item='' then raise exception 'Choose the item for this request'; end if;
  if btrim(coalesce(p_reason,''))='' then raise exception 'Reason is required'; end if;

  if not exists(
    select 1 from public.order_items oi
    where oi.order_id=v_order.id
      and (
        lower(btrim(oi.product_name))=lower(v_item)
        or lower(btrim(oi.product_name || coalesce(' · '||nullif(oi.variant_label,''),'')))=lower(v_item)
        or lower(btrim(oi.product_name || ' · ' || oi.size_ml::text || ' ML'))=lower(v_item)
      )
  ) then
    raise exception 'Selected item does not belong to this order';
  end if;

  if exists(
    select 1 from public.returns
    where order_id=v_order.id
      and lower(coalesce(item_label,''))=lower(v_item)
      and status in ('requested','under_review','approved','received')
  ) then
    raise exception 'An open return or exchange request already exists for this item';
  end if;

  insert into public.returns(
    order_id,order_number,phone,request_type,item_label,reason,details,evidence_urls,status
  )
  values(
    v_order.id,
    v_order.order_number,
    v_order.phone,
    v_type,
    v_item,
    btrim(p_reason),
    nullif(btrim(coalesce(p_details,'')),''),
    case when jsonb_typeof(coalesce(p_evidence_urls,'[]'::jsonb))='array' then coalesce(p_evidence_urls,'[]'::jsonb) else '[]'::jsonb end,
    'requested'
  )
  returning * into v_row;

  return to_jsonb(v_row);
end;
$$;

revoke all on function public.request_after_sales(text,text,text,text,text,text,jsonb) from public;
grant execute on function public.request_after_sales(text,text,text,text,text,text,jsonb) to anon,authenticated;

create or replace function public.update_return_status(
  p_return_id uuid,
  p_status text,
  p_refund_amount numeric default null,
  p_admin_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare v_row public.returns%rowtype;
begin
  if not public.has_admin_permission('orders') then
    raise exception 'Not authorized' using errcode='42501';
  end if;

  if p_status not in ('requested','under_review','approved','rejected','received','refunded','completed','closed') then
    raise exception 'Invalid return status';
  end if;

  update public.returns
  set
    status=p_status,
    refund_amount=p_refund_amount,
    admin_note=nullif(btrim(coalesce(p_admin_note,'')),''),
    updated_at=now(),
    resolved_at=case when p_status in ('refunded','rejected','completed','closed') then now() else null end
  where id=p_return_id
  returning * into v_row;

  if not found then raise exception 'Return request not found'; end if;
  return to_jsonb(v_row);
end;
$$;

revoke all on function public.update_return_status(uuid,text,numeric,text) from public;
grant execute on function public.update_return_status(uuid,text,numeric,text) to authenticated;

commit;
