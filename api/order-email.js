const SUPABASE_URL = 'https://zuqjxcsjjgotwwmlvxmf.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_gaSdKLisgpHYocKX5dYAmw_CZeW6s0c';

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function money(value) {
  const amount = Number(value || 0);
  return `${amount.toLocaleString('en-EG', { maximumFractionDigits: 2 })} EGP`;
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

function isValidPhone(value) {
  return /^01[0125][0-9]{8}$/.test(String(value || '').replace(/\s+/g, ''));
}

const {brandedEmail}=require('./email-template');
function emailShell(preheader,content){return brandedEmail({title:preheader,description:'Your DOMARO order details are below.',note:'Thank you for shopping with DOMARO.'}).replace('</td></tr><tr><td style="padding:20px',content+'</td></tr><tr><td style="padding:20px');}

function itemsHtml(items) {
  return (Array.isArray(items) ? items : []).map(item => `
    <tr>
      <td style="padding:12px 0;border-bottom:1px solid #ece9e4;">
        <div style="font-weight:700;color:#171615;">${escapeHtml(item.product_name)}</div>
        <div style="font-size:12px;color:#77716a;margin-top:4px;">${escapeHtml(item.size_ml)} ML · Qty ${escapeHtml(item.quantity)}</div>
      </td>
      <td style="padding:12px 0;border-bottom:1px solid #ece9e4;text-align:right;font-weight:700;white-space:nowrap;">${money(item.line_total)}</td>
    </tr>
  `).join('');
}

async function sendEmail({ to, subject, html, idempotencyKey }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('RESEND_API_KEY is not configured');

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey
    },
    body: JSON.stringify({
      from: 'DOMARO Orders <orders@domaro-eg.com>',
      to: [to],
      subject,
      html,
      reply_to: process.env.ORDER_NOTIFICATION_EMAIL || 'domaro.eg@gmail.com'
    })
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload?.message || payload?.error || 'Resend request failed';
    throw new Error(message);
  }
  return payload;
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const orderNumber = String(body.orderNumber || '').trim().toUpperCase();
    const phone = String(body.phone || '').replace(/\s+/g, '');

    if (!/^DOM-\d{6}-[A-Z0-9]{6}$/.test(orderNumber) || !isValidPhone(phone)) {
      return res.status(400).json({ error: 'Invalid order details' });
    }

    const orderResponse = await fetch(`${SUPABASE_URL}/rest/v1/rpc/track_order`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_PUBLISHABLE_KEY,
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify({
        p_order_number: orderNumber,
        p_phone: phone
      })
    });

    const order = await orderResponse.json().catch(() => null);
    if (!orderResponse.ok || !order?.order_number) {
      return res.status(404).json({ error: 'Order could not be verified' });
    }

    const customer = body.customer && typeof body.customer === 'object' ? body.customer : {};
    const customerEmail = isValidEmail(body.email) ? String(body.email).trim().toLowerCase() : null;
    const adminEmail = process.env.ORDER_NOTIFICATION_EMAIL || 'domaro.eg@gmail.com';
    const rows = itemsHtml(order.items);

    const adminHtml = emailShell(
      `New order ${order.order_number}`,
      `
        <div style="font-size:12px;letter-spacing:2px;color:#7c756d;font-weight:700;">NEW ORDER</div>
        <h1 style="margin:8px 0 4px;font-size:26px;color:#171615;">${escapeHtml(order.order_number)}</h1>
        <p style="margin:0 0 24px;color:#67615a;">A new order has been placed on DOMARO.</p>

        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom:22px;">
          <tr><td style="padding:7px 0;color:#77716a;">Customer</td><td style="padding:7px 0;text-align:right;font-weight:700;">${escapeHtml(customer.firstName)} ${escapeHtml(customer.lastName)}</td></tr>
          <tr><td style="padding:7px 0;color:#77716a;">Mobile</td><td style="padding:7px 0;text-align:right;font-weight:700;">${escapeHtml(phone)}</td></tr>
          ${customerEmail ? `<tr><td style="padding:7px 0;color:#77716a;">Email</td><td style="padding:7px 0;text-align:right;font-weight:700;">${escapeHtml(customerEmail)}</td></tr>` : ''}
          <tr><td style="padding:7px 0;color:#77716a;">Governorate</td><td style="padding:7px 0;text-align:right;font-weight:700;">${escapeHtml(customer.governorate)}</td></tr>
          <tr><td style="padding:7px 0;color:#77716a;">Area</td><td style="padding:7px 0;text-align:right;font-weight:700;">${escapeHtml(customer.area)}</td></tr>
        </table>

        <div style="padding:16px;background:#f7f5f1;margin-bottom:22px;line-height:1.6;">
          <div style="font-size:11px;letter-spacing:1.5px;color:#7c756d;font-weight:700;margin-bottom:6px;">DELIVERY ADDRESS</div>
          <div style="font-weight:700;">${escapeHtml(customer.address)}</div>
          ${customer.building ? `<div>${escapeHtml(customer.building)}</div>` : ''}
          ${customer.notes ? `<div style="margin-top:8px;color:#67615a;"><b>Notes:</b> ${escapeHtml(customer.notes)}</div>` : ''}
        </div>

        <table role="presentation" width="100%" cellspacing="0" cellpadding="0">${rows}</table>

        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:18px;">
          <tr><td style="padding:6px 0;color:#77716a;">Payment</td><td style="padding:6px 0;text-align:right;font-weight:700;">${escapeHtml(order.payment_method || 'Cash on Delivery')}</td></tr>
          <tr><td style="padding:10px 0;font-size:18px;font-weight:700;">Order total</td><td style="padding:10px 0;text-align:right;font-size:18px;font-weight:700;">${money(order.total)}</td></tr>
        </table>
      `
    );

    const sends = [
      sendEmail({
        to: adminEmail,
        subject: `New DOMARO order — ${order.order_number}`,
        html: adminHtml,
        idempotencyKey: `domaro-admin-${order.order_number}`
      })
    ];

    if (customerEmail) {
      const customerHtml = emailShell(
        `Your DOMARO order ${order.order_number} has been received`,
        `
          <div style="font-size:12px;letter-spacing:2px;color:#7c756d;font-weight:700;">ORDER RECEIVED</div>
          <h1 style="margin:8px 0 10px;font-size:26px;color:#171615;">Thank you for your order.</h1>
          <p style="margin:0 0 22px;color:#67615a;line-height:1.7;">We have received your order. If you selected InstaPay, payment verification is required before processing. Keep your order number below for tracking.</p>

          <div style="padding:18px;background:#0a0a0a;color:#ffffff;text-align:center;margin-bottom:22px;">
            <div style="font-size:11px;letter-spacing:2px;color:#c9c5bf;">YOUR ORDER NUMBER</div>
            <div style="font-size:23px;font-weight:700;margin-top:7px;letter-spacing:1px;">${escapeHtml(order.order_number)}</div>
          </div>

          <table role="presentation" width="100%" cellspacing="0" cellpadding="0">${rows}</table>

          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:18px;">
            <tr><td style="padding:6px 0;color:#77716a;">Payment</td><td style="padding:6px 0;text-align:right;font-weight:700;">${escapeHtml(order.payment_method || 'Cash on Delivery')}</td></tr>
            <tr><td style="padding:10px 0;font-size:18px;font-weight:700;">Order total</td><td style="padding:10px 0;text-align:right;font-size:18px;font-weight:700;">${money(order.total)}</td></tr>
          </table>

          <div style="margin-top:26px;text-align:center;">
            <a href="https://domaro-eg.com/track.html?order=${encodeURIComponent(order.order_number)}" style="display:inline-block;background:#171615;color:#ffffff;text-decoration:none;padding:13px 22px;font-size:12px;font-weight:700;letter-spacing:1px;">TRACK YOUR ORDER</a>
          </div>
        `
      );

      sends.push(
        sendEmail({
          to: customerEmail,
          subject: `DOMARO order received — ${order.order_number}`,
          html: customerHtml,
          idempotencyKey: `domaro-customer-${order.order_number}`
        })
      );
    }

    const results = await Promise.allSettled(sends);
    const failed = results.filter(result => result.status === 'rejected');

    if (failed.length === results.length) {
      console.error('DOMARO order email failed', failed.map(item => item.reason?.message));
      return res.status(502).json({ error: 'Email delivery failed' });
    }

    if (failed.length) {
      console.warn('DOMARO order email partially failed', failed.map(item => item.reason?.message));
    }

    return res.status(200).json({
      ok: true,
      adminNotification: results[0]?.status === 'fulfilled',
      customerConfirmation: customerEmail ? results[1]?.status === 'fulfilled' : false
    });
  } catch (error) {
    console.error('DOMARO order email error', error);
    return res.status(500).json({ error: 'Could not send order email' });
  }
};
