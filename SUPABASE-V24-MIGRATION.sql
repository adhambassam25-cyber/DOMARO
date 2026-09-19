-- DOMARO V24 — Order Timeline, Admin Notes & Status History
-- Run once in Supabase SQL Editor before deploying the V24 frontend.

begin;

create table if not exists public.order_activity (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders(id) on delete cascade,
  event_type text not null check (event_type in ('created','status_change','admin_note')),
  old_status text null,
  new_status text null,
  note text null,
  actor_user_id uuid null,
  actor_email text null,
  created_at timestamptz not null default now()
);

create index if not exists order_activity_order_created_idx
  on public.order_activity(order_id, created_at desc, id desc);

alter table public.order_activity enable row level security;

drop policy if exists "Admins with orders permission can view order activity" on public.order_activity;
create policy "Admins with orders permission can view order activity"
on public.order_activity
for select
to authenticated
using (public.has_admin_permission('orders'));

revoke all on table public.order_activity from anon, authenticated;
grant select on table public.order_activity to authenticated;

-- Automatically record every new customer order going forward.
create or replace function public.log_new_order_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.order_activity (
    order_id, event_type, new_status, actor_user_id, actor_email, created_at
  )
  values (
    new.id, 'created', coalesce(new.status, 'new'), null, null, coalesce(new.created_at, now())
  );
  return new;
end;
$$;

drop trigger if exists trg_log_new_order_activity on public.orders;
create trigger trg_log_new_order_activity
after insert on public.orders
for each row execute function public.log_new_order_activity();

-- Backfill one "created" event for orders that existed before V24.
insert into public.order_activity (
  order_id, event_type, new_status, actor_user_id, actor_email, created_at
)
select
  o.id,
  'created',
  'new',
  null,
  null,
  o.created_at
from public.orders o
where not exists (
  select 1
  from public.order_activity a
  where a.order_id = o.id
    and a.event_type = 'created'
);

-- Replace the status RPC so every real status change is written to history.
drop function if exists public.update_order_status(uuid, text);

create function public.update_order_status(
  p_order_id uuid,
  p_status text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old_status text;
  v_actor_email text;
begin
  if not public.has_admin_permission('orders') then
    raise exception 'Not authorized to manage orders' using errcode = '42501';
  end if;

  if p_status not in ('new','confirmed','shipped','delivered','cancelled') then
    raise exception 'Invalid order status' using errcode = '22023';
  end if;

  select status
    into v_old_status
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Order not found' using errcode = 'P0002';
  end if;

  select a.email
    into v_actor_email
  from public.admins a
  where a.user_id = auth.uid()
  limit 1;

  if v_old_status is distinct from p_status then
    update public.orders
    set status = p_status
    where id = p_order_id;

    insert into public.order_activity (
      order_id,
      event_type,
      old_status,
      new_status,
      actor_user_id,
      actor_email
    )
    values (
      p_order_id,
      'status_change',
      v_old_status,
      p_status,
      auth.uid(),
      v_actor_email
    );
  end if;

  return jsonb_build_object(
    'order_id', p_order_id,
    'old_status', v_old_status,
    'status', p_status,
    'changed', (v_old_status is distinct from p_status)
  );
end;
$$;

revoke all on function public.update_order_status(uuid, text) from public;
grant execute on function public.update_order_status(uuid, text) to authenticated;

-- Internal admin notes are immutable audit events.
create or replace function public.add_order_note(
  p_order_id uuid,
  p_note text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_note text;
  v_actor_email text;
  v_activity public.order_activity%rowtype;
begin
  if not public.has_admin_permission('orders') then
    raise exception 'Not authorized to manage orders' using errcode = '42501';
  end if;

  v_note := btrim(coalesce(p_note, ''));

  if v_note = '' then
    raise exception 'Admin note cannot be empty' using errcode = '22023';
  end if;

  if length(v_note) > 2000 then
    raise exception 'Admin note is too long' using errcode = '22023';
  end if;

  perform 1
  from public.orders
  where id = p_order_id;

  if not found then
    raise exception 'Order not found' using errcode = 'P0002';
  end if;

  select a.email
    into v_actor_email
  from public.admins a
  where a.user_id = auth.uid()
  limit 1;

  insert into public.order_activity (
    order_id,
    event_type,
    note,
    actor_user_id,
    actor_email
  )
  values (
    p_order_id,
    'admin_note',
    v_note,
    auth.uid(),
    v_actor_email
  )
  returning * into v_activity;

  return to_jsonb(v_activity);
end;
$$;

revoke all on function public.add_order_note(uuid, text) from public;
grant execute on function public.add_order_note(uuid, text) to authenticated;

commit;
