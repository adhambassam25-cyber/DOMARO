
const { SUPABASE_URL, SUPABASE_KEY } = window.DOMARO_ADMIN_CONFIG;

const loginSection = document.getElementById('admin-login');
const dashboardSection = document.getElementById('admin-dashboard');
const loginForm = document.getElementById('admin-login-form');
const loginError = document.getElementById('login-error');
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const adminUserLabel = document.getElementById('admin-user-label');
const enableNotificationsBtn = document.getElementById('enable-notifications-btn');

const dashboardPanel = document.getElementById('admin-sales-panel');
const ordersPanel = document.getElementById('admin-orders-panel');
const productsPanel = document.getElementById('admin-products-panel');
const couponsPanel = document.getElementById('admin-coupons-panel');
const adminsPanel = document.getElementById('admin-admins-panel');
const adminsTabBtn = document.getElementById('admins-tab-btn');

const dashboardLoading = document.getElementById('dashboard-loading');
const dashboardError = document.getElementById('dashboard-error');
const refreshDashboardBtn = document.getElementById('refresh-dashboard');
const dashboardBestProducts = document.getElementById('dashboard-best-products');
const dashboardRecentOrders = document.getElementById('dashboard-recent-orders');

const ordersList = document.getElementById('orders-list');
const ordersError = document.getElementById('orders-error');
const ordersLoading = document.getElementById('orders-loading');
const refreshBtn = document.getElementById('refresh-orders');
const searchInput = document.getElementById('order-search');
const statusFilter = document.getElementById('status-filter');

const productsList = document.getElementById('products-list');
const productsError = document.getElementById('products-error');
const productsLoading = document.getElementById('products-loading');
const productSearch = document.getElementById('product-search');
const productFilter = document.getElementById('product-filter');
const newProductBtn = document.getElementById('new-product-btn');

const couponsList = document.getElementById('coupons-list');
const couponsError = document.getElementById('coupons-error');
const couponsLoading = document.getElementById('coupons-loading');
const couponSearch = document.getElementById('coupon-search');
const couponFilter = document.getElementById('coupon-filter');
const newCouponBtn = document.getElementById('new-coupon-btn');
const couponModal = document.getElementById('coupon-modal');
const couponForm = document.getElementById('coupon-form');
const couponFormTitle = document.getElementById('coupon-form-title');
const couponFormError = document.getElementById('coupon-form-error');
const saveCouponBtn = document.getElementById('save-coupon-btn');

const adminsList = document.getElementById('admins-list');
const adminsError = document.getElementById('admins-error');
const adminsLoading = document.getElementById('admins-loading');
const newAdminBtn = document.getElementById('new-admin-btn');
const adminUserModal = document.getElementById('admin-user-modal');
const adminUserForm = document.getElementById('admin-user-form');
const adminUserFormTitle = document.getElementById('admin-user-form-title');
const adminUserFormError = document.getElementById('admin-user-form-error');
const saveAdminUserBtn = document.getElementById('save-admin-user-btn');

const productModal = document.getElementById('product-modal');
const productForm = document.getElementById('product-form');
const productFormTitle = document.getElementById('product-form-title');
const productFormError = document.getElementById('product-form-error');
const saveProductBtn = document.getElementById('save-product-btn');
const imageInput = document.getElementById('product-image');
const imagePreview = document.getElementById('product-image-preview');

let accessToken = sessionStorage.getItem('domaro_admin_access_token') || '';
let adminEmail = sessionStorage.getItem('domaro_admin_email') || '';
let allOrders = [];
let orderItems = [];
let allProducts = [];
let allCoupons = [];
let allAdmins = [];
let dashboardStats = null;
let adminProfile = null;
let editingProduct = null;
let editingCoupon = null;
let editingManagedAdmin = null;
let notificationPollTimer = null;
let lastKnownOrderCreatedAt = localStorage.getItem('domaro_last_known_order_created_at') || '';

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
    return new Intl.DateTimeFormat('en-EG',{dateStyle:'medium',timeStyle:'short'}).format(new Date(value));
  }catch(_){ return value || ''; }
}
function authHeaders(extra={}){
  return {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${accessToken}`,
    ...extra
  };
}
function slugify(value){
  const base = String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g,'')
    .replace(/[^a-z0-9]+/g,'-')
    .replace(/^-+|-+$/g,'')
    .slice(0,50);
  return base || `product-${Date.now()}`;
}

async function login(email, password){
  const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method:'POST',
    headers:{'apikey':SUPABASE_KEY,'Content-Type':'application/json'},
    body:JSON.stringify({email,password})
  });
  const data=await response.json().catch(()=>({}));
  if(!response.ok) throw new Error(data?.error_description || data?.msg || data?.message || 'Login failed.');
  if(!data.access_token) throw new Error('No access token was returned.');
  accessToken=data.access_token;
  adminEmail=data?.user?.email || email;
  sessionStorage.setItem('domaro_admin_access_token',accessToken);
  sessionStorage.setItem('domaro_admin_email',adminEmail);
}

async function verifyAdminAccess(){
  const response=await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_my_admin_profile`,{
    method:'POST',
    headers:authHeaders({'Content-Type':'application/json'}),
    body:'{}'
  });

  const data=await response.json().catch(()=>null);

  if(response.status===401) throw new Error('Your session has expired. Please sign in again.');
  if(!response.ok) throw new Error(data?.message || 'Could not verify admin access.');
  if(!data || data.active===false) throw new Error('This account does not have active DOMARO admin access.');

  adminProfile=data;
  return data;
}

function hasPermission(permission){
  if(!adminProfile || adminProfile.active===false) return false;
  if(adminProfile.role==='owner') return true;

  const key={
    dashboard:'can_dashboard',
    orders:'can_orders',
    products:'can_products',
    coupons:'can_coupons',
    admins:'can_manage_admins'
  }[permission];

  return key ? Boolean(adminProfile[key]) : false;
}

function allowedTabs(){
  return ['dashboard','orders','products','coupons','admins']
    .filter(tab=>hasPermission(tab));
}

function applyAdminPermissions(){
  const map={
    dashboard:'dashboard',
    orders:'orders',
    products:'products',
    coupons:'coupons',
    admins:'admins'
  };

  document.querySelectorAll('.admin-tab').forEach(btn=>{
    const permission=map[btn.dataset.adminTab];
    btn.hidden=!hasPermission(permission);
  });

  if(adminsTabBtn) adminsTabBtn.hidden=adminProfile?.role!=='owner';
  enableNotificationsBtn.hidden=!hasPermission('orders');

  const roleText=adminProfile?.role==='owner' ? 'OWNER' : 'ADMIN';
  adminUserLabel.textContent=`${adminProfile?.email || adminEmail || 'Admin'} · ${roleText}`;
}

