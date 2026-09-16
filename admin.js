
const { SUPABASE_URL, SUPABASE_KEY } = window.DOMARO_ADMIN_CONFIG;

const loginSection = document.getElementById('admin-login');
const dashboardSection = document.getElementById('admin-dashboard');
const loginForm = document.getElementById('admin-login-form');
const loginError = document.getElementById('login-error');
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const adminUserLabel = document.getElementById('admin-user-label');
const ordersList = document.getElementById('orders-list');
const ordersError = document.getElementById('orders-error');
const ordersLoading = document.getElementById('orders-loading');
const refreshBtn = document.getElementById('refresh-orders');
const searchInput = document.getElementById('order-search');
const statusFilter = document.getElementById('status-filter');

let accessToken = sessionStorage.getItem('domaro_admin_access_token') || '';
let adminEmail = sessionStorage.getItem('domaro_admin_email') || '';
let allOrders = [];
let orderItems = [];

function money(n){
  return Number(n || 0).toLocaleString('en-EG') + ' EGP';
}

function esc(value){
  return String(value ?? '')
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;')
    .replaceAll("'","&#039;");
}

function prettyStatus(s){
  return String(s || '').replace(/_/g,' ').replace(/\b\w/g,m=>m.toUpperCase());
}

function fmtDate(value){
  try{
    return new Intl.DateTimeFormat('en-EG',{
      dateStyle:'medium',
      timeStyle:'short'
    }).format(new Date(value));
  }catch(_){
    return value || '';
  }
}

function authHeaders(){
  return {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
  };
}

async function login(email, password){
  const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method:'POST',
    headers:{
      'apikey': SUPABASE_KEY,
      'Content-Type':'application/json'
    },
    body:JSON.stringify({ email, password })
  });

  const data = await response.json().catch(()=>({}));
  if(!response.ok){
    throw new Error(data?.error_description || data?.msg || data?.message || 'Login failed.');
  }
  if(!data.access_token){
    throw new Error('No access token was returned.');
  }

  accessToken = data.access_token;
  adminEmail = data?.user?.email || email;
  sessionStorage.setItem('domaro_admin_access_token', accessToken);
  sessionStorage.setItem('domaro_admin_email', adminEmail);
}

async function verifyAdminAccess(){
  const response = await fetch(`${SUPABASE_URL}/rest/v1/orders?select=id&limit=1`, {
    headers:authHeaders()
  });

  if(response.status === 401){
    throw new Error('Your session has expired. Please sign in again.');
  }

  if(response.status === 403){
    throw new Error('This account does not have DOMARO admin access.');
  }

  if(!response.ok){
    const data = await response.json().catch(()=>({}));
    throw new Error(data?.message || 'Could not verify admin access.');
  }
  return true;
}

function showDashboard(){
  loginSection.hidden = true;
  dashboardSection.hidden = false;
  logoutBtn.hidden = false;
  adminUserLabel.textContent = adminEmail || 'Admin';
}

function showLogin(message=''){
  dashboardSection.hidden = true;
  loginSection.hidden = false;
  logoutBtn.hidden = true;
  adminUserLabel.textContent = '';
  if(message) loginError.textContent = message;
}

function clearSession(){
  accessToken = '';
  adminEmail = '';
  sessionStorage.removeItem('domaro_admin_access_token');
  sessionStorage.removeItem('domaro_admin_email');
}

