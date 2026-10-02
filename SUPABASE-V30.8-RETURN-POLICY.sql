-- DOMARO V30.8 — editable Returns & Exchanges policy

alter table public.store_settings
  add column if not exists entry_gate_wallpaper_url text,
  add column if not exists returns_intro text,
  add column if not exists returns_eligible text,
  add column if not exists returns_opened text,
  add column if not exists returns_condition text,
  add column if not exists returns_shipping_refunds text,
  add column if not exists returns_how_to text,
  add column if not exists returns_note text;

update public.store_settings
set
  returns_intro = coalesce(returns_intro,'We want every DOMARO order to arrive in the condition you expect. Because fragrance products are personal-use items, eligibility depends on the condition of the item when it is returned.'),
  returns_eligible = coalesce(returns_eligible,'Unused and unopened items in their original packaging may be considered for return or exchange. Wrong items, damaged items, or products received with a manufacturing defect should be reported as soon as possible after delivery. Proof of purchase or your DOMARO order number may be required.'),
  returns_opened = coalesce(returns_opened,'For hygiene and product-integrity reasons, opened, sprayed, or used fragrances are generally not eligible for return or exchange unless the item is defective, damaged on arrival, or incorrect.'),
  returns_condition = coalesce(returns_condition,'Returned items should include the original box, packaging, accessories, seals, and any included gifts where applicable. Items that show signs of use or damage after delivery may be declined.'),
  returns_shipping_refunds = coalesce(returns_shipping_refunds,'If DOMARO sent the wrong item or the product arrived damaged or defective, we will review the case and arrange the appropriate solution. For approved refunds, processing starts after the returned item is received and inspected. Bank or payment-provider processing times may vary.'),
  returns_how_to = coalesce(returns_how_to,'Contact DOMARO through the Contact page and include your order number, the item concerned, and a short explanation. For damaged or incorrect items, photos may help us review the request faster.'),
  returns_note = coalesce(returns_note,'This store policy is applied together with any mandatory consumer rights that apply to your purchase.')
where id=1;

create or replace function public.get_public_store_settings()
returns jsonb language sql stable security definer set search_path=public as $$
  select jsonb_build_object(
    'hero_eyebrow',hero_eyebrow,
    'hero_title',hero_title,
    'hero_subtitle',hero_subtitle,
    'hero_cta_label',hero_cta_label,
    'hero_cta_href',hero_cta_href,
    'announcement',announcement,
    'promo_title',promo_title,
    'promo_text',promo_text,
    'promo_link_label',promo_link_label,
    'promo_link_href',promo_link_href,
    'entry_gate_wallpaper_url',entry_gate_wallpaper_url,
    'returns_intro',returns_intro,
    'returns_eligible',returns_eligible,
    'returns_opened',returns_opened,
    'returns_condition',returns_condition,
    'returns_shipping_refunds',returns_shipping_refunds,
    'returns_how_to',returns_how_to,
    'returns_note',returns_note,
    'ga4_id',ga4_id,
    'meta_pixel_id',meta_pixel_id,
    'tiktok_pixel_id',tiktok_pixel_id
  ) from public.store_settings where id=1;
$$;

revoke all on function public.get_public_store_settings() from public;
grant execute on function public.get_public_store_settings() to anon,authenticated;
