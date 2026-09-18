DOMARO WEBSITE V12
==================

NEW IN V12
- New SALES DASHBOARD tab in Admin
- Delivered revenue total
- Total / New / Confirmed / Shipped / Delivered / Cancelled order counts
- Top 5 best-selling products
- Recent 5 orders with status and value
- Dashboard statistics are returned by an Admin-only Supabase RPC

IMPORTANT
- Run SUPABASE-V12-MIGRATION.sql once before deploying V12.
- Delivered Revenue only counts orders whose status is Delivered.
- Best-selling products exclude cancelled orders.

DOMARO WEBSITE V11
==================

NEW IN V11
- Secure discount codes / coupons
- Percentage or fixed-EGP discounts
- Minimum order amount, usage limit and expiry support
- Coupon revalidated server-side when an order is placed
- COUPONS tab in Admin to add/edit/activate/deactivate/delete codes
- Coupon and discount displayed in admin order cards

DOMARO WEBSITE V8 — STOCK + NEW ORDER ALERTS

NEW: REAL INVENTORY
- Each product now has Stock Quantity.
- Blank quantity = inventory not tracked yet.
- 0 = Out of Stock.
- Positive number = real stock.
- Tracked stock automatically decreases after every successful order.
- When tracked stock reaches 0, the product automatically becomes Out of Stock.
- Stock validation is done in Supabase inside the order transaction to reduce overselling risk.

NEW: BROWSER ORDER ALERTS
- Admin has an ENABLE ALERTS button.
- Allow browser notifications once.
- The dashboard checks every 60 seconds while the Admin page is open.
- New orders can trigger a browser notification and refresh the orders list automatically.

IMPORTANT
Browser alerts require the Admin dashboard to remain open.
Email / WhatsApp alerts that work while the dashboard is closed require an external notification provider and can be added next.

BEFORE DEPLOYING V8
1. Supabase → SQL Editor → New query.
2. Open SUPABASE-V8-MIGRATION.sql.
3. Copy all code into Supabase.
4. Run it and confirm Success.
5. Then deploy v8 to GitHub/Vercel.

AFTER DEPLOYING
Admin → PRODUCTS → Edit each product → enter the REAL stock quantity.

Existing products intentionally start with quantity blank so no fake inventory number is created.


V10 — CUSTOMER ORDER TRACKING
- Added track.html for customer self-service order status lookup.
- Customers must enter both order number and matching checkout mobile number.
- Displays status timeline: Order received → Confirmed → Shipped → Delivered, plus Cancelled state.
- Shows order items, payment method and total, but does not expose customer name/address/notes.
- Checkout success page links directly to Track Order with the new order number prefilled.
- Run SUPABASE-V10-MIGRATION.sql once before deploying this version.


V13 additions:
- Review Order step before final confirmation
- Clearer checkout validation
- Unique checkout token for idempotent order placement
- Duplicate-click / retry protection at database level