function showDashboard(){
  loginSection.hidden=true;
  dashboardSection.hidden=false;
  logoutBtn.hidden=false;
  applyAdminPermissions();
  updateNotificationButton();

  const tabs=allowedTabs();
  if(!tabs.length){
    document.querySelectorAll('.admin-panel').forEach(panel=>panel.hidden=true);
    return;
  }

  setTab(tabs[0]);
}

function showLogin(message=''){
  dashboardSection.hidden=true;
  loginSection.hidden=false;
  logoutBtn.hidden=true;
  enableNotificationsBtn.hidden=true;
  stopOrderNotificationPolling();
  adminUserLabel.textContent='';
  adminProfile=null;
  if(message) loginError.textContent=message;
}

function clearSession(){
  accessToken='';
  adminEmail='';
  adminProfile=null;
  sessionStorage.removeItem('domaro_admin_access_token');
  sessionStorage.removeItem('domaro_admin_email');
}

function setTab(tab){
  if(!hasPermission(tab)) return;

  document.querySelectorAll('.admin-tab').forEach(btn=>btn.classList.toggle('active',btn.dataset.adminTab===tab));
  dashboardPanel.hidden = tab!=='dashboard';
  ordersPanel.hidden = tab!=='orders';
  productsPanel.hidden = tab!=='products';
  couponsPanel.hidden = tab!=='coupons';
  if(adminsPanel) adminsPanel.hidden = tab!=='admins';

  if(tab==='dashboard' && !dashboardStats) loadDashboardStats();
  if(tab==='orders' && !allOrders.length) loadOrders();
  if(tab==='products' && !allProducts.length) loadProducts();
  if(tab==='coupons' && !allCoupons.length) loadCoupons();
  if(tab==='admins' && !allAdmins.length) loadAdmins();
}

document.querySelectorAll('.admin-tab').forEach(btn=>{
  btn.addEventListener('click',()=>setTab(btn.dataset.adminTab));
});

async function loadDashboardStats(){
  dashboardError.textContent='';
  dashboardLoading.hidden=false;
  refreshDashboardBtn.disabled=true;
  try{
    const response=await fetch(`${SUPABASE_URL}/rest/v1/rpc/admin_dashboard_stats`,{
      method:'POST',
      headers:authHeaders({'Content-Type':'application/json'}),
      body:'{}'
    });
    const data=await response.json().catch(()=>null);
    if(response.status===401){clearSession();showLogin('Your session expired. Please sign in again.');return;}
    if(response.status===403) throw new Error('This account does not have permission to view dashboard statistics.');
    if(!response.ok) throw new Error(data?.message || 'Could not load dashboard statistics.');
    dashboardStats=data || {};
    renderDashboardStats();
  }catch(err){
    dashboardError.textContent=err.message || 'Could not load dashboard statistics.';
  }finally{
    dashboardLoading.hidden=true;
    refreshDashboardBtn.disabled=false;
  }
}

function renderDashboardStats(){
  const d=dashboardStats || {};
  document.getElementById('dashboard-total-sales').textContent=money(d.total_sales);
  document.getElementById('dashboard-total-orders').textContent=Number(d.total_orders || 0).toLocaleString('en-EG');
  document.getElementById('dashboard-delivered-orders').textContent=Number(d.delivered_orders || 0).toLocaleString('en-EG');
  document.getElementById('dashboard-cancelled-orders').textContent=Number(d.cancelled_orders || 0).toLocaleString('en-EG');
  document.getElementById('dashboard-new-orders').textContent=Number(d.new_orders || 0).toLocaleString('en-EG');
  document.getElementById('dashboard-confirmed-orders').textContent=Number(d.confirmed_orders || 0).toLocaleString('en-EG');
  document.getElementById('dashboard-shipped-orders').textContent=Number(d.shipped_orders || 0).toLocaleString('en-EG');
  document.getElementById('dashboard-status-delivered').textContent=Number(d.delivered_orders || 0).toLocaleString('en-EG');

  const products=Array.isArray(d.best_selling_products)?d.best_selling_products:[];
  dashboardBestProducts.innerHTML=products.length?products.map((p,index)=>`
    <div class="sales-rank-row">
      <span class="sales-rank-number">${index+1}</span>
      <div class="sales-rank-product">
        <b>${esc(p.product_name)}</b>
        <span>${esc(p.size_ml)} ML · ${Number(p.quantity_sold || 0).toLocaleString('en-EG')} sold</span>
      </div>
      <strong>${money(p.sales)}</strong>
    </div>`).join(''):'<div class="admin-empty compact">No sales data yet.</div>';

  const recent=Array.isArray(d.recent_orders)?d.recent_orders:[];
  dashboardRecentOrders.innerHTML=recent.length?recent.map(o=>`
    <div class="sales-recent-row">
      <div>
        <b>${esc(o.order_number)}</b>
        <span>${esc(o.customer_name)} · ${esc(fmtDate(o.created_at))}</span>
      </div>
      <div class="sales-recent-value">
        <strong>${money(o.total)}</strong>
        <span class="status-badge status-${esc(o.status)}">${esc(prettyStatus(o.status))}</span>
      </div>
    </div>`).join(''):'<div class="admin-empty compact">No orders yet.</div>';
}

