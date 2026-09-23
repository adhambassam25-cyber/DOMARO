-- DOMARO V30.6 — KEY NOTES SUPPORT
-- Safe to run once or more.

alter table public.products
  add column if not exists key_notes text null;

-- Keep owner backup/restore compatible with Key Notes.
create or replace function public.owner_restore_store_backup(p_backup jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare x jsonb; v_count int:=0;
begin
  if not public.is_owner() then raise exception 'Owner access required' using errcode='42501'; end if;
  if coalesce(p_backup->>'version','') <> 'DOMARO-V30' then raise exception 'Unsupported backup version'; end if;

  for x in select value from jsonb_array_elements(coalesce(p_backup->'products','[]'::jsonb)) loop
    insert into public.products(id,name,category,size_ml,price,image_path,active,description,in_stock,stock_quantity,brand,story,top_notes,heart_notes,base_notes,key_notes,cost_price,updated_at)
    values(x->>'id',x->>'name',x->>'category',(x->>'size_ml')::int,(x->>'price')::numeric,x->>'image_path',coalesce((x->>'active')::boolean,true),x->>'description',coalesce((x->>'in_stock')::boolean,true),nullif(x->>'stock_quantity','')::int,x->>'brand',x->>'story',x->>'top_notes',x->>'heart_notes',x->>'base_notes',x->>'key_notes',nullif(x->>'cost_price','')::numeric,now())
    on conflict(id) do update set name=excluded.name,category=excluded.category,size_ml=excluded.size_ml,price=excluded.price,image_path=excluded.image_path,active=excluded.active,description=excluded.description,in_stock=excluded.in_stock,stock_quantity=excluded.stock_quantity,brand=excluded.brand,story=excluded.story,top_notes=excluded.top_notes,heart_notes=excluded.heart_notes,base_notes=excluded.base_notes,key_notes=excluded.key_notes,cost_price=excluded.cost_price,updated_at=now();
    v_count:=v_count+1;
  end loop;

  update public.product_variants v
  set is_default=false, updated_at=now()
  where v.product_id in (select distinct value->>'product_id' from jsonb_array_elements(coalesce(p_backup->'variants','[]'::jsonb)));

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
      hero_eyebrow=coalesce(p_backup->'settings'->>'hero_eyebrow',hero_eyebrow),
      hero_title=coalesce(p_backup->'settings'->>'hero_title',hero_title),
      hero_subtitle=coalesce(p_backup->'settings'->>'hero_subtitle',hero_subtitle),
      hero_cta_label=coalesce(p_backup->'settings'->>'hero_cta_label',hero_cta_label),
      hero_cta_href=coalesce(p_backup->'settings'->>'hero_cta_href',hero_cta_href),
      announcement=p_backup->'settings'->>'announcement',
      promo_title=p_backup->'settings'->>'promo_title',
      promo_text=p_backup->'settings'->>'promo_text',
      promo_link_label=p_backup->'settings'->>'promo_link_label',
      promo_link_href=p_backup->'settings'->>'promo_link_href',
      monthly_sales_goal=coalesce(nullif(p_backup->'settings'->>'monthly_sales_goal','')::numeric,monthly_sales_goal),
      ga4_id=p_backup->'settings'->>'ga4_id',
      meta_pixel_id=p_backup->'settings'->>'meta_pixel_id',
      tiktok_pixel_id=p_backup->'settings'->>'tiktok_pixel_id',
      updated_at=now() where id=1;
  end if;

  return jsonb_build_object('ok',true,'products_restored',v_count);
end;$$;

revoke all on function public.owner_restore_store_backup(jsonb) from public;
grant execute on function public.owner_restore_store_backup(jsonb) to authenticated;