async function loadOrders(){
  ordersError.textContent = '';
  ordersLoading.hidden = false;
  refreshBtn.disabled = true;

  try{
    const [ordersRes, itemsRes] = await Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/orders?select=*&order=created_at.desc`, { headers:authHeaders() }),
      fetch(`${SUPABASE_URL}/rest/v1/order_items?select=*&order=created_at.asc`, { headers:authHeaders() })
    ]);

    if(ordersRes.status === 401 || itemsRes.status === 401){
      clearSession();
      showLogin('Your session expired. Please sign in again.');
      return;
    }

    if(ordersRes.status === 403 || itemsRes.status === 403){
      throw new Error('This account does not have permission to view DOMARO orders.');
    }

    const ordersData = await ordersRes.json().catch(()=>[]);
    const itemsData = await itemsRes.json().catch(()=>[]);

    if(!ordersRes.ok) throw new Error(ordersData?.message || 'Could not load orders.');
    if(!itemsRes.ok) throw new Error(itemsData?.message || 'Could not load order items.');

    allOrders = Array.isArray(ordersData) ? ordersData : [];
    orderItems = Array.isArray(itemsData) ? itemsData : [];

    renderStats();
    renderOrders();
  }catch(err){
    ordersError.textContent = err.message || 'Could not load orders.';
  }finally{
    ordersLoading.hidden = true;
    refreshBtn.disabled = false;
  }
}

function renderStats(){
  document.getElementById('stat-all').textContent = allOrders.length;
  document.getElementById('stat-new').textContent = allOrders.filter(o=>o.status==='new').length;
  document.getElementById('stat-confirmed').textContent = allOrders.filter(o=>o.status==='confirmed').length;
  document.getElementById('stat-shipped').textContent = allOrders.filter(o=>o.status==='shipped').length;
  document.getElementById('stat-delivered').textContent = allOrders.filter(o=>o.status==='delivered').length;
}

function filteredOrders(){
  const q = searchInput.value.trim().toLowerCase();
  const status = statusFilter.value;

  return allOrders.filter(o=>{
    const matchesStatus = status === 'all' || o.status === status;
    const haystack = [
      o.order_number,
      o.first_name,
      o.last_name,
      o.phone,
      o.governorate,
      o.area
    ].join(' ').toLowerCase();

    const matchesSearch = !q || haystack.includes(q);
    return matchesStatus && matchesSearch;
  });
}

function renderOrders(){
  const list = filteredOrders();

  if(!list.length){
    ordersList.innerHTML = '<div class="admin-empty">No matching orders.</div>';
    return;
  }

  ordersList.innerHTML = list.map(order=>{
    const items = orderItems.filter(i=>i.order_id === order.id);

    const productsHtml = items.map(i=>`
      <div class="admin-order-item">
        <div>
          <b>${esc(i.product_name)}</b>
          <span>${esc(i.size_ml)} ML · Qty ${esc(i.quantity)}</span>
        </div>
        <strong>${money(i.line_total)}</strong>
      </div>
    `).join('');

    return `
      <article class="admin-order-card" data-order-id="${esc(order.id)}">
        <div class="admin-order-head">
          <div>
            <div class="admin-order-number">${esc(order.order_number)}</div>
            <div class="admin-order-date">${esc(fmtDate(order.created_at))}</div>
          </div>
          <span class="status-badge status-${esc(order.status)}">${esc(prettyStatus(order.status))}</span>
        </div>

        <div class="admin-order-grid">
          <div class="admin-order-section">
            <h3>CUSTOMER</h3>
            <p><b>${esc(order.first_name)} ${esc(order.last_name)}</b></p>
            <p><a href="tel:${esc(order.phone)}">${esc(order.phone)}</a></p>
          </div>

          <div class="admin-order-section">
            <h3>DELIVERY</h3>
            <p>${esc(order.governorate)} · ${esc(order.area)}</p>
            <p>${esc(order.address)}</p>
            ${order.building ? `<p>${esc(order.building)}</p>` : ''}
          </div>

          <div class="admin-order-section">
            <h3>PAYMENT</h3>
            <p>${esc(order.payment_method)}</p>
            <p><b>${money(order.total)}</b></p>
          </div>
        </div>

        <div class="admin-items-block">
          <h3>ITEMS</h3>
          ${productsHtml || '<div class="meta">No items found.</div>'}
        </div>

        <div class="admin-order-totals">
          <span>Subtotal: <b>${money(order.subtotal)}</b></span>
          <span>Shipping: <b>${money(order.shipping)}</b></span>
          <span>Total: <b>${money(order.total)}</b></span>
        </div>

        ${order.notes ? `<div class="admin-note"><b>Customer note:</b> ${esc(order.notes)}</div>` : ''}

        <div class="admin-order-actions">
          <label>
            STATUS
            <select class="order-status-select" data-order-id="${esc(order.id)}" data-current="${esc(order.status)}">
              ${['new','confirmed','shipped','delivered','cancelled'].map(s=>
                `<option value="${s}" ${s===order.status?'selected':''}>${prettyStatus(s)}</option>`
              ).join('')}
            </select>
          </label>
          <button class="admin-save-status" data-order-id="${esc(order.id)}">SAVE STATUS</button>
        </div>
      </article>
    `;
  }).join('');

  document.querySelectorAll('.admin-save-status').forEach(btn=>{
    btn.addEventListener('click', async ()=>{
      const orderId = btn.dataset.orderId;
      const select = document.querySelector(`.order-status-select[data-order-id="${CSS.escape(orderId)}"]`);
      const newStatus = select.value;
      await updateOrderStatus(orderId, newStatus, btn);
    });
  });
}

async function updateOrderStatus(orderId, status, button){
  button.disabled = true;
  const original = button.textContent;
  button.textContent = 'SAVING…';
  ordersError.textContent = '';

  try{
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/update_order_status`, {
      method:'POST',
      headers:authHeaders(),
      body:JSON.stringify({
        p_order_id: orderId,
        p_status: status
      })
    });

    if(response.status === 401){
      clearSession();
      showLogin('Your session expired. Please sign in again.');
      return;
    }

    const data = await response.json().catch(()=>null);
    if(!response.ok){
      throw new Error(data?.message || 'Could not update order status.');
    }

    const target = allOrders.find(o=>o.id===orderId);
    if(target) target.status = status;
    renderStats();
    renderOrders();
  }catch(err){
    ordersError.textContent = err.message || 'Could not update order status.';
    button.disabled = false;
    button.textContent = original;
  }
}

loginForm.addEventListener('submit', async e=>{
  e.preventDefault();
  loginError.textContent = '';
  loginBtn.disabled = true;
  loginBtn.textContent = 'SIGNING IN…';

  const email = document.getElementById('admin-email').value.trim();
  const password = document.getElementById('admin-password').value;

  try{
    await login(email,password);
    await verifyAdminAccess();
    showDashboard();
    await loadOrders();
    document.getElementById('admin-password').value = '';
  }catch(err){
    clearSession();
    loginError.textContent = err.message || 'Login failed.';
  }finally{
    loginBtn.disabled = false;
    loginBtn.textContent = 'SIGN IN';
  }
});

logoutBtn.addEventListener('click', ()=>{
  clearSession();
  allOrders = [];
  orderItems = [];
  ordersList.innerHTML = '';
  showLogin();
});

refreshBtn.addEventListener('click', loadOrders);
searchInput.addEventListener('input', renderOrders);
statusFilter.addEventListener('change', renderOrders);

(async function restoreSession(){
  if(!accessToken) return;
  try{
    await verifyAdminAccess();
    showDashboard();
    await loadOrders();
  }catch(err){
    clearSession();
    showLogin(err.message || 'Please sign in again.');
  }
})();
