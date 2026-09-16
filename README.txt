DOMARO WEBSITE V6

NEW IN V6
- Secure Admin Login using Supabase Authentication
- Admin access is enforced by database RLS policies
- Admin Dashboard at /admin.html
- View all customer orders
- View customer name, phone, address, notes
- View products, quantities and totals
- Search orders
- Filter by status
- Order statistics
- Update status:
  New / Confirmed / Shipped / Delivered / Cancelled
- No admin link is shown on the public storefront
- Admin page is marked noindex/nofollow

SECURITY
- Website contains only the Supabase publishable key.
- Admin password is never stored in the website source.
- Order data requires an authenticated user who exists in public.admins.
- Status changes are performed through the protected update_order_status function.
- Session token is stored in sessionStorage and is cleared when the browser tab/session closes.

ADMIN PAGE
https://YOUR-DOMAIN/admin.html

LOGIN
Use the Supabase Authentication account you created and authorized as an admin.

NEXT PHASE IDEAS
- Products managed from dashboard
- Inventory / stock
- Notifications when a new order arrives
- Analytics and sales reports
- Customer email/WhatsApp notifications
