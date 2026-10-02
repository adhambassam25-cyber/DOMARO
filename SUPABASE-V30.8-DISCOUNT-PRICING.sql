-- DOMARO V30.8 — sale / discount pricing
-- Current price stays in price. Optional compare_at_price is the original price shown crossed out.

alter table public.products
  add column if not exists compare_at_price numeric;

alter table public.product_variants
  add column if not exists compare_at_price numeric;

alter table public.products
  drop constraint if exists products_compare_at_price_check;

alter table public.products
  add constraint products_compare_at_price_check
  check (compare_at_price is null or compare_at_price >= 0);

alter table public.product_variants
  drop constraint if exists product_variants_compare_at_price_check;

alter table public.product_variants
  add constraint product_variants_compare_at_price_check
  check (compare_at_price is null or compare_at_price >= 0);
