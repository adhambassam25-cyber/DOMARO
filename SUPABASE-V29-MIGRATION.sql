-- DOMARO V29 — Owner-only product deletion
-- Run once before deploying V29.

begin;

-- Normal product admins can still create and edit products, but only the Owner may delete a product.
drop policy if exists "Admins can delete products" on public.products;
drop policy if exists "Owner can delete products" on public.products;

create policy "Owner can delete products"
on public.products
for delete
to authenticated
using (public.is_owner());

commit;
