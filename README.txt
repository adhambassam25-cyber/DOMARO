DOMARO WEBSITE V7 — PRODUCT MANAGEMENT

WHAT V7 ADDS
- Products are loaded from Supabase instead of being hard-coded in app.js.
- Admin dashboard now has ORDERS and PRODUCTS tabs.
- Add products from the admin dashboard.
- Edit product name, category, size, price and description.
- Upload product images to Supabase Storage.
- Mark products In Stock / Out of Stock.
- Hide products from the public store or make them live again.
- Public Shop updates from the database automatically.
- Hidden products cannot be ordered.
- Out-of-stock products cannot be ordered.
- Existing 3 products remain in the database and continue to work.

IMPORTANT — RUN SQL FIRST
Before deploying v7:
1. Open Supabase → SQL Editor → New query.
2. Paste the full contents of SUPABASE-V7-MIGRATION.sql.
3. Run it.
4. Only after Success, deploy DOMARO v7.

ADMIN PRODUCT MANAGEMENT
After deployment:
https://domaro.vercel.app/admin.html
Login → PRODUCTS.

IMAGE RULES
- JPG, PNG or WebP
- Maximum 5 MB
- Images are stored in a public Supabase Storage bucket called: products

SHIPPING
Flat shipping remains 80 EGP.