async function loadOrders(){
  ordersError.textContent='';
  ordersLoading.hidden=false;
  refreshBtn.disabled=true;
  try{
    const [ordersRes,itemsRes]=await Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/orders?select=*&order=created_at.desc`,{headers:authHeaders()}),
      fetch(`${SUPABASE_URL}/rest/v1/order_items?select=*&order=created_at.asc`,{headers:authHeaders()})
    ]);
    if(ordersRes.status===401 || itemsRes.status===401){
      clearSession(); showLogin('Your session expired. Please sign in again.'); return;
    }
    if(ordersRes.status===403 || itemsRes.status===403) throw new Error('This account does not have permission to view DOMARO orders.');

    const ordersData=await ordersRes.json().catch(()=>[]);
    const itemsData=await itemsRes.json().catch(()=>[]);
    if(!ordersRes.ok) throw new Error(ordersData?.message || 'Could not load orders.');
    if(!itemsRes.ok) throw new Error(itemsData?.message || 'Could not load order items.');

    allOrders=Array.isArray(ordersData)?ordersData:[];
    orderItems=Array.isArray(itemsData)?itemsData:[];
    renderStats();
    renderOrders();
  }catch(err){
    ordersError.textContent=err.message || 'Could not load orders.';
  }finally{
    ordersLoading.hidden=true;
    refreshBtn.disabled=false;
  }
}

function renderStats(){
  document.getElementById('stat-all').textContent=allOrders.length;
  document.getElementById('stat-new').textContent=allOrders.filter(o=>o.status==='new').length;
  document.getElementById('stat-confirmed').textContent=allOrders.filter(o=>o.status==='confirmed').length;
  document.getElementById('stat-shipped').textContent=allOrders.filter(o=>o.status==='shipped').length;
  document.getElementById('stat-delivered').textContent=allOrders.filter(o=>o.status==='delivered').length;
}
function filteredOrders(){
  const q=searchInput.value.trim().toLowerCase();
  const status=statusFilter.value;
  return allOrders.filter(o=>{
    const matchesStatus=status==='all' || o.status===status;
    const haystack=[o.order_number,o.first_name,o.last_name,o.phone,o.governorate,o.area].join(' ').toLowerCase();
    return matchesStatus && (!q || haystack.includes(q));
  });
}
function renderOrders(){
  const list=filteredOrders();
  if(!list.length){
    ordersList.innerHTML='<div class="admin-empty">No matching orders.</div>';
    return;
  }
  ordersList.innerHTML=list.map(order=>{
    const items=orderItems.filter(i=>i.order_id===order.id);
    const productsHtml=items.map(i=>`
      <div class="admin-order-item">
        <div><b>${esc(i.product_name)}</b><span>${esc(i.size_ml)} ML · Qty ${esc(i.quantity)}</span></div>
        <strong>${money(i.line_total)}</strong>
      </div>`).join('');

    return `<article class="admin-order-card" data-order-id="${esc(order.id)}">
      <div class="admin-order-head">
        <div><div class="admin-order-number">${esc(order.order_number)}</div><div class="admin-order-date">${esc(fmtDate(order.created_at))}</div></div>
        <span class="status-badge status-${esc(order.status)}">${esc(prettyStatus(order.status))}</span>
      </div>
      <div class="admin-order-grid">
        <div class="admin-order-section"><h3>CUSTOMER</h3><p><b>${esc(order.first_name)} ${esc(order.last_name)}</b></p><p><a href="tel:${esc(order.phone)}">${esc(order.phone)}</a></p></div>
        <div class="admin-order-section"><h3>DELIVERY</h3><p>${esc(order.governorate)} · ${esc(order.area)}</p><p>${esc(order.address)}</p>${order.building?`<p>${esc(order.building)}</p>`:''}</div>
        <div class="admin-order-section"><h3>PAYMENT</h3><p>${esc(order.payment_method)}</p><p><b>${money(order.total)}</b></p></div>
      </div>
      <div class="admin-items-block"><h3>ITEMS</h3>${productsHtml || '<div class="meta">No items found.</div>'}</div>
      <div class="admin-order-totals"><span>Subtotal: <b>${money(order.subtotal)}</b></span>${Number(order.discount||0)>0?`<span>Discount${order.coupon_code?` (${esc(order.coupon_code)})`:''}: <b>− ${money(order.discount)}</b></span>`:''}<span>Shipping: <b>${money(order.shipping)}</b></span><span>Total: <b>${money(order.total)}</b></span></div>
      ${order.notes?`<div class="admin-note"><b>Customer note:</b> ${esc(order.notes)}</div>`:''}
      <div class="admin-order-actions">
        <label>STATUS
          <select class="order-status-select" data-order-id="${esc(order.id)}">
            ${['new','confirmed','shipped','delivered','cancelled'].map(s=>`<option value="${s}" ${s===order.status?'selected':''}>${prettyStatus(s)}</option>`).join('')}
          </select>
        </label>
        <button class="admin-save-status" data-order-id="${esc(order.id)}">SAVE STATUS</button>
      </div>
    </article>`;
  }).join('');

  document.querySelectorAll('.admin-save-status').forEach(btn=>{
    btn.addEventListener('click',async()=>{
      const orderId=btn.dataset.orderId;
      const select=document.querySelector(`.order-status-select[data-order-id="${CSS.escape(orderId)}"]`);
      await updateOrderStatus(orderId,select.value,btn);
    });
  });
}

async function updateOrderStatus(orderId,status,button){
  button.disabled=true;
  const original=button.textContent;
  button.textContent='SAVING…';
  ordersError.textContent='';
  try{
    const response=await fetch(`${SUPABASE_URL}/rest/v1/rpc/update_order_status`,{
      method:'POST',
      headers:authHeaders({'Content-Type':'application/json'}),
      body:JSON.stringify({p_order_id:orderId,p_status:status})
    });
    if(response.status===401){clearSession();showLogin('Your session expired. Please sign in again.');return;}
    const data=await response.json().catch(()=>null);
    if(!response.ok) throw new Error(data?.message || 'Could not update order status.');
    const target=allOrders.find(o=>o.id===orderId);
    if(target) target.status=status;
    renderStats(); renderOrders();
    loadDashboardStats();
  }catch(err){
    ordersError.textContent=err.message || 'Could not update order status.';
    button.disabled=false; button.textContent=original;
  }
}

// ---------- PRODUCT MANAGEMENT ----------
async function loadProducts(){
  productsError.textContent='';
  productsLoading.hidden=false;
  try{
    const response=await fetch(
      `${SUPABASE_URL}/rest/v1/products?select=*&order=created_at.asc`,
      {headers:authHeaders()}
    );
    const data=await response.json().catch(()=>[]);
    if(response.status===401){clearSession();showLogin('Your session expired. Please sign in again.');return;}
    if(!response.ok) throw new Error(data?.message || 'Could not load products.');
    allProducts=Array.isArray(data)?data:[];
    renderProductStats();
    renderProductsAdmin();
  }catch(err){
    productsError.textContent=err.message || 'Could not load products.';
  }finally{
    productsLoading.hidden=true;
  }
}

function renderProductStats(){
  document.getElementById('product-stat-all').textContent=allProducts.length;
  document.getElementById('product-stat-live').textContent=allProducts.filter(p=>p.active).length;
  document.getElementById('product-stat-stock').textContent=allProducts.filter(p=>p.in_stock).length;
  document.getElementById('product-stat-out').textContent=allProducts.filter(p=>!p.in_stock).length;
}

function filteredProducts(){
  const q=productSearch.value.trim().toLowerCase();
  const filter=productFilter.value;
  return allProducts.filter(p=>{
    const matchesSearch=!q || [p.name,p.id,p.category,p.brand].join(' ').toLowerCase().includes(q);
    const matchesFilter=
      filter==='all' ||
      (filter==='live' && p.active) ||
      (filter==='hidden' && !p.active) ||
      (filter==='stock' && p.in_stock) ||
      (filter==='out' && !p.in_stock);
    return matchesSearch && matchesFilter;
  });
}

function renderProductsAdmin(){
  const list=filteredProducts();
  if(!list.length){
    productsList.innerHTML='<div class="admin-empty">No matching products.</div>';
    return;
  }

  productsList.innerHTML=list.map(p=>`
    <article class="admin-product-card">
      <div class="admin-product-image"><img src="${esc(p.image_path || 'assets/hero.svg')}" alt="${esc(p.name)}"></div>
      <div class="admin-product-main">
        <div class="admin-product-title-row">
          <div><h3>${esc(p.name)}</h3><span>${p.brand?`${esc(String(p.brand).toUpperCase())} · `:''}${esc(String(p.category).toUpperCase())} · ${esc(p.size_ml)} ML</span></div>
          <div class="admin-product-badges">
            <span class="mini-status ${p.active?'mini-live':'mini-hidden'}">${p.active?'LIVE':'HIDDEN'}</span>
            <span class="mini-status ${p.in_stock?'mini-stock':'mini-out'}">${p.in_stock?'IN STOCK':'OUT OF STOCK'}</span>
          </div>
        </div>
        <div class="admin-product-price">${money(p.price)}</div>
        <div class="admin-stock-qty">${p.stock_quantity === null ? 'STOCK: NOT TRACKED' : `STOCK: ${esc(p.stock_quantity)} UNIT${Number(p.stock_quantity)===1?'':'S'}`}</div>
        <p>${esc(p.description || 'No description yet.')}</p>
        <div class="admin-product-actions">
          <button class="admin-secondary-btn edit-product-btn" data-id="${esc(p.id)}">EDIT</button>
          <button class="admin-secondary-btn quick-stock-btn" data-id="${esc(p.id)}">${p.in_stock?'MARK OUT OF STOCK':'MARK IN STOCK'}</button>
          <button class="admin-secondary-btn quick-live-btn" data-id="${esc(p.id)}">${p.active?'HIDE':'MAKE LIVE'}</button>
        </div>
      </div>
    </article>
  `).join('');

  document.querySelectorAll('.edit-product-btn').forEach(btn=>btn.addEventListener('click',()=>openProductModal(allProducts.find(p=>p.id===btn.dataset.id))));
  document.querySelectorAll('.quick-stock-btn').forEach(btn=>btn.addEventListener('click',()=>{
    const p=allProducts.find(x=>x.id===btn.dataset.id);
    if(!p) return;
    if(p.stock_quantity !== null && Number(p.stock_quantity) === 0){
      productsError.textContent='Stock is tracked at 0. Edit the product and enter a quantity first.';
      openProductModal(p);
      return;
    }
    quickUpdateProduct(btn.dataset.id,'in_stock');
  }));
  document.querySelectorAll('.quick-live-btn').forEach(btn=>btn.addEventListener('click',()=>quickUpdateProduct(btn.dataset.id,'active')));
}

async function quickUpdateProduct(id,field){
  const p=allProducts.find(x=>x.id===id);
  if(!p) return;
  const value=!p[field];
  productsError.textContent='';
  try{
    const response=await fetch(`${SUPABASE_URL}/rest/v1/products?id=eq.${encodeURIComponent(id)}`,{
      method:'PATCH',
      headers:authHeaders({'Content-Type':'application/json','Prefer':'return=representation'}),
      body:JSON.stringify({[field]:value,updated_at:new Date().toISOString()})
    });
    const data=await response.json().catch(()=>[]);
    if(!response.ok) throw new Error(data?.message || 'Could not update product.');
    Object.assign(p,data?.[0] || {[field]:value});
    renderProductStats();
    renderProductsAdmin();
  }catch(err){
    productsError.textContent=err.message || 'Could not update product.';
  }
}

function openProductModal(product=null){
  editingProduct=product || null;
  productForm.reset();
  productFormError.textContent='';
  imageInput.value='';
  imagePreview.src=product?.image_path || 'assets/hero.svg';

  document.getElementById('product-id').value=product?.id || '';
  document.getElementById('product-name').value=product?.name || '';
  document.getElementById('product-brand').value=product?.brand || '';
  document.getElementById('product-category').value=product?.category || 'men';
  document.getElementById('product-size').value=product?.size_ml || 200;
  document.getElementById('product-price').value=product?.price || 2000;
  document.getElementById('product-description').value=product?.description || '';
  document.getElementById('product-story').value=product?.story || '';
  document.getElementById('product-top-notes').value=product?.top_notes || '';
  document.getElementById('product-heart-notes').value=product?.heart_notes || '';
  document.getElementById('product-base-notes').value=product?.base_notes || '';
  document.getElementById('product-stock-quantity').value=product?.stock_quantity ?? '';
  document.getElementById('product-stock').checked=product ? Boolean(product.in_stock) : true;
  document.getElementById('product-active').checked=product ? Boolean(product.active) : true;

  productFormTitle.textContent=product ? 'EDIT PRODUCT' : 'ADD PRODUCT';
  productModal.hidden=false;
  document.body.classList.add('modal-open');
}

function closeProductModal(){
  productModal.hidden=true;
  document.body.classList.remove('modal-open');
  editingProduct=null;
}

document.querySelectorAll('[data-close-product-modal]').forEach(el=>el.addEventListener('click',closeProductModal));
newProductBtn.addEventListener('click',()=>openProductModal());

imageInput.addEventListener('change',()=>{
  const file=imageInput.files?.[0];
  if(!file) return;
  if(file.size>5*1024*1024){
    productFormError.textContent='Image is too large. Maximum size is 5 MB.';
    imageInput.value='';
    return;
  }
  imagePreview.src=URL.createObjectURL(file);
});

async function uploadProductImage(productId,file){
  const safeName=String(file.name || 'image.jpg').toLowerCase().replace(/[^a-z0-9.]+/g,'-');
  const objectName=`${productId}/${Date.now()}-${safeName}`;
  const response=await fetch(`${SUPABASE_URL}/storage/v1/object/products/${objectName.split('/').map(encodeURIComponent).join('/')}`,{
    method:'POST',
    headers:authHeaders({
      'Content-Type':file.type || 'application/octet-stream',
      'x-upsert':'true'
    }),
    body:file
  });
  const data=await response.json().catch(()=>({}));
  if(!response.ok) throw new Error(data?.message || data?.error || 'Could not upload image.');
  return `${SUPABASE_URL}/storage/v1/object/public/products/${objectName.split('/').map(encodeURIComponent).join('/')}`;
}

productForm.addEventListener('submit',async e=>{
  e.preventDefault();
  productFormError.textContent='';

  const name=document.getElementById('product-name').value.trim();
  const brand=document.getElementById('product-brand').value.trim();
  const category=document.getElementById('product-category').value;
  const size_ml=Number(document.getElementById('product-size').value);
  const price=Number(document.getElementById('product-price').value);
  const description=document.getElementById('product-description').value.trim();
  const story=document.getElementById('product-story').value.trim();
  const top_notes=document.getElementById('product-top-notes').value.trim();
  const heart_notes=document.getElementById('product-heart-notes').value.trim();
  const base_notes=document.getElementById('product-base-notes').value.trim();
  const stockRaw=document.getElementById('product-stock-quantity').value.trim();
  const stock_quantity=stockRaw==='' ? null : Number(stockRaw);
  let in_stock=document.getElementById('product-stock').checked;
  const active=document.getElementById('product-active').checked;

  if(stock_quantity !== null){
    if(!Number.isInteger(stock_quantity) || stock_quantity < 0){
      productFormError.textContent='Stock quantity must be a whole number of 0 or more.';
      return;
    }
    in_stock = stock_quantity > 0;
  }
  const file=imageInput.files?.[0];

  if(!name || !size_ml || price<0){
    productFormError.textContent='Please complete the required product information.';
    return;
  }
  if(!editingProduct && !file){
    productFormError.textContent='Please choose a product image.';
    return;
  }

  saveProductBtn.disabled=true;
  const oldText=saveProductBtn.textContent;
  saveProductBtn.textContent='SAVING…';

  try{
    let id=editingProduct?.id || slugify(name);
    if(!editingProduct && allProducts.some(p=>p.id===id)){
      id=`${id}-${String(Date.now()).slice(-4)}`;
    }

    let image_path=editingProduct?.image_path || '';
    if(file) image_path=await uploadProductImage(id,file);

    const payload={
      name,
      brand:brand || null,
      category,
      size_ml,
      price,
      description,
      story:story || null,
      top_notes:top_notes || null,
      heart_notes:heart_notes || null,
      base_notes:base_notes || null,
      stock_quantity,
      in_stock,
      active,
      image_path,
      updated_at:new Date().toISOString()
    };

    let response;
    if(editingProduct){
      response=await fetch(`${SUPABASE_URL}/rest/v1/products?id=eq.${encodeURIComponent(id)}`,{
        method:'PATCH',
        headers:authHeaders({'Content-Type':'application/json','Prefer':'return=representation'}),
        body:JSON.stringify(payload)
      });
    }else{
      response=await fetch(`${SUPABASE_URL}/rest/v1/products`,{
        method:'POST',
        headers:authHeaders({'Content-Type':'application/json','Prefer':'return=representation'}),
        body:JSON.stringify({id,...payload})
      });
    }

    const data=await response.json().catch(()=>[]);
    if(!response.ok) throw new Error(data?.message || data?.details || 'Could not save product.');

    closeProductModal();
    await loadProducts();
  }catch(err){
    productFormError.textContent=err.message || 'Could not save product.';
  }finally{
    saveProductBtn.disabled=false;
    saveProductBtn.textContent=oldText;
  }
});



// DOMARO v11 — coupon management
function couponIsExpired(coupon){
  return Boolean(coupon.expires_at) && new Date(coupon.expires_at).getTime() < Date.now();
}
function couponDiscountLabel(coupon){
  return coupon.discount_type==='percent'
    ? `${Number(coupon.discount_value)}% OFF`
    : `${money(coupon.discount_value)} OFF`;
}
function couponExpiryLabel(value){
  if(!value) return 'NO EXPIRY';
  return fmtDate(value);
}

async function loadCoupons(){
  couponsError.textContent='';
  couponsLoading.hidden=false;
  try{
    const response=await fetch(`${SUPABASE_URL}/rest/v1/coupons?select=*&order=created_at.desc`,{headers:authHeaders()});
    const data=await response.json().catch(()=>[]);
    if(response.status===401){clearSession();showLogin('Your session expired. Please sign in again.');return;}
    if(response.status===403) throw new Error('This account does not have permission to view coupons.');
    if(!response.ok) throw new Error(data?.message || 'Could not load coupons.');
    allCoupons=Array.isArray(data)?data:[];
    renderCouponStats();
    renderCouponsAdmin();
  }catch(err){
    couponsError.textContent=err.message || 'Could not load coupons.';
  }finally{
    couponsLoading.hidden=true;
  }
}

function renderCouponStats(){
  document.getElementById('coupon-stat-all').textContent=allCoupons.length;
  document.getElementById('coupon-stat-active').textContent=allCoupons.filter(c=>c.active && !couponIsExpired(c)).length;
  document.getElementById('coupon-stat-expired').textContent=allCoupons.filter(c=>couponIsExpired(c)).length;
  document.getElementById('coupon-stat-used').textContent=allCoupons.reduce((sum,c)=>sum+Number(c.used_count||0),0);
}

function filteredCoupons(){
  const q=(couponSearch?.value || '').trim().toLowerCase();
  const filter=couponFilter?.value || 'all';
  return allCoupons.filter(c=>{
    const expired=couponIsExpired(c);
    let matches=true;
    if(filter==='active') matches=Boolean(c.active) && !expired;
    if(filter==='inactive') matches=!c.active;
    if(filter==='expired') matches=expired;
    return matches && (!q || String(c.code||'').toLowerCase().includes(q));
  });
}

function renderCouponsAdmin(){
  const list=filteredCoupons();
  if(!list.length){
    couponsList.innerHTML='<div class="admin-empty">No matching coupons.</div>';
    return;
  }
  couponsList.innerHTML=list.map(c=>{
    const expired=couponIsExpired(c);
    const status=expired ? 'EXPIRED' : (c.active ? 'ACTIVE' : 'INACTIVE');
    const statusClass=expired || !c.active ? 'mini-out' : 'mini-live';
    const usage=c.usage_limit===null ? `${Number(c.used_count||0)} uses` : `${Number(c.used_count||0)} / ${Number(c.usage_limit)} uses`;
    return `<article class="admin-coupon-card">
      <div class="admin-coupon-code">${esc(c.code)}</div>
      <div class="admin-coupon-main">
        <div class="admin-coupon-title-row">
          <div><strong>${esc(couponDiscountLabel(c))}</strong><span>MINIMUM ORDER: ${money(c.min_order_amount)}</span></div>
          <span class="mini-status ${statusClass}">${status}</span>
        </div>
        <div class="admin-coupon-meta">
          <span>${esc(usage)}</span>
          <span>EXPIRES: ${esc(couponExpiryLabel(c.expires_at))}</span>
        </div>
        <div class="admin-product-actions">
          <button class="admin-secondary-btn edit-coupon-btn" data-id="${esc(c.id)}">EDIT</button>
          <button class="admin-secondary-btn toggle-coupon-btn" data-id="${esc(c.id)}">${c.active?'DEACTIVATE':'ACTIVATE'}</button>
          <button class="admin-secondary-btn delete-coupon-btn" data-id="${esc(c.id)}">DELETE</button>
        </div>
      </div>
    </article>`;
  }).join('');

  document.querySelectorAll('.edit-coupon-btn').forEach(btn=>btn.addEventListener('click',()=>openCouponModal(allCoupons.find(c=>c.id===btn.dataset.id))));
  document.querySelectorAll('.toggle-coupon-btn').forEach(btn=>btn.addEventListener('click',()=>toggleCoupon(btn.dataset.id,btn)));
  document.querySelectorAll('.delete-coupon-btn').forEach(btn=>btn.addEventListener('click',()=>deleteCoupon(btn.dataset.id,btn)));
}

function toDatetimeLocal(value){
  if(!value) return '';
  const d=new Date(value);
  if(Number.isNaN(d.getTime())) return '';
  const pad=n=>String(n).padStart(2,'0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function openCouponModal(coupon=null){
  editingCoupon=coupon || null;
  couponForm.reset();
  couponFormError.textContent='';
  document.getElementById('coupon-id').value=coupon?.id || '';
  document.getElementById('admin-coupon-code').value=coupon?.code || '';
  document.getElementById('coupon-type').value=coupon?.discount_type || 'percent';
  document.getElementById('coupon-value').value=coupon?.discount_value ?? '';
  document.getElementById('coupon-min-order').value=coupon?.min_order_amount ?? 0;
  document.getElementById('coupon-usage-limit').value=coupon?.usage_limit ?? '';
  document.getElementById('coupon-expiry').value=toDatetimeLocal(coupon?.expires_at);
  document.getElementById('coupon-active').checked=coupon ? Boolean(coupon.active) : true;
  couponFormTitle.textContent=coupon ? 'EDIT COUPON' : 'ADD COUPON';
  couponModal.hidden=false;
  document.body.classList.add('modal-open');
}
function closeCouponModal(){
  couponModal.hidden=true;
  document.body.classList.remove('modal-open');
  editingCoupon=null;
}

async function saveCoupon(event){
  event.preventDefault();
  couponFormError.textContent='';
  const code=document.getElementById('admin-coupon-code').value.trim().toUpperCase();
  const type=document.getElementById('coupon-type').value;
  const value=Number(document.getElementById('coupon-value').value);
  const minOrder=Number(document.getElementById('coupon-min-order').value || 0);
  const usageRaw=document.getElementById('coupon-usage-limit').value.trim();
  const expiryRaw=document.getElementById('coupon-expiry').value;
  const active=document.getElementById('coupon-active').checked;

  if(!code){couponFormError.textContent='Coupon code is required.';return;}
  if(!(value>0)){couponFormError.textContent='Discount value must be greater than zero.';return;}
  if(type==='percent' && value>100){couponFormError.textContent='Percentage discount cannot exceed 100%.';return;}

  const payload={
    code,
    discount_type:type,
    discount_value:value,
    min_order_amount:Math.max(0,minOrder),
    usage_limit:usageRaw ? Number(usageRaw) : null,
    expires_at:expiryRaw ? new Date(expiryRaw).toISOString() : null,
    active,
    updated_at:new Date().toISOString()
  };

  saveCouponBtn.disabled=true;
  saveCouponBtn.textContent='SAVING…';
  try{
    const editingId=editingCoupon?.id;
    const url=editingId
      ? `${SUPABASE_URL}/rest/v1/coupons?id=eq.${encodeURIComponent(editingId)}`
      : `${SUPABASE_URL}/rest/v1/coupons`;
    const response=await fetch(url,{
      method:editingId?'PATCH':'POST',
      headers:authHeaders({'Content-Type':'application/json','Prefer':'return=representation'}),
      body:JSON.stringify(payload)
    });
    const data=await response.json().catch(()=>null);
    if(response.status===401){clearSession();showLogin('Your session expired. Please sign in again.');closeCouponModal();return;}
    if(!response.ok) throw new Error(data?.message || data?.details || 'Could not save coupon.');
    closeCouponModal();
    await loadCoupons();
  }catch(err){
    couponFormError.textContent=err.message || 'Could not save coupon.';
  }finally{
    saveCouponBtn.disabled=false;
    saveCouponBtn.textContent='SAVE COUPON';
  }
}

async function toggleCoupon(id,button){
  const coupon=allCoupons.find(c=>c.id===id);
  if(!coupon) return;
  button.disabled=true;
  try{
    const response=await fetch(`${SUPABASE_URL}/rest/v1/coupons?id=eq.${encodeURIComponent(id)}`,{
      method:'PATCH',
      headers:authHeaders({'Content-Type':'application/json','Prefer':'return=minimal'}),
      body:JSON.stringify({active:!coupon.active,updated_at:new Date().toISOString()})
    });
    if(!response.ok){const data=await response.json().catch(()=>({}));throw new Error(data?.message || 'Could not update coupon.');}
    coupon.active=!coupon.active;
    renderCouponStats();renderCouponsAdmin();
  }catch(err){couponsError.textContent=err.message || 'Could not update coupon.';}
  finally{button.disabled=false;}
}

async function deleteCoupon(id,button){
  const coupon=allCoupons.find(c=>c.id===id);
  if(!coupon) return;
  if(!confirm(`Delete coupon ${coupon.code}?`)) return;
  button.disabled=true;
  try{
    const response=await fetch(`${SUPABASE_URL}/rest/v1/coupons?id=eq.${encodeURIComponent(id)}`,{method:'DELETE',headers:authHeaders({'Prefer':'return=minimal'})});
    if(!response.ok){const data=await response.json().catch(()=>({}));throw new Error(data?.message || 'Could not delete coupon.');}
    allCoupons=allCoupons.filter(c=>c.id!==id);
    renderCouponStats();renderCouponsAdmin();
  }catch(err){couponsError.textContent=err.message || 'Could not delete coupon.';}
  finally{button.disabled=false;}
}

if(newCouponBtn) newCouponBtn.addEventListener('click',()=>openCouponModal());
if(couponForm) couponForm.addEventListener('submit',saveCoupon);
document.querySelectorAll('[data-close-coupon-modal]').forEach(el=>el.addEventListener('click',closeCouponModal));
if(couponSearch) couponSearch.addEventListener('input',renderCouponsAdmin);
if(couponFilter) couponFilter.addEventListener('change',renderCouponsAdmin);


function adminPermissionPayloadFromForm(){
  return {
    dashboard:Boolean(document.getElementById('perm-dashboard').checked),
    orders:Boolean(document.getElementById('perm-orders').checked),
    products:Boolean(document.getElementById('perm-products').checked),
    coupons:Boolean(document.getElementById('perm-coupons').checked)
  };
}

function permissionLabels(admin){
  const labels=[];
  if(admin.role==='owner') return ['OWNER · FULL ACCESS'];
  if(admin.can_dashboard) labels.push('DASHBOARD');
  if(admin.can_orders) labels.push('ORDERS');
  if(admin.can_products) labels.push('PRODUCTS');
  if(admin.can_coupons) labels.push('COUPONS');
  return labels;
}

async function callManageAdmins(payload){
  const response=await fetch(`${SUPABASE_URL}/functions/v1/manage-admins`,{
    method:'POST',
    headers:authHeaders({'Content-Type':'application/json'}),
    body:JSON.stringify(payload)
  });

  const data=await response.json().catch(()=>({}));

  if(response.status===401){
    clearSession();
    showLogin('Your session expired. Please sign in again.');
    throw new Error('Session expired.');
  }

  if(response.status===403){
    throw new Error(data?.error || 'Owner access required.');
  }

  if(!response.ok){
    throw new Error(data?.error || data?.message || 'Admin management request failed.');
  }

  return data;
}

async function loadAdmins(){
  if(adminProfile?.role!=='owner') return;

  adminsError.textContent='';
  adminsLoading.hidden=false;

  try{
    const data=await callManageAdmins({action:'list'});
    allAdmins=Array.isArray(data.admins) ? data.admins : [];
    renderAdmins();
  }catch(err){
    adminsError.textContent=err.message || 'Could not load admins.';
  }finally{
    adminsLoading.hidden=true;
  }
}

function renderAdmins(){
  if(!adminsList) return;

  if(!allAdmins.length){
    adminsList.innerHTML='<div class="admin-empty">No admin accounts found.</div>';
    return;
  }

  adminsList.innerHTML=allAdmins.map(admin=>{
    const owner=admin.role==='owner';
    const active=admin.active!==false;
    const permissions=permissionLabels(admin);

    return `<article class="admin-user-card">
      <div class="admin-user-main">
        <div class="admin-user-title-row">
          <div>
            <div class="admin-user-email">${esc(admin.email)}</div>
            <div class="admin-user-role">${owner?'OWNER':'ADMIN'}${String(admin.user_id)===String(adminProfile?.user_id)?' · YOU':''}</div>
          </div>
          <span class="mini-status ${active?'mini-live':'mini-out'}">${active?'ACTIVE':'DISABLED'}</span>
        </div>

        <div class="admin-permission-pills">
          ${permissions.length
            ? permissions.map(label=>`<span>${esc(label)}</span>`).join('')
            : '<span class="muted-permission">NO SECTION ACCESS</span>'}
        </div>

        ${owner
          ? '<div class="admin-owner-note">Owner access is protected and cannot be edited or removed from this dashboard.</div>'
          : `<div class="admin-product-actions">
              <button class="admin-secondary-btn edit-managed-admin-btn" data-id="${esc(admin.user_id)}">EDIT ACCESS</button>
              <button class="admin-secondary-btn remove-managed-admin-btn danger-outline" data-id="${esc(admin.user_id)}">REMOVE ADMIN</button>
            </div>`}
      </div>
    </article>`;
  }).join('');

  document.querySelectorAll('.edit-managed-admin-btn').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const admin=allAdmins.find(a=>String(a.user_id)===String(btn.dataset.id));
      if(admin) openAdminModal(admin);
    });
  });

  document.querySelectorAll('.remove-managed-admin-btn').forEach(btn=>{
    btn.addEventListener('click',()=>removeManagedAdmin(btn.dataset.id,btn));
  });
}

function openAdminModal(admin=null){
  editingManagedAdmin=admin || null;
  adminUserForm.reset();
  adminUserFormError.textContent='';

  const editing=Boolean(admin);
  document.getElementById('managed-admin-user-id').value=admin?.user_id || '';
  document.getElementById('managed-admin-email').value=admin?.email || '';
  document.getElementById('managed-admin-email').disabled=editing;

  const passwordWrap=document.getElementById('managed-admin-password-wrap');
  const passwordInput=document.getElementById('managed-admin-password');
  passwordWrap.hidden=editing;
  passwordInput.required=!editing;
  passwordInput.value='';

  document.getElementById('perm-dashboard').checked=editing ? Boolean(admin.can_dashboard) : true;
  document.getElementById('perm-orders').checked=editing ? Boolean(admin.can_orders) : true;
  document.getElementById('perm-products').checked=editing ? Boolean(admin.can_products) : false;
  document.getElementById('perm-coupons').checked=editing ? Boolean(admin.can_coupons) : false;

  const activeWrap=document.getElementById('managed-admin-active-wrap');
  activeWrap.hidden=!editing;
  document.getElementById('managed-admin-active').checked=editing ? admin.active!==false : true;

  adminUserFormTitle.textContent=editing ? 'EDIT ADMIN ACCESS' : 'ADD ADMIN';
  saveAdminUserBtn.textContent=editing ? 'SAVE ACCESS' : 'CREATE ADMIN';

  adminUserModal.hidden=false;
  document.body.classList.add('modal-open');
}

function closeAdminModal(){
  adminUserModal.hidden=true;
  document.body.classList.remove('modal-open');
  editingManagedAdmin=null;
}

async function saveManagedAdmin(event){
  event.preventDefault();
  adminUserFormError.textContent='';

  const permissions=adminPermissionPayloadFromForm();

  if(!Object.values(permissions).some(Boolean)){
    adminUserFormError.textContent='Choose at least one permission.';
    return;
  }

  saveAdminUserBtn.disabled=true;
  const oldText=saveAdminUserBtn.textContent;
  saveAdminUserBtn.textContent='SAVING…';

  try{
    if(editingManagedAdmin){
      await callManageAdmins({
        action:'update',
        user_id:editingManagedAdmin.user_id,
        active:Boolean(document.getElementById('managed-admin-active').checked),
        permissions
      });
    }else{
      const email=document.getElementById('managed-admin-email').value.trim().toLowerCase();
      const password=document.getElementById('managed-admin-password').value;

      if(!email || !email.includes('@')){
        throw new Error('Enter a valid email address.');
      }
      if(password.length<8){
        throw new Error('Temporary password must be at least 8 characters.');
      }

      await callManageAdmins({
        action:'create',
        email,
        password,
        permissions
      });
    }

    closeAdminModal();
    allAdmins=[];
    await loadAdmins();
  }catch(err){
    adminUserFormError.textContent=err.message || 'Could not save admin.';
  }finally{
    saveAdminUserBtn.disabled=false;
    saveAdminUserBtn.textContent=editingManagedAdmin ? 'SAVE ACCESS' : oldText;
  }
}

async function removeManagedAdmin(userId,button){
  const admin=allAdmins.find(a=>String(a.user_id)===String(userId));
  if(!admin) return;

  if(!confirm(`Remove DOMARO admin access for ${admin.email}?`)) return;

  button.disabled=true;

  try{
    await callManageAdmins({
      action:'remove',
      user_id:userId
    });

    allAdmins=allAdmins.filter(a=>String(a.user_id)!==String(userId));
    renderAdmins();
  }catch(err){
    adminsError.textContent=err.message || 'Could not remove admin access.';
  }finally{
    button.disabled=false;
  }
}

if(newAdminBtn) newAdminBtn.addEventListener('click',()=>openAdminModal());
if(adminUserForm) adminUserForm.addEventListener('submit',saveManagedAdmin);
document.querySelectorAll('[data-close-admin-modal]').forEach(el=>el.addEventListener('click',closeAdminModal));

function updateNotificationButton(){
  if(!hasPermission('orders')){
    enableNotificationsBtn.hidden=true;
    stopOrderNotificationPolling();
    return;
  }
  enableNotificationsBtn.hidden=false;
  if(!('Notification' in window)){
    enableNotificationsBtn.textContent='ALERTS UNSUPPORTED';
    enableNotificationsBtn.disabled=true;
    return;
  }
  enableNotificationsBtn.disabled=false;
  if(Notification.permission === 'granted'){
    enableNotificationsBtn.textContent='ALERTS ON';
  }else if(Notification.permission === 'denied'){
    enableNotificationsBtn.textContent='ALERTS BLOCKED';
  }else{
    enableNotificationsBtn.textContent='ENABLE ALERTS';
  }
}

enableNotificationsBtn.addEventListener('click', async ()=>{
  if(!('Notification' in window)) return;
  try{
    const permission=await Notification.requestPermission();
    updateNotificationButton();
    if(permission === 'granted'){
      new Notification('DOMARO alerts enabled',{
        body:'New order alerts are active while this admin dashboard is open.'
      });
      startOrderNotificationPolling();
    }
  }catch(_){}
});

function startOrderNotificationPolling(){
  stopOrderNotificationPolling();
  if(!accessToken || !hasPermission('orders')) return;
  notificationPollTimer=setInterval(checkForNewOrders,60000);
}

function stopOrderNotificationPolling(){
  if(notificationPollTimer){
    clearInterval(notificationPollTimer);
    notificationPollTimer=null;
  }
}

async function checkForNewOrders(){
  if(!accessToken || !hasPermission('orders')) return;

  try{
    const response=await fetch(
      `${SUPABASE_URL}/rest/v1/orders?select=id,order_number,first_name,last_name,total,created_at&order=created_at.desc&limit=5`,
      {headers:authHeaders()}
    );
    if(!response.ok) return;

    const latest=await response.json();
    if(!Array.isArray(latest) || !latest.length) return;

    const newestCreatedAt=latest[0].created_at || '';

    if(!lastKnownOrderCreatedAt){
      lastKnownOrderCreatedAt=newestCreatedAt;
      localStorage.setItem('domaro_last_known_order_created_at',lastKnownOrderCreatedAt);
      return;
    }

    const newOnes=latest
      .filter(o=>new Date(o.created_at) > new Date(lastKnownOrderCreatedAt))
      .sort((a,b)=>new Date(a.created_at)-new Date(b.created_at));

    for(const order of newOnes){
      if(Notification.permission === 'granted'){
        new Notification(`New DOMARO order — ${order.order_number}`,{
          body:`${order.first_name} ${order.last_name} · ${money(order.total)}`,
          tag:`domaro-order-${order.id}`
        });
      }
    }

    if(newOnes.length){
      lastKnownOrderCreatedAt=newestCreatedAt;
      localStorage.setItem('domaro_last_known_order_created_at',lastKnownOrderCreatedAt);
      await loadOrders();
      await loadDashboardStats();
    }
  }catch(_){}
}

loginForm.addEventListener('submit',async e=>{
  e.preventDefault();
  loginError.textContent='';
  loginBtn.disabled=true;
  loginBtn.textContent='SIGNING IN…';
  const email=document.getElementById('admin-email').value.trim();
  const password=document.getElementById('admin-password').value;
  try{
    await login(email,password);
    await verifyAdminAccess();
    showDashboard();
    startOrderNotificationPolling();
    document.getElementById('admin-password').value='';
  }catch(err){
    clearSession();
    loginError.textContent=err.message || 'Login failed.';
  }finally{
    loginBtn.disabled=false;
    loginBtn.textContent='SIGN IN';
  }
});

logoutBtn.addEventListener('click',()=>{
  stopOrderNotificationPolling();
  clearSession();
  allOrders=[]; orderItems=[]; allProducts=[]; allCoupons=[]; allAdmins=[]; dashboardStats=null; adminProfile=null;
  ordersList.innerHTML=''; productsList.innerHTML=''; if(adminsList) adminsList.innerHTML='';
  showLogin();
});
refreshDashboardBtn.addEventListener('click',loadDashboardStats);
refreshBtn.addEventListener('click',loadOrders);
searchInput.addEventListener('input',renderOrders);
statusFilter.addEventListener('change',renderOrders);
productSearch.addEventListener('input',renderProductsAdmin);
productFilter.addEventListener('change',renderProductsAdmin);

(async function restoreSession(){
  if(!accessToken) return;
  try{
    await verifyAdminAccess();
    showDashboard();
    startOrderNotificationPolling();
  }catch(err){
    clearSession();
    showLogin(err.message || 'Please sign in again.');
  }
})();
