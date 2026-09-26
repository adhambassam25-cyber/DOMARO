
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
const customersPanel = document.getElementById('admin-customers-panel');
const productsPanel = document.getElementById('admin-products-panel');
const couponsPanel = document.getElementById('admin-coupons-panel');
const adminsPanel = document.getElementById('admin-admins-panel');
const adminsTabBtn = document.getElementById('admins-tab-btn');

const dashboardLoading = document.getElementById('dashboard-loading');
const dashboardError = document.getElementById('dashboard-error');
const refreshDashboardBtn = document.getElementById('refresh-dashboard');
const dashboardBestProducts = document.getElementById('dashboard-best-products');
const dashboardRecentOrders = document.getElementById('dashboard-recent-orders');
const dashboardPeriod = document.getElementById('dashboard-period');
const exportDashboardCsvBtn = document.getElementById('export-dashboard-csv');
const dashboardSalesTrend = document.getElementById('dashboard-sales-trend');
const dashboardTopGovernorates = document.getElementById('dashboard-top-governorates');

const ordersList = document.getElementById('orders-list');
const ordersError = document.getElementById('orders-error');
const ordersLoading = document.getElementById('orders-loading');
const refreshBtn = document.getElementById('refresh-orders');
const searchInput = document.getElementById('order-search');
const statusFilter = document.getElementById('status-filter');
const ordersDateFrom = document.getElementById('orders-date-from');
const ordersDateTo = document.getElementById('orders-date-to');
const clearOrderFiltersBtn = document.getElementById('clear-order-filters');
const exportOrdersCsvBtn = document.getElementById('export-orders-csv');
const ordersCountLabel = document.getElementById('orders-count-label');
const ordersPagination = document.getElementById('orders-pagination');
const ordersPrevPage = document.getElementById('orders-prev-page');
const ordersNextPage = document.getElementById('orders-next-page');
const ordersPageLabel = document.getElementById('orders-page-label');
const orderDetailsModal = document.getElementById('order-details-modal');
const orderDetailsTitle = document.getElementById('order-details-title');
const orderDetailsContent = document.getElementById('order-details-content');
const copyOrderSummaryBtn = document.getElementById('copy-order-summary');
const printOrderBtn = document.getElementById('print-order');

const customersList = document.getElementById('customers-list');
const customersError = document.getElementById('customers-error');
const customersLoading = document.getElementById('customers-loading');
const refreshCustomersBtn = document.getElementById('refresh-customers');
const customerSearch = document.getElementById('customer-search');
const customerFilter = document.getElementById('customer-filter');
const exportCustomersCsvBtn = document.getElementById('export-customers-csv');
const customersCountLabel = document.getElementById('customers-count-label');
const customerDetailsModal = document.getElementById('customer-details-modal');
const customerDetailsTitle = document.getElementById('customer-details-title');
const customerDetailsContent = document.getElementById('customer-details-content');

const productsList = document.getElementById('products-list');
const productsError = document.getElementById('products-error');
const productsLoading = document.getElementById('products-loading');
const productSearch = document.getElementById('product-search');
const productFilter = document.getElementById('product-filter');
const newProductBtn = document.getElementById('new-product-btn');
const productLowThreshold = document.getElementById('product-low-threshold');

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
let ordersPage = 1;
let currentDetailOrderId = null;
let currentCustomerKey = null;
const ordersPerPage = 8;
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
const ADMIN_IDLE_TIMEOUT_MS = 30 * 60 * 1000;
let adminIdleTimer = null;

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

// ---------- V27 CUSTOMER COMMUNICATION ----------
function egyptWhatsAppNumber(phone){
  let digits=String(phone || '').replace(/\D/g,'');
  if(!digits) return '';
  if(digits.startsWith('0020')) digits=digits.slice(4);
  else if(digits.startsWith('20') && digits.length>=12) return digits;
  if(digits.startsWith('0')) digits=digits.slice(1);
  if(digits.startsWith('1') && digits.length===10) return `20${digits}`;
  return digits.startsWith('20') ? digits : `20${digits}`;
}

function orderTrackUrl(order){
  const number=String(order?.order_number || '').trim();
  return `https://domaro.vercel.app/track.html?order=${encodeURIComponent(number)}`;
}

function defaultMessageTemplateForStatus(status){
  return ({
    new:'received',
    confirmed:'confirmed',
    shipped:'shipped',
    delivered:'delivered',
    cancelled:'cancelled'
  })[String(status || '').toLowerCase()] || 'received';
}

function buildOrderCustomerMessage(order,templateKey){
  const name=String(order?.first_name || '').trim() || 'there';
  const orderNumber=String(order?.order_number || '').trim();
  const total=money(order?.total);
  const tracking=orderTrackUrl(order);
  const payment=String(order?.payment_method || 'Cash on Delivery').trim();

  const messages={
    received:`Hello ${name}, your DOMARO order ${orderNumber} has been received. Total: ${total}. Payment: ${payment}. You can track your order here: ${tracking}`,
    confirmed:`Hello ${name}, your DOMARO order ${orderNumber} has been confirmed and is being prepared. Total: ${total}. Track your order here: ${tracking}`,
    shipped:`Hello ${name}, your DOMARO order ${orderNumber} is on the way. You can follow its current status here: ${tracking}`,
    delivered:`Hello ${name}, your DOMARO order ${orderNumber} has been marked as delivered. Thank you for choosing DOMARO.`,
    cancelled:`Hello ${name}, your DOMARO order ${orderNumber} has been cancelled. If you need any help, please contact DOMARO.`
  };
  return messages[templateKey] || messages.received;
}

async function copyTextToClipboard(text){
  const value=String(text || '');
  if(navigator.clipboard && window.isSecureContext){
    await navigator.clipboard.writeText(value);
    return;
  }
  const textarea=document.createElement('textarea');
  textarea.value=value;
  textarea.setAttribute('readonly','');
  textarea.style.position='fixed';
  textarea.style.opacity='0';
  document.body.appendChild(textarea);
  textarea.select();
  const ok=document.execCommand('copy');
  textarea.remove();
  if(!ok) throw new Error('Copy is not supported in this browser.');
}

function openWhatsApp(phone,message=''){
  const number=egyptWhatsAppNumber(phone);
  if(!number) throw new Error('Customer phone number is unavailable.');
  const url=`https://wa.me/${encodeURIComponent(number)}${message?`?text=${encodeURIComponent(message)}`:''}`;
  window.open(url,'_blank','noopener,noreferrer');
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
  const tabs=[];
  if(hasPermission('dashboard')) tabs.push('dashboard');
  if(hasPermission('orders')) tabs.push('orders','customers');
  if(hasPermission('products')) tabs.push('products');
  if(hasPermission('coupons')) tabs.push('coupons');

  if(String(adminProfile?.role || '').toLowerCase()==='owner'){
    tabs.push('admins');
  }

  return tabs;
}

function setElementPermissionVisibility(el,visible){
  if(!el) return;
  el.hidden=!visible;
  el.style.display=visible ? '' : 'none';
  el.setAttribute('aria-hidden',visible ? 'false' : 'true');
}

function applyAdminPermissions(){
  const permissionMap={
    dashboard:'dashboard',
    orders:'orders',
    customers:'orders',
    products:'products',
    coupons:'coupons',
    admins:'admins'
  };

  const isOwner=String(adminProfile?.role || '').toLowerCase()==='owner';

  document.querySelectorAll('.admin-tab').forEach(btn=>{
    const tab=btn.dataset.adminTab;
    const permission=permissionMap[tab];
    const visible=tab==='admins' ? isOwner : hasPermission(permission);
    setElementPermissionVisibility(btn,visible);
  });

  setElementPermissionVisibility(adminsTabBtn,isOwner);
  setElementPermissionVisibility(enableNotificationsBtn,hasPermission('orders'));

  // Always keep the owner-only panel inaccessible in the UI for non-owners.
  if(adminsPanel && !isOwner){
    adminsPanel.hidden=true;
    adminsPanel.style.display='none';
    adminsPanel.setAttribute('aria-hidden','true');
  }

  const roleText=isOwner ? 'OWNER' : 'ADMIN';
  adminUserLabel.textContent=`${adminProfile?.email || adminEmail || 'Admin'} · ${roleText}`;
}

function stopAdminIdleTimer(){
  if(adminIdleTimer){
    clearTimeout(adminIdleTimer);
    adminIdleTimer=null;
  }
}

function resetAdminIdleTimer(){
  stopAdminIdleTimer();
  if(!accessToken || dashboardSection.hidden) return;
  adminIdleTimer=setTimeout(()=>{
    stopOrderNotificationPolling();
    clearSession();
    allOrders=[]; orderItems=[]; allProducts=[]; allCoupons=[]; allAdmins=[]; dashboardStats=null;
    ordersList.innerHTML='';
    if(customersList) customersList.innerHTML='';
    productsList.innerHTML='';
    if(adminsList) adminsList.innerHTML='';
    showLogin('Signed out after 30 minutes of inactivity.');
  },ADMIN_IDLE_TIMEOUT_MS);
}

function showDashboard(){
  loginSection.hidden=true;
  dashboardSection.hidden=false;
  logoutBtn.hidden=false;

  // Hide every panel first so no previous/stale view can flash.
  document.querySelectorAll('.admin-panel').forEach(panel=>{
    panel.hidden=true;
    panel.style.display='none';
    panel.setAttribute('aria-hidden','true');
  });

  applyAdminPermissions();
  updateNotificationButton();
  resetAdminIdleTimer();

  const tabs=allowedTabs();
  if(!tabs.length) return;

  setTab(tabs[0]);
}

function showLogin(message=''){
  dashboardSection.hidden=true;
  loginSection.hidden=false;
  logoutBtn.hidden=true;
  enableNotificationsBtn.hidden=true;
  stopOrderNotificationPolling();
  stopAdminIdleTimer();
  adminUserLabel.textContent='';
  adminProfile=null;
  if(message) loginError.textContent=message;
}

function clearSession(){
  stopAdminIdleTimer();
  accessToken='';
  adminEmail='';
  adminProfile=null;
  sessionStorage.removeItem('domaro_admin_access_token');
  sessionStorage.removeItem('domaro_admin_email');
}

function setTab(tab){
  const isOwner=String(adminProfile?.role || '').toLowerCase()==='owner';
  if(tab==='admins'){
    if(!isOwner) return;
  }else{
    const requiredPermission=tab==='customers' ? 'orders' : tab;
    if(!hasPermission(requiredPermission)) return;
  }

  document.querySelectorAll('.admin-tab').forEach(btn=>{
    btn.classList.toggle('active',btn.dataset.adminTab===tab);
  });

  const panels={
    dashboard:dashboardPanel,
    orders:ordersPanel,
    customers:customersPanel,
    products:productsPanel,
    coupons:couponsPanel,
    admins:adminsPanel
  };

  Object.entries(panels).forEach(([name,panel])=>{
    if(!panel) return;
    const visible=name===tab && (name!=='admins' || isOwner);
    panel.hidden=!visible;
    panel.style.display=visible ? '' : 'none';
    panel.setAttribute('aria-hidden',visible ? 'false' : 'true');
  });

  if(tab==='dashboard' && !dashboardStats) loadDashboardStats();
  if(tab==='orders' && !allOrders.length) loadOrders();
  if(tab==='customers'){
    if(!allOrders.length) loadCustomers();
    else renderCustomers();
  }
  if(tab==='products' && !allProducts.length) loadProducts();
  if(tab==='coupons' && !allCoupons.length) loadCoupons();
  if(tab==='admins' && isOwner && !allAdmins.length) loadAdmins();
}

document.querySelectorAll('.admin-tab').forEach(btn=>{
  btn.addEventListener('click',()=>setTab(btn.dataset.adminTab));
});

async function loadDashboardStats(){
  dashboardError.textContent='';
  dashboardLoading.hidden=false;
  refreshDashboardBtn.disabled=true;
  if(exportDashboardCsvBtn) exportDashboardCsvBtn.disabled=true;
  try{
    const periodDays=Number(dashboardPeriod?.value || 30);
    const response=await fetch(`${SUPABASE_URL}/rest/v1/rpc/admin_dashboard_report`,{
      method:'POST',
      headers:authHeaders({'Content-Type':'application/json'}),
      body:JSON.stringify({p_days:periodDays})
    });
    const data=await response.json().catch(()=>null);
    if(response.status===401){clearSession();showLogin('Your session expired. Please sign in again.');return;}
    if(response.status===403) throw new Error('This account does not have permission to view dashboard statistics.');
    if(!response.ok) throw new Error(data?.message || 'Could not load dashboard reporting.');
    dashboardStats=data || {};
    renderDashboardStats();
  }catch(err){
    dashboardError.textContent=err.message || 'Could not load dashboard reporting.';
  }finally{
    dashboardLoading.hidden=true;
    refreshDashboardBtn.disabled=false;
    if(exportDashboardCsvBtn) exportDashboardCsvBtn.disabled=false;
  }
}

function dashboardPercentChange(current, previous){
  if(previous === null || previous === undefined) return null;
  const curr=Number(current || 0);
  const prev=Number(previous || 0);
  if(prev===0){
    if(curr===0) return 0;
    return null;
  }
  return ((curr-prev)/Math.abs(prev))*100;
}

function setDashboardGrowth(id, current, previous, previousTextId, formatter){
  const valueEl=document.getElementById(id);
  const previousEl=document.getElementById(previousTextId);
  if(!valueEl || !previousEl) return;

  valueEl.classList.remove('positive','negative','neutral');
  if(previous === null || previous === undefined){
    valueEl.textContent='—';
    valueEl.classList.add('neutral');
    previousEl.textContent='All-time view has no previous period comparison';
    return;
  }

  const change=dashboardPercentChange(current,previous);
  if(change===null){
    valueEl.textContent=Number(current||0)>0 ? 'NEW' : '0%';
    valueEl.classList.add(Number(current||0)>0 ? 'positive' : 'neutral');
  }else{
    const rounded=Math.abs(change)<0.05 ? 0 : change;
    const sign=rounded>0 ? '+' : '';
    valueEl.textContent=`${sign}${rounded.toFixed(1)}%`;
    valueEl.classList.add(rounded>0?'positive':rounded<0?'negative':'neutral');
  }
  previousEl.textContent=`Previous period: ${formatter(previous)}`;
}

function formatDashboardDate(value){
  if(!value) return '';
  try{
    return new Intl.DateTimeFormat('en-EG',{day:'numeric',month:'short'}).format(new Date(`${value}T12:00:00`));
  }catch(_){return String(value);}
}

function renderDashboardTrend(points){
  if(!dashboardSalesTrend) return;
  const data=Array.isArray(points)?points:[];
  if(!data.length){
    dashboardSalesTrend.innerHTML='<div class="admin-empty compact">No trend data yet.</div>';
    return;
  }

  const maxRevenue=Math.max(0,...data.map(p=>Number(p.revenue||0)));
  const maxOrders=Math.max(0,...data.map(p=>Number(p.orders||0)));
  const useRevenue=maxRevenue>0;
  const maxValue=useRevenue?maxRevenue:maxOrders;

  dashboardSalesTrend.innerHTML=`<div class="dashboard-trend-scroll">${data.map(point=>{
    const value=useRevenue?Number(point.revenue||0):Number(point.orders||0);
    const height=maxValue>0 && value>0 ? Math.max(6,Math.round((value/maxValue)*100)) : 0;
    const title=`${formatDashboardDate(point.date)} · ${money(point.revenue)} · ${Number(point.orders||0)} orders`;
    return `<div class="dashboard-trend-day" title="${esc(title)}">
      <div class="dashboard-trend-value">${useRevenue && value>0 ? esc(Number(value).toLocaleString('en-EG')) : value>0 ? esc(String(value)) : ''}</div>
      <div class="dashboard-trend-track"><span style="height:${height}%"></span></div>
      <small>${esc(formatDashboardDate(point.date))}</small>
    </div>`;
  }).join('')}</div>`;
}

function renderDashboardStats(){
  const d=dashboardStats || {};
  document.getElementById('dashboard-total-sales').textContent=money(d.total_sales);
  document.getElementById('dashboard-total-orders').textContent=Number(d.total_orders || 0).toLocaleString('en-EG');
  document.getElementById('dashboard-average-order-value').textContent=money(d.average_order_value);
  document.getElementById('dashboard-delivery-rate').textContent=`${Number(d.delivery_rate || 0).toLocaleString('en-EG',{maximumFractionDigits:1})}%`;
  document.getElementById('dashboard-delivered-orders').textContent=Number(d.delivered_orders || 0).toLocaleString('en-EG');
  document.getElementById('dashboard-cancelled-orders').textContent=Number(d.cancelled_orders || 0).toLocaleString('en-EG');
  document.getElementById('dashboard-new-orders').textContent=Number(d.new_orders || 0).toLocaleString('en-EG');
  document.getElementById('dashboard-confirmed-orders').textContent=Number(d.confirmed_orders || 0).toLocaleString('en-EG');
  document.getElementById('dashboard-shipped-orders').textContent=Number(d.shipped_orders || 0).toLocaleString('en-EG');
  document.getElementById('dashboard-status-delivered').textContent=Number(d.delivered_orders || 0).toLocaleString('en-EG');
  document.getElementById('dashboard-unique-customers').textContent=Number(d.unique_customers || 0).toLocaleString('en-EG');
  document.getElementById('dashboard-returning-customers').textContent=Number(d.returning_customers || 0).toLocaleString('en-EG');

  const periodLabel=document.getElementById('dashboard-revenue-period-label');
  if(periodLabel){
    periodLabel.textContent=Number(d.period_days||0)===0
      ? 'All-time delivered revenue'
      : `${formatDashboardDate(d.period_start)} – ${formatDashboardDate(d.period_end)}`;
  }

  setDashboardGrowth('dashboard-revenue-change',d.total_sales,d.previous_sales,'dashboard-previous-revenue',money);
  setDashboardGrowth('dashboard-orders-change',d.total_orders,d.previous_orders,'dashboard-previous-orders',v=>`${Number(v||0).toLocaleString('en-EG')} orders`);

  const products=Array.isArray(d.best_selling_products)?d.best_selling_products:[];
  dashboardBestProducts.innerHTML=products.length?products.map((p,index)=>`
    <div class="sales-rank-row">
      <span class="sales-rank-number">${index+1}</span>
      <div class="sales-rank-product">
        <b>${esc(p.product_name)}</b>
        <span>${esc(p.size_ml)} ML · ${Number(p.quantity_sold || 0).toLocaleString('en-EG')} units</span>
      </div>
      <strong>${money(p.sales)}</strong>
    </div>`).join(''):'<div class="admin-empty compact">No product activity in this period.</div>';

  const governorates=Array.isArray(d.top_governorates)?d.top_governorates:[];
  if(dashboardTopGovernorates){
    dashboardTopGovernorates.innerHTML=governorates.length?governorates.map((g,index)=>`
      <div class="sales-rank-row">
        <span class="sales-rank-number">${index+1}</span>
        <div class="sales-rank-product">
          <b>${esc(g.governorate)}</b>
          <span>${Number(g.orders || 0).toLocaleString('en-EG')} orders</span>
        </div>
        <strong>${money(g.sales)}</strong>
      </div>`).join(''):'<div class="admin-empty compact">No location activity in this period.</div>';
  }

  renderDashboardTrend(d.daily_trend);
  const trendNote=document.getElementById('dashboard-trend-note');
  if(trendNote){
    trendNote.textContent=Number(d.period_days||0)>30 || Number(d.period_days||0)===0
      ? 'Latest 30 days · delivered revenue by order date'
      : 'Delivered revenue by order date';
  }

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
    </div>`).join(''):'<div class="admin-empty compact">No orders in this period.</div>';
}

function exportDashboardReport(){
  const d=dashboardStats || {};
  if(!Object.keys(d).length){
    dashboardError.textContent='Load the dashboard report before exporting.';
    return;
  }
  dashboardError.textContent='';

  const period=Number(d.period_days||0)===0 ? 'All time' : `${d.period_start || ''} to ${d.period_end || ''}`;
  const rows=[
    ['Summary','Period',period,''],
    ['Summary','Delivered Revenue',d.total_sales,'EGP'],
    ['Summary','Orders',d.total_orders,''],
    ['Summary','Average Order Value',d.average_order_value,'EGP'],
    ['Summary','Delivered Share',d.delivery_rate,'%'],
    ['Summary','Unique Customers',d.unique_customers,''],
    ['Summary','Returning Customers',d.returning_customers,''],
    ['Status','New',d.new_orders,'orders'],
    ['Status','Confirmed',d.confirmed_orders,'orders'],
    ['Status','Shipped',d.shipped_orders,'orders'],
    ['Status','Delivered',d.delivered_orders,'orders'],
    ['Status','Cancelled',d.cancelled_orders,'orders']
  ];

  (Array.isArray(d.best_selling_products)?d.best_selling_products:[]).forEach((p,index)=>{
    rows.push(['Top Product',`${index+1}. ${p.product_name} ${p.size_ml || ''}ML`,p.quantity_sold,`${p.sales} EGP`]);
  });
  (Array.isArray(d.top_governorates)?d.top_governorates:[]).forEach((g,index)=>{
    rows.push(['Top Governorate',`${index+1}. ${g.governorate}`,g.orders,`${g.sales} EGP`]);
  });
  (Array.isArray(d.daily_trend)?d.daily_trend:[]).forEach(point=>{
    rows.push(['Daily Trend',point.date,point.orders,`${point.revenue} EGP`]);
  });

  const headers=['Section','Metric','Value','Extra'];
  const csv='\uFEFF'+[headers,...rows].map(row=>row.map(csvSafe).join(',')).join('\r\n');
  const blob=new Blob([csv],{type:'text/csv;charset=utf-8'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  const today=new Date().toISOString().slice(0,10);
  a.href=url;
  a.download=`DOMARO-dashboard-${today}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),500);
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
    ordersPage=1;
    renderStats();
    renderOrders();
    renderCustomers();
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
function normalizeCustomerPhone(value){
  let digits=String(value || '').replace(/\D/g,'');
  if(digits.startsWith('0020')) digits=digits.slice(4);
  else if(digits.startsWith('20') && digits.length>=12) digits=digits.slice(2);
  if(digits.startsWith('0')) digits=digits.slice(1);
  return digits;
}

function buildCustomerProfiles(){
  const profiles=new Map();
  allOrders.forEach(order=>{
    const normalized=normalizeCustomerPhone(order.phone);
    const key=normalized || `order:${order.id}`;
    let customer=profiles.get(key);
    if(!customer){
      customer={
        key,
        phone:order.phone || '',
        first_name:order.first_name || '',
        last_name:order.last_name || '',
        orders:[],
        order_count:0,
        delivered_count:0,
        delivered_spend:0,
        last_order_at:order.created_at || '',
        last_order_number:order.order_number || '',
        locations:new Set()
      };
      profiles.set(key,customer);
    }

    customer.orders.push(order);
    customer.order_count+=1;
    if(order.status==='delivered'){
      customer.delivered_count+=1;
      customer.delivered_spend+=Number(order.total || 0);
    }

    const location=[order.governorate,order.area].filter(Boolean).join(' · ');
    if(location) customer.locations.add(location);

    const currentTime=new Date(customer.last_order_at || 0).getTime();
    const orderTime=new Date(order.created_at || 0).getTime();
    if(orderTime>=currentTime){
      customer.phone=order.phone || customer.phone;
      customer.first_name=order.first_name || customer.first_name;
      customer.last_name=order.last_name || customer.last_name;
      customer.last_order_at=order.created_at || customer.last_order_at;
      customer.last_order_number=order.order_number || customer.last_order_number;
    }
  });

  return Array.from(profiles.values()).map(customer=>({
    ...customer,
    locations:Array.from(customer.locations),
    orders:customer.orders.sort((a,b)=>new Date(b.created_at||0)-new Date(a.created_at||0))
  })).sort((a,b)=>new Date(b.last_order_at||0)-new Date(a.last_order_at||0));
}

function filteredCustomers(){
  const q=(customerSearch?.value || '').trim().toLowerCase();
  const filter=customerFilter?.value || 'all';
  return buildCustomerProfiles().filter(customer=>{
    const name=`${customer.first_name} ${customer.last_name}`.trim();
    const haystack=[name,customer.phone,...customer.locations].join(' ').toLowerCase();
    const matchesFilter=
      filter==='all' ||
      (filter==='returning' && customer.order_count>=2) ||
      (filter==='single' && customer.order_count===1) ||
      (filter==='delivered' && customer.delivered_count>0);
    return matchesFilter && (!q || haystack.includes(q));
  });
}

function renderCustomerStats(){
  const customers=buildCustomerProfiles();
  const uniqueEl=document.getElementById('customer-stat-all');
  const returningEl=document.getElementById('customer-stat-returning');
  const ordersEl=document.getElementById('customer-stat-orders');
  const spendEl=document.getElementById('customer-stat-spend');
  if(uniqueEl) uniqueEl.textContent=customers.length.toLocaleString('en-EG');
  if(returningEl) returningEl.textContent=customers.filter(c=>c.order_count>=2).length.toLocaleString('en-EG');
  if(ordersEl) ordersEl.textContent=allOrders.length.toLocaleString('en-EG');
  if(spendEl) spendEl.textContent=money(customers.reduce((sum,c)=>sum+c.delivered_spend,0));
}

function renderCustomers(){
  if(!customersList) return;
  renderCustomerStats();
  const customers=filteredCustomers();
  if(customersCountLabel){
    customersCountLabel.textContent=`${customers.length.toLocaleString('en-EG')} ${customers.length===1?'customer':'customers'}`;
  }

  if(!customers.length){
    customersList.innerHTML='<div class="admin-empty">No matching customers.</div>';
    return;
  }

  customersList.innerHTML=customers.map(customer=>{
    const name=`${customer.first_name || ''} ${customer.last_name || ''}`.trim() || 'Customer';
    const location=customer.locations[0] || '—';
    const returning=customer.order_count>=2;
    return `<article class="customer-card" data-customer-key="${esc(customer.key)}">
      <div class="customer-card-main">
        <div>
          <span class="customer-label">CUSTOMER</span>
          <h3>${esc(name)}</h3>
          <p>${esc(customer.phone || '—')}</p>
        </div>
        ${returning?'<span class="customer-returning-badge">RETURNING</span>':''}
      </div>
      <div class="customer-card-metrics">
        <div><span>ORDERS</span><b>${customer.order_count.toLocaleString('en-EG')}</b></div>
        <div><span>DELIVERED SPEND</span><b>${money(customer.delivered_spend)}</b></div>
        <div><span>LAST ORDER</span><b>${esc(customer.last_order_number || '—')}</b><small>${esc(fmtDate(customer.last_order_at))}</small></div>
        <div><span>LOCATION</span><b>${esc(location)}</b></div>
      </div>
      <div class="customer-card-actions">
        <button class="admin-secondary-btn customer-view-profile" type="button" data-customer-key="${esc(customer.key)}">VIEW PROFILE</button>
      </div>
    </article>`;
  }).join('');

  document.querySelectorAll('.customer-view-profile').forEach(btn=>{
    btn.addEventListener('click',()=>openCustomerProfile(btn.dataset.customerKey));
  });
}

async function loadCustomers(){
  if(!customersLoading) return loadOrders();
  customersError.textContent='';
  customersLoading.hidden=false;
  if(refreshCustomersBtn) refreshCustomersBtn.disabled=true;
  try{
    await loadOrders();
    if(ordersError?.textContent) customersError.textContent=ordersError.textContent;
    renderCustomers();
  }catch(err){
    customersError.textContent=err.message || 'Could not load customers.';
  }finally{
    customersLoading.hidden=true;
    if(refreshCustomersBtn) refreshCustomersBtn.disabled=false;
  }
}

function customerProductSummary(customer){
  const validOrderIds=new Set(customer.orders.filter(o=>o.status!=='cancelled').map(o=>o.id));
  const summary=new Map();
  orderItems.forEach(item=>{
    if(!validOrderIds.has(item.order_id)) return;
    const key=item.product_id || item.product_name || item.id;
    const current=summary.get(key) || {name:item.product_name || 'Product',size_ml:item.size_ml,qty:0};
    current.qty+=Number(item.quantity || 0);
    summary.set(key,current);
  });
  return Array.from(summary.values()).sort((a,b)=>b.qty-a.qty);
}

function openCustomerProfile(customerKey){
  const customer=buildCustomerProfiles().find(c=>c.key===customerKey);
  if(!customer || !customerDetailsModal || !customerDetailsContent) return;
  currentCustomerKey=customerKey;
  const name=`${customer.first_name || ''} ${customer.last_name || ''}`.trim() || 'Customer';
  if(customerDetailsTitle) customerDetailsTitle.textContent=name.toUpperCase();
  const products=customerProductSummary(customer);
  const locations=customer.locations.length ? customer.locations : ['No delivery location available'];

  customerDetailsContent.innerHTML=`
    <div class="customer-profile-hero">
      <div><span>PHONE</span><b>${esc(customer.phone || '—')}</b></div>
      <div><span>ORDERS</span><b>${customer.order_count.toLocaleString('en-EG')}</b></div>
      <div><span>DELIVERED</span><b>${customer.delivered_count.toLocaleString('en-EG')}</b></div>
      <div><span>DELIVERED SPEND</span><b>${money(customer.delivered_spend)}</b></div>
    </div>

    <div class="customer-profile-contact-actions">
      <a class="admin-secondary-btn" href="tel:${esc(customer.phone || '')}">CALL CUSTOMER</a>
      <button id="customer-profile-whatsapp" class="admin-primary-btn" type="button">OPEN WHATSAPP</button>
      <span>WhatsApp opens manually. DOMARO does not send a message automatically.</span>
    </div>

    <div class="customer-profile-grid">
      <section class="customer-profile-card">
        <div class="customer-profile-card-head"><span>DELIVERY AREAS</span><h3>LOCATIONS</h3></div>
        <div class="customer-location-list">${locations.map(location=>`<div>${esc(location)}</div>`).join('')}</div>
      </section>
      <section class="customer-profile-card">
        <div class="customer-profile-card-head"><span>ORDERED PRODUCTS</span><h3>PRODUCT HISTORY</h3></div>
        <div class="customer-product-list">${products.length?products.map(product=>`<div><b>${esc(product.name)}</b><span>${esc(product.size_ml || '')}${product.size_ml?' ML · ':''}${product.qty.toLocaleString('en-EG')} unit${product.qty===1?'':'s'}</span></div>`).join(''):'<div class="customer-empty-line">No non-cancelled product history.</div>'}</div>
      </section>
    </div>

    <section class="customer-orders-history">
      <div class="customer-profile-card-head"><span>FULL HISTORY</span><h3>ORDERS</h3></div>
      <div class="customer-order-list">${customer.orders.map(order=>`
        <div class="customer-order-row">
          <div><b>${esc(order.order_number)}</b><span>${esc(fmtDate(order.created_at))}</span></div>
          <span class="status-badge status-${esc(order.status)}">${esc(prettyStatus(order.status))}</span>
          <strong>${money(order.total)}</strong>
          <button class="admin-secondary-btn customer-open-order" type="button" data-order-id="${esc(order.id)}">OPEN ORDER</button>
        </div>`).join('')}</div>
    </section>`;

  customerDetailsModal.hidden=false;
  document.body.style.overflow='hidden';
  const profileWhatsAppBtn=document.getElementById('customer-profile-whatsapp');
  profileWhatsAppBtn?.addEventListener('click',()=>{
    try{
      openWhatsApp(customer.phone);
    }catch(err){
      customersError.textContent=err.message || 'Could not open WhatsApp.';
    }
  });
  document.querySelectorAll('.customer-open-order').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const orderId=btn.dataset.orderId;
      closeCustomerProfile();
      openOrderDetails(orderId);
    });
  });
}

function closeCustomerProfile(){
  if(!customerDetailsModal) return;
  customerDetailsModal.hidden=true;
  currentCustomerKey=null;
  document.body.style.overflow='';
}

function exportCustomersCsv(){
  const customers=filteredCustomers();
  if(!customers.length){
    customersError.textContent='There are no matching customers to export.';
    return;
  }
  customersError.textContent='';
  const headers=['Customer Name','Phone','Orders','Delivered Orders','Delivered Spend','Last Order','Last Order Date','Locations'];
  const rows=customers.map(customer=>[
    `${customer.first_name || ''} ${customer.last_name || ''}`.trim(),
    customer.phone,
    customer.order_count,
    customer.delivered_count,
    customer.delivered_spend,
    customer.last_order_number,
    fmtDate(customer.last_order_at),
    customer.locations.join(' | ')
  ]);
  const csv='\uFEFF'+[headers,...rows].map(row=>row.map(csvSafe).join(',')).join('\r\n');
  const blob=new Blob([csv],{type:'text/csv;charset=utf-8'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  const today=new Date().toISOString().slice(0,10);
  a.href=url;
  a.download=`DOMARO-customers-${today}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),500);
}

function filteredOrders(){
  const q=searchInput.value.trim().toLowerCase();
  const status=statusFilter.value;
  const fromValue=ordersDateFrom?.value || '';
  const toValue=ordersDateTo?.value || '';
  const fromDate=fromValue ? new Date(`${fromValue}T00:00:00`) : null;
  const toDate=toValue ? new Date(`${toValue}T23:59:59.999`) : null;

  return allOrders.filter(o=>{
    const matchesStatus=status==='all' || o.status===status;
    const haystack=[o.order_number,o.first_name,o.last_name,o.phone,o.governorate,o.area].join(' ').toLowerCase();
    const created=o.created_at ? new Date(o.created_at) : null;
    const matchesFrom=!fromDate || (created && created>=fromDate);
    const matchesTo=!toDate || (created && created<=toDate);
    return matchesStatus && matchesFrom && matchesTo && (!q || haystack.includes(q));
  });
}

function csvSafe(value){
  let text=String(value ?? '');
  if(/^[=+\-@]/.test(text)) text=`'${text}`;
  return `"${text.replaceAll('"','""')}"`;
}

function formatOrderItemsForExport(orderId){
  return orderItems
    .filter(i=>i.order_id===orderId)
    .map(i=>`${i.product_name} ${i.size_ml || ''}ML x${i.quantity}`.replace(/\s+/g,' ').trim())
    .join(' | ');
}

function exportFilteredOrdersCsv(){
  const rows=filteredOrders();
  if(!rows.length){
    ordersError.textContent='There are no matching orders to export.';
    return;
  }
  ordersError.textContent='';
  const headers=['Order Number','Created At','Status','First Name','Last Name','Phone','Governorate','Area','Building','Address','Items','Subtotal','Shipping','Discount','Coupon','Total','Payment Method','Notes'];
  const data=rows.map(o=>[
    o.order_number,fmtDate(o.created_at),prettyStatus(o.status),o.first_name,o.last_name,o.phone,o.governorate,o.area,o.building,o.address,
    formatOrderItemsForExport(o.id),o.subtotal,o.shipping,o.discount,o.coupon_code,o.total,o.payment_method,o.notes
  ]);
  const csv='\uFEFF'+[headers,...data].map(row=>row.map(csvSafe).join(',')).join('\r\n');
  const blob=new Blob([csv],{type:'text/csv;charset=utf-8'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  const today=new Date().toISOString().slice(0,10);
  a.href=url;
  a.download=`DOMARO-orders-${today}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),500);
}

function orderSummaryText(order){
  const items=orderItems.filter(i=>i.order_id===order.id);
  const lines=items.map(i=>`- ${i.product_name} · ${i.size_ml} ML · Qty ${i.quantity} · ${money(i.line_total)}`);
  return [
    `DOMARO ORDER ${order.order_number}`,
    `Date: ${fmtDate(order.created_at)}`,
    `Status: ${prettyStatus(order.status)}`,
    '',
    `Customer: ${(order.first_name || '')} ${(order.last_name || '')}`.trim(),
    `Phone: ${order.phone || ''}`,
    `Delivery: ${[order.governorate,order.area,order.building,order.address].filter(Boolean).join(' · ')}`,
    '',
    'Items:',
    ...(lines.length?lines:['- No items found']),
    '',
    `Subtotal: ${money(order.subtotal)}`,
    Number(order.discount||0)>0 ? `Discount${order.coupon_code?` (${order.coupon_code})`:''}: -${money(order.discount)}` : null,
    `Shipping: ${money(order.shipping)}`,
    `Total: ${money(order.total)}`,
    `Payment: ${order.payment_method || ''}`,
    order.notes ? `Note: ${order.notes}` : null
  ].filter(v=>v!==null).join('\n');
}

async function copyCurrentOrderSummary(){
  const order=allOrders.find(o=>o.id===currentDetailOrderId);
  if(!order) return;
  const text=orderSummaryText(order);
  try{
    await navigator.clipboard.writeText(text);
  }catch(_){
    const ta=document.createElement('textarea');
    ta.value=text; ta.style.position='fixed'; ta.style.opacity='0';
    document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
  }
  if(copyOrderSummaryBtn){
    const old=copyOrderSummaryBtn.textContent;
    copyOrderSummaryBtn.textContent='COPIED';
    setTimeout(()=>{copyOrderSummaryBtn.textContent=old;},1200);
  }
}

function printCurrentOrder(){
  const order=allOrders.find(o=>o.id===currentDetailOrderId);
  if(!order) return;
  const items=orderItems.filter(i=>i.order_id===order.id);
  const itemsHtml=items.map(i=>`<tr><td>${esc(i.product_name)}</td><td>${esc(i.size_ml)} ML</td><td>${esc(i.quantity)}</td><td>${money(i.line_total)}</td></tr>`).join('');
  const popup=window.open('','_blank','width=900,height=700');
  if(!popup){ ordersError.textContent='Please allow pop-ups to print this order.'; return; }
  popup.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(order.order_number)}</title><style>
    body{font-family:Arial,sans-serif;color:#17130f;margin:36px}h1{font-size:24px;letter-spacing:2px;margin:0 0 4px}.brand{font-size:12px;letter-spacing:4px}.muted{color:#6f665d;font-size:12px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin:28px 0}.box{border-top:1px solid #bbb;padding-top:12px}h3{font-size:10px;letter-spacing:1.5px}.box p{margin:5px 0;font-size:13px}table{width:100%;border-collapse:collapse;margin-top:22px}th,td{text-align:left;padding:10px;border-bottom:1px solid #ddd;font-size:12px}th{font-size:9px;letter-spacing:1px}.totals{margin-left:auto;width:320px;margin-top:24px}.row{display:flex;justify-content:space-between;padding:6px 0}.total{font-size:18px;font-weight:700;border-top:2px solid #17130f;margin-top:6px;padding-top:10px}.note{margin-top:25px;padding:14px;background:#f5f1ea}@media print{body{margin:18mm}}
  </style></head><body>
    <div class="brand">DOMARO</div><h1>${esc(order.order_number)}</h1><div class="muted">${esc(fmtDate(order.created_at))} · ${esc(prettyStatus(order.status))}</div>
    <div class="grid"><div class="box"><h3>CUSTOMER</h3><p><b>${esc(order.first_name)} ${esc(order.last_name)}</b></p><p>${esc(order.phone)}</p></div><div class="box"><h3>DELIVERY</h3><p>${esc([order.governorate,order.area].filter(Boolean).join(' · '))}</p><p>${esc([order.building,order.address].filter(Boolean).join(' · '))}</p></div></div>
    <table><thead><tr><th>PRODUCT</th><th>SIZE</th><th>QTY</th><th>TOTAL</th></tr></thead><tbody>${itemsHtml || '<tr><td colspan="4">No items found.</td></tr>'}</tbody></table>
    <div class="totals"><div class="row"><span>Subtotal</span><b>${money(order.subtotal)}</b></div>${Number(order.discount||0)>0?`<div class="row"><span>Discount${order.coupon_code?` (${esc(order.coupon_code)})`:''}</span><b>− ${money(order.discount)}</b></div>`:''}<div class="row"><span>Shipping</span><b>${money(order.shipping)}</b></div><div class="row total"><span>Total</span><b>${money(order.total)}</b></div><div class="row"><span>Payment</span><span>${esc(order.payment_method || '')}</span></div></div>
    ${order.notes?`<div class="note"><b>Customer note:</b> ${esc(order.notes)}</div>`:''}
    <script>window.onload=()=>{window.print();};<\/script></body></html>`);
  popup.document.close();
}
function orderItemCount(orderId){
  return orderItems
    .filter(i=>i.order_id===orderId)
    .reduce((sum,i)=>sum+Number(i.quantity || 0),0);
}

function renderOrders(){
  const list=filteredOrders();
  const totalPages=Math.max(1,Math.ceil(list.length/ordersPerPage));
  if(ordersPage>totalPages) ordersPage=totalPages;
  if(ordersPage<1) ordersPage=1;

  if(ordersCountLabel){
    ordersCountLabel.textContent=`${list.length.toLocaleString('en-EG')} ${list.length===1?'order':'orders'}`;
  }

  if(!list.length){
    ordersList.innerHTML='<div class="admin-empty">No matching orders.</div>';
    if(ordersPagination) ordersPagination.hidden=true;
    return;
  }

  const startIndex=(ordersPage-1)*ordersPerPage;
  const pageOrders=list.slice(startIndex,startIndex+ordersPerPage);

  ordersList.innerHTML=pageOrders.map(order=>{
    const itemCount=orderItemCount(order.id);
    const customer=`${order.first_name || ''} ${order.last_name || ''}`.trim();
    const destination=[order.governorate,order.area].filter(Boolean).join(' · ');

    return `<article class="admin-order-card admin-order-card-compact" data-order-id="${esc(order.id)}">
      <div class="admin-order-head compact-order-head">
        <div>
          <div class="admin-order-number">${esc(order.order_number)}</div>
          <div class="admin-order-date">${esc(fmtDate(order.created_at))}</div>
        </div>
        <span class="status-badge status-${esc(order.status)}">${esc(prettyStatus(order.status))}</span>
      </div>

      <div class="order-summary-grid">
        <div><span>CUSTOMER</span><b>${esc(customer || '—')}</b><small>${esc(order.phone || '')}</small></div>
        <div><span>DELIVERY</span><b>${esc(destination || '—')}</b><small>${esc(order.address || '')}</small></div>
        <div><span>ITEMS</span><b>${itemCount.toLocaleString('en-EG')}</b><small>${itemCount===1?'item':'items'}</small></div>
        <div><span>TOTAL</span><b>${money(order.total)}</b><small>${esc(order.payment_method || '')}</small></div>
      </div>

      <div class="admin-order-actions compact-order-actions">
        <button class="admin-view-order admin-secondary-btn" type="button" data-order-id="${esc(order.id)}">VIEW DETAILS</button>
        <label>STATUS
          <select class="order-status-select" data-order-id="${esc(order.id)}">
            ${['new','confirmed','shipped','delivered','cancelled'].map(s=>`<option value="${s}" ${s===order.status?'selected':''}>${prettyStatus(s)}</option>`).join('')}
          </select>
        </label>
        <button class="admin-save-status" data-order-id="${esc(order.id)}">SAVE STATUS</button>
      </div>
    </article>`;
  }).join('');

  document.querySelectorAll('.admin-view-order').forEach(btn=>{
    btn.addEventListener('click',()=>openOrderDetails(btn.dataset.orderId));
  });

  document.querySelectorAll('.admin-save-status').forEach(btn=>{
    btn.addEventListener('click',async()=>{
      const orderId=btn.dataset.orderId;
      const select=document.querySelector(`.order-status-select[data-order-id="${CSS.escape(orderId)}"]`);
      await updateOrderStatus(orderId,select.value,btn);
    });
  });

  if(ordersPagination){
    ordersPagination.hidden=totalPages<=1;
    ordersPageLabel.textContent=`Page ${ordersPage} of ${totalPages}`;
    ordersPrevPage.disabled=ordersPage<=1;
    ordersNextPage.disabled=ordersPage>=totalPages;
  }
}

function orderActivityActor(activity){
  if(activity?.actor_email) return activity.actor_email;
  if(activity?.event_type==='created') return 'Customer checkout';
  return 'DOMARO system';
}

function renderOrderTimeline(events){
  if(!Array.isArray(events) || !events.length){
    return '<div class="order-timeline-empty">No order activity yet.</div>';
  }

  return events.map(activity=>{
    const type=activity.event_type || '';
    const actor=orderActivityActor(activity);
    let icon='•';
    let title='Order activity';
    let body='';

    if(type==='created'){
      icon='+';
      title='Order placed';
      body=`<div class="order-timeline-status"><span class="status-badge status-new">New</span></div>`;
    }else if(type==='status_change'){
      icon='↻';
      title='Status changed';
      body=`<div class="order-timeline-status">
        <span class="status-badge status-${esc(activity.old_status)}">${esc(prettyStatus(activity.old_status))}</span>
        <span class="timeline-arrow">→</span>
        <span class="status-badge status-${esc(activity.new_status)}">${esc(prettyStatus(activity.new_status))}</span>
      </div>`;
    }else if(type==='admin_note'){
      icon='N';
      title='Admin note';
      body=`<p class="order-timeline-note">${esc(activity.note || '')}</p>`;
    }

    return `<article class="order-timeline-event order-timeline-${esc(type)}">
      <div class="order-timeline-marker">${esc(icon)}</div>
      <div class="order-timeline-body">
        <div class="order-timeline-event-head">
          <b>${esc(title)}</b>
          <time>${esc(fmtDate(activity.created_at))}</time>
        </div>
        ${body}
        <small>${esc(actor)}</small>
      </div>
    </article>`;
  }).join('');
}

async function loadOrderActivity(orderId){
  const response=await fetch(
    `${SUPABASE_URL}/rest/v1/order_activity?select=id,order_id,event_type,old_status,new_status,note,actor_email,created_at&order_id=eq.${encodeURIComponent(orderId)}&order=created_at.desc,id.desc`,
    {headers:authHeaders()}
  );
  const data=await response.json().catch(()=>[]);
  if(response.status===401){
    clearSession();
    showLogin('Your session expired. Please sign in again.');
    throw new Error('Your session has expired.');
  }
  if(response.status===403) throw new Error('This account does not have permission to view order history.');
  if(!response.ok) throw new Error(data?.message || 'Could not load order history.');
  return Array.isArray(data)?data:[];
}

async function refreshOrderTimeline(orderId){
  const list=document.getElementById('order-timeline-list');
  const errorEl=document.getElementById('order-timeline-error');
  if(!list) return;
  list.innerHTML='<div class="order-timeline-loading">Loading order history…</div>';
  if(errorEl) errorEl.textContent='';
  try{
    const activity=await loadOrderActivity(orderId);
    if(currentDetailOrderId!==orderId) return;
    list.innerHTML=renderOrderTimeline(activity);
  }catch(err){
    if(currentDetailOrderId!==orderId) return;
    list.innerHTML='';
    if(errorEl) errorEl.textContent=err.message || 'Could not load order history.';
  }
}

async function addOrderAdminNote(orderId,form){
  const textarea=form.querySelector('#order-admin-note');
  const button=form.querySelector('button[type="submit"]');
  const errorEl=document.getElementById('order-admin-note-error');
  const note=textarea?.value.trim() || '';
  if(!note){
    if(errorEl) errorEl.textContent='Write an admin note first.';
    textarea?.focus();
    return;
  }

  const oldText=button?.textContent || 'ADD NOTE';
  if(button){button.disabled=true;button.textContent='SAVING…';}
  if(errorEl) errorEl.textContent='';

  try{
    const response=await fetch(`${SUPABASE_URL}/rest/v1/rpc/add_order_note`,{
      method:'POST',
      headers:authHeaders({'Content-Type':'application/json'}),
      body:JSON.stringify({p_order_id:orderId,p_note:note})
    });
    const data=await response.json().catch(()=>null);
    if(response.status===401){clearSession();showLogin('Your session expired. Please sign in again.');return;}
    if(response.status===403) throw new Error('This account does not have permission to add order notes.');
    if(!response.ok) throw new Error(data?.message || 'Could not add admin note.');
    if(textarea) textarea.value='';
    await refreshOrderTimeline(orderId);
  }catch(err){
    if(errorEl) errorEl.textContent=err.message || 'Could not add admin note.';
  }finally{
    if(button){button.disabled=false;button.textContent=oldText;}
  }
}

async function openOrderDetails(orderId){
  const order=allOrders.find(o=>o.id===orderId);
  if(!order || !orderDetailsModal || !orderDetailsContent) return;
  currentDetailOrderId=orderId;

  const items=orderItems.filter(i=>i.order_id===order.id);
  const productsHtml=items.map(i=>`
    <div class="admin-order-item">
      <div><b>${esc(i.product_name)}</b><span>${esc(i.size_ml)} ML · Qty ${esc(i.quantity)}</span></div>
      <strong>${money(i.line_total)}</strong>
    </div>`).join('');

  orderDetailsTitle.textContent=order.order_number || 'ORDER';
  orderDetailsContent.innerHTML=`
    <div class="order-detail-topline">
      <span>${esc(fmtDate(order.created_at))}</span>
      <span class="status-badge status-${esc(order.status)}">${esc(prettyStatus(order.status))}</span>
    </div>

    <div class="admin-order-grid order-modal-grid">
      <div class="admin-order-section"><h3>CUSTOMER</h3><p><b>${esc(order.first_name)} ${esc(order.last_name)}</b></p><p><a href="tel:${esc(order.phone)}">${esc(order.phone)}</a></p></div>
      <div class="admin-order-section"><h3>DELIVERY</h3><p>${esc(order.governorate)} · ${esc(order.area)}</p><p>${esc(order.address)}</p>${order.building?`<p>${esc(order.building)}</p>`:''}</div>
      <div class="admin-order-section"><h3>PAYMENT</h3><p>${esc(order.payment_method)}</p><p><b>${money(order.total)}</b></p></div>
    </div>

    <div class="admin-items-block"><h3>ITEMS</h3>${productsHtml || '<div class="meta">No items found.</div>'}</div>
    <div class="admin-order-totals order-modal-totals"><span>Subtotal: <b>${money(order.subtotal)}</b></span>${Number(order.discount||0)>0?`<span>Discount${order.coupon_code?` (${esc(order.coupon_code)})`:''}: <b>− ${money(order.discount)}</b></span>`:''}<span>Shipping: <b>${money(order.shipping)}</b></span><span>Total: <b>${money(order.total)}</b></span></div>
    ${order.notes?`<div class="admin-note"><b>Customer note:</b> ${esc(order.notes)}</div>`:''}

    <section class="order-contact-workspace">
      <div class="order-contact-head">
        <div><span>CUSTOMER COMMUNICATION</span><h3>CONTACT CUSTOMER</h3></div>
        <small>Prepare the message here, then copy it or open WhatsApp. Nothing is auto-sent.</small>
      </div>
      <div class="order-contact-meta">
        <div><span>PHONE</span><b>${esc(order.phone || '—')}</b></div>
        <div><span>CURRENT STATUS</span><b>${esc(prettyStatus(order.status))}</b></div>
      </div>
      <label class="order-message-template-label" for="order-message-template">MESSAGE TEMPLATE</label>
      <select id="order-message-template" class="order-message-template">
        <option value="received">ORDER RECEIVED</option>
        <option value="confirmed">ORDER CONFIRMED</option>
        <option value="shipped">ORDER SHIPPED</option>
        <option value="delivered">ORDER DELIVERED</option>
        <option value="cancelled">ORDER CANCELLED</option>
      </select>
      <textarea id="order-customer-message" class="order-customer-message" rows="5" maxlength="1500"></textarea>
      <div class="order-contact-actions">
        <a class="admin-secondary-btn" href="tel:${esc(order.phone || '')}">CALL</a>
        <button id="copy-customer-message" class="admin-secondary-btn" type="button">COPY MESSAGE</button>
        <button id="open-order-whatsapp" class="admin-primary-btn" type="button">OPEN WHATSAPP</button>
      </div>
      <div id="order-contact-feedback" class="order-contact-feedback" aria-live="polite"></div>
    </section>

    <section class="order-history-workspace">
      <div class="order-history-head">
        <div><span>INTERNAL WORKSPACE</span><h3>ORDER TIMELINE</h3></div>
        <small>History is recorded automatically from V24 onward.</small>
      </div>

      <form id="order-admin-note-form" class="order-admin-note-form">
        <label for="order-admin-note">ADMIN NOTE</label>
        <div class="order-admin-note-row">
          <textarea id="order-admin-note" maxlength="2000" placeholder="Add an internal note for the team…" required></textarea>
          <button class="admin-primary-btn" type="submit">ADD NOTE</button>
        </div>
        <div id="order-admin-note-error" class="admin-error"></div>
      </form>

      <div id="order-timeline-error" class="admin-error"></div>
      <div id="order-timeline-list" class="order-timeline-list"></div>
    </section>
  `;

  orderDetailsModal.hidden=false;
  document.body.style.overflow='hidden';

  const noteForm=document.getElementById('order-admin-note-form');
  noteForm?.addEventListener('submit',e=>{
    e.preventDefault();
    addOrderAdminNote(orderId,noteForm);
  });

  const messageTemplate=document.getElementById('order-message-template');
  const messageBox=document.getElementById('order-customer-message');
  const contactFeedback=document.getElementById('order-contact-feedback');
  const copyMessageBtn=document.getElementById('copy-customer-message');
  const openOrderWhatsAppBtn=document.getElementById('open-order-whatsapp');
  const defaultTemplate=defaultMessageTemplateForStatus(order.status);
  if(messageTemplate) messageTemplate.value=defaultTemplate;
  if(messageBox) messageBox.value=buildOrderCustomerMessage(order,defaultTemplate);

  messageTemplate?.addEventListener('change',()=>{
    if(messageBox) messageBox.value=buildOrderCustomerMessage(order,messageTemplate.value);
    if(contactFeedback) contactFeedback.textContent='';
  });

  copyMessageBtn?.addEventListener('click',async()=>{
    if(contactFeedback) contactFeedback.textContent='';
    try{
      await copyTextToClipboard(messageBox?.value || '');
      if(contactFeedback) contactFeedback.textContent='Message copied.';
    }catch(err){
      if(contactFeedback) contactFeedback.textContent=err.message || 'Could not copy message.';
    }
  });

  openOrderWhatsAppBtn?.addEventListener('click',()=>{
    if(contactFeedback) contactFeedback.textContent='';
    try{
      openWhatsApp(order.phone,messageBox?.value || '');
    }catch(err){
      if(contactFeedback) contactFeedback.textContent=err.message || 'Could not open WhatsApp.';
    }
  });

  await refreshOrderTimeline(orderId);
}

function closeOrderDetails(){
  if(!orderDetailsModal) return;
  orderDetailsModal.hidden=true;
  currentDetailOrderId=null;
  document.body.style.overflow='';
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
    if(response.status===403) throw new Error('This account does not have permission to update order status.');
    if(!response.ok) throw new Error(data?.message || 'Could not update order status.');
    const target=allOrders.find(o=>o.id===orderId);
    if(target) target.status=data?.status || status;
    renderStats();
    renderOrders();
    await loadDashboardStats();
    if(currentDetailOrderId===orderId) await openOrderDetails(orderId);
  }catch(err){
    ordersError.textContent=err.message || 'Could not update order status.';
    button.disabled=false;
    button.textContent=original;
  }
}

// ---------- PRODUCT MANAGEMENT ----------
function getLowStockThreshold(){
  const raw=Number(productLowThreshold?.value || localStorage.getItem('domaro_low_stock_threshold') || 5);
  if(!Number.isFinite(raw)) return 5;
  return Math.max(1,Math.min(999,Math.floor(raw)));
}

function isTrackedStock(product){
  return product?.stock_quantity !== null && product?.stock_quantity !== undefined;
}

function isLowStock(product){
  if(!isTrackedStock(product)) return false;
  const qty=Number(product.stock_quantity);
  return qty > 0 && qty <= getLowStockThreshold();
}

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
  const lowEl=document.getElementById('product-stat-low');
  if(lowEl) lowEl.textContent=allProducts.filter(isLowStock).length;
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
      (filter==='low' && isLowStock(p)) ||
      (filter==='out' && !p.in_stock) ||
      (filter==='tracked' && isTrackedStock(p));
    return matchesSearch && matchesFilter;
  });
}

function renderProductsAdmin(){
  const list=filteredProducts();
  if(!list.length){
    productsList.innerHTML='<div class="admin-empty">No matching products.</div>';
    return;
  }

  productsList.innerHTML=list.map(p=>{
    const tracked=isTrackedStock(p);
    const low=isLowStock(p);
    const qty=tracked ? Number(p.stock_quantity) : null;
    const stockState=!p.in_stock || qty===0 ? 'OUT OF STOCK' : (low ? 'LOW STOCK' : 'IN STOCK');
    const stockClass=!p.in_stock || qty===0 ? 'mini-out' : (low ? 'mini-low' : 'mini-stock');
    const adjustControls=tracked && !p.has_variants ? `
      <div class="quick-stock-adjuster" aria-label="Quick stock adjustment for ${esc(p.name)}">
        <button class="admin-secondary-btn stock-adjust-btn" type="button" data-id="${esc(p.id)}" data-delta="-1" ${qty<=0?'disabled':''}>−1</button>
        <span>${esc(qty)}</span>
        <button class="admin-secondary-btn stock-adjust-btn" type="button" data-id="${esc(p.id)}" data-delta="1">+1</button>
      </div>` : '';

    return `
    <article class="admin-product-card ${low?'low-stock-card':''}">
      <div class="admin-product-image"><img src="${esc(p.image_path || 'assets/hero.svg')}" alt="${esc(p.name)}"></div>
      <div class="admin-product-main">
        <div class="admin-product-title-row">
          <div><h3>${esc(p.name)}</h3><span>${p.brand?`${esc(String(p.brand).toUpperCase())} · `:''}${esc(String(p.category).toUpperCase())} · ${esc(p.size_ml)} ML</span></div>
          <div class="admin-product-badges">
            <span class="mini-status ${p.active?'mini-live':'mini-hidden'}">${p.active?'LIVE':'HIDDEN'}</span>
            <span class="mini-status ${stockClass}">${stockState}</span>
          </div>
        </div>
        <div class="admin-product-price">${money(p.price)}</div>
        <div class="inventory-stock-row">
          <div class="admin-stock-qty">${tracked ? `STOCK: ${esc(qty)} UNIT${qty===1?'':'S'}` : 'STOCK: NOT TRACKED'}</div>
          ${adjustControls}
        </div>
        ${low?`<div class="low-stock-warning">LOW STOCK ALERT · ${esc(qty)} UNIT${qty===1?'':'S'} LEFT</div>`:''}
        <p>${esc(p.description || 'No description yet.')}</p>
        <div class="admin-product-actions">
          <button class="admin-secondary-btn edit-product-btn" data-id="${esc(p.id)}">EDIT</button>
          ${p.has_variants ? '' : `<button class="admin-secondary-btn quick-stock-btn" data-id="${esc(p.id)}">${p.in_stock?'MARK OUT OF STOCK':'MARK IN STOCK'}</button>`}
          <button class="admin-secondary-btn quick-live-btn" data-id="${esc(p.id)}">${p.active?'HIDE':'MAKE LIVE'}</button>
          <button class="admin-secondary-btn v30-manage-variants-btn" type="button" data-id="${esc(p.id)}">VARIANTS</button>
          <button class="admin-secondary-btn v30-manage-gallery-btn" type="button" data-id="${esc(p.id)}">GALLERY</button>
          ${String(adminProfile?.role || '').toLowerCase()==='owner' ? `<button class="admin-secondary-btn admin-danger-btn delete-product-btn" type="button" data-id="${esc(p.id)}">DELETE</button>` : ''}
        </div>
      </div>
    </article>`;
  }).join('');

  document.querySelectorAll('.edit-product-btn').forEach(btn=>btn.addEventListener('click',()=>openProductModal(allProducts.find(p=>p.id===btn.dataset.id))));
  document.querySelectorAll('.quick-stock-btn').forEach(btn=>btn.addEventListener('click',()=>{
    const p=allProducts.find(x=>x.id===btn.dataset.id);
    if(!p) return;
    if(p.stock_quantity !== null && Number(p.stock_quantity) === 0){
      productsError.textContent='Stock is tracked at 0. Use +1 or edit the product before marking it in stock.';
      return;
    }
    quickUpdateProduct(btn.dataset.id,'in_stock');
  }));
  document.querySelectorAll('.quick-live-btn').forEach(btn=>btn.addEventListener('click',()=>quickUpdateProduct(btn.dataset.id,'active')));
  document.querySelectorAll('.stock-adjust-btn').forEach(btn=>btn.addEventListener('click',()=>adjustProductStock(btn)));
  document.querySelectorAll('.delete-product-btn').forEach(btn=>btn.addEventListener('click',()=>deleteProductOwnerOnly(btn.dataset.id)));
}

async function deleteManagedProductImage(imagePath){
  const marker='/storage/v1/object/public/products/';
  const raw=String(imagePath || '');
  const index=raw.indexOf(marker);
  if(index<0) return;
  const objectPath=raw.slice(index+marker.length);
  if(!objectPath) return;
  try{
    await fetch(`${SUPABASE_URL}/storage/v1/object/products/${objectPath.split('/').map(encodeURIComponent).join('/')}`,{
      method:'DELETE',
      headers:authHeaders()
    });
  }catch(_){}
}

async function deleteProductOwnerOnly(productId){
  if(String(adminProfile?.role || '').toLowerCase()!=='owner'){
    productsError.textContent='Only the owner can delete products.';
    return;
  }
  const product=allProducts.find(p=>p.id===productId);
  if(!product) return;
  const confirmed=window.confirm(`Delete ${product.name}?\n\nThis removes the product from the catalog. Existing order history will stay intact.`);
  if(!confirmed) return;

  productsError.textContent='';
  try{
    let galleryRows=[];
    try{
      const galleryResponse=await fetch(`${SUPABASE_URL}/rest/v1/product_images?select=image_path&product_id=eq.${encodeURIComponent(productId)}`,{headers:authHeaders()});
      if(galleryResponse.ok) galleryRows=await galleryResponse.json().catch(()=>[]);
    }catch(_){}
    const response=await fetch(`${SUPABASE_URL}/rest/v1/products?id=eq.${encodeURIComponent(productId)}`,{
      method:'DELETE',
      headers:authHeaders({'Prefer':'return=representation'})
    });
    const data=await response.json().catch(()=>[]);
    if(response.status===401){clearSession();showLogin('Your session expired. Please sign in again.');return;}
    if(!response.ok) throw new Error(data?.message || data?.details || 'Could not delete product.');

    await deleteManagedProductImage(product.image_path);
    for(const image of galleryRows){ await deleteManagedProductImage(image.image_path); }
    allProducts=allProducts.filter(p=>p.id!==productId);
    renderProductStats();
    renderProductsAdmin();
    window.alert(`${product.name} was deleted.`);
  }catch(err){
    productsError.textContent=err.message || 'Could not delete product.';
  }
}

async function adjustProductStock(button){
  const productId=button.dataset.id;
  const delta=Number(button.dataset.delta);
  if(!productId || !Number.isInteger(delta) || delta===0) return;
  productsError.textContent='';
  const original=button.textContent;
  button.disabled=true;
  button.textContent='…';
  try{
    const response=await fetch(`${SUPABASE_URL}/rest/v1/rpc/adjust_product_stock`,{
      method:'POST',
      headers:authHeaders({'Content-Type':'application/json'}),
      body:JSON.stringify({p_product_id:productId,p_delta:delta})
    });
    const data=await response.json().catch(()=>null);
    if(response.status===401){clearSession();showLogin('Your session expired. Please sign in again.');return;}
    if(!response.ok) throw new Error(data?.message || data?.details || 'Could not adjust stock.');
    const updated=data && typeof data==='object' ? data : null;
    const product=allProducts.find(p=>p.id===productId);
    if(product && updated) Object.assign(product,updated);
    else await loadProducts();
    renderProductStats();
    renderProductsAdmin();
  }catch(err){
    productsError.textContent=err.message || 'Could not adjust stock.';
    button.disabled=false;
    button.textContent=original;
  }
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
  document.getElementById('product-cost-price').value=product?.cost_price ?? '';
  document.getElementById('product-description').value=product?.description || '';
  document.getElementById('product-story').value=product?.story || '';
  document.getElementById('product-top-notes').value=product?.top_notes || '';
  document.getElementById('product-heart-notes').value=product?.heart_notes || '';
  document.getElementById('product-base-notes').value=product?.base_notes || '';
  document.getElementById('product-key-notes').value=product?.key_notes || '';
  document.getElementById('product-stock-quantity').value=product?.stock_quantity ?? '';
  document.getElementById('product-stock').checked=product ? Boolean(product.in_stock) : true;
  document.getElementById('product-active').checked=product ? Boolean(product.active) : true;

  const variantManaged=Boolean(product?.has_variants);
  ['product-size','product-price','product-cost-price','product-stock-quantity','product-stock'].forEach(id=>{
    const field=document.getElementById(id);
    if(field) field.disabled=variantManaged;
  });
  const variantNote=document.getElementById('product-variant-managed-note');
  if(variantNote) variantNote.hidden=!variantManaged;

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
  const costRaw=document.getElementById('product-cost-price').value.trim();
  const cost_price=costRaw==='' ? null : Number(costRaw);
  const description=document.getElementById('product-description').value.trim();
  const story=document.getElementById('product-story').value.trim();
  const top_notes=document.getElementById('product-top-notes').value.trim();
  const heart_notes=document.getElementById('product-heart-notes').value.trim();
  const base_notes=document.getElementById('product-base-notes').value.trim();
  const key_notes=document.getElementById('product-key-notes').value.trim();
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

  if(!name || !size_ml || price<0 || (cost_price!==null && cost_price<0)){
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
      description,
      story:story || null,
      top_notes:top_notes || null,
      heart_notes:heart_notes || null,
      base_notes:base_notes || null,
      key_notes:key_notes || null,
      active,
      image_path,
      updated_at:new Date().toISOString()
    };
    if(!editingProduct?.has_variants){
      Object.assign(payload,{size_ml,price,cost_price,stock_quantity,in_stock});
    }

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
          <div><strong>${esc(couponDiscountLabel(c))}</strong><span>MINIMUM ORDER: ${money(c.min_order_amount)}${c.max_discount_amount!=null ? ` · MAX DISCOUNT: ${money(c.max_discount_amount)}` : ''}</span></div>
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
  document.getElementById('coupon-max-discount').value=coupon?.max_discount_amount ?? '';
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
  const maxDiscountRaw=document.getElementById('coupon-max-discount').value.trim();
  const usageRaw=document.getElementById('coupon-usage-limit').value.trim();
  const expiryRaw=document.getElementById('coupon-expiry').value;
  const active=document.getElementById('coupon-active').checked;

  if(!code){couponFormError.textContent='Coupon code is required.';return;}
  if(!(value>0)){couponFormError.textContent='Discount value must be greater than zero.';return;}
  if(type==='percent' && value>100){couponFormError.textContent='Percentage discount cannot exceed 100%.';return;}
  if(maxDiscountRaw && !(Number(maxDiscountRaw)>0)){couponFormError.textContent='Maximum discount must be greater than zero or left blank.';return;}

  const payload={
    code,
    discount_type:type,
    discount_value:value,
    max_discount_amount:maxDiscountRaw ? Number(maxDiscountRaw) : null,
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
  ordersList.innerHTML=''; if(customersList) customersList.innerHTML=''; productsList.innerHTML=''; if(adminsList) adminsList.innerHTML='';
  showLogin();
});
refreshDashboardBtn.addEventListener('click',loadDashboardStats);
if(dashboardPeriod){
  const savedDashboardPeriod=localStorage.getItem('domaro_dashboard_period');
  if(['0','7','30','90'].includes(savedDashboardPeriod || '')) dashboardPeriod.value=savedDashboardPeriod;
  dashboardPeriod.addEventListener('change',()=>{
    localStorage.setItem('domaro_dashboard_period',dashboardPeriod.value);
    dashboardStats=null;
    loadDashboardStats();
  });
}
exportDashboardCsvBtn?.addEventListener('click',exportDashboardReport);
refreshBtn.addEventListener('click',loadOrders);
refreshCustomersBtn?.addEventListener('click',loadCustomers);
customerSearch?.addEventListener('input',renderCustomers);
customerFilter?.addEventListener('change',renderCustomers);
exportCustomersCsvBtn?.addEventListener('click',exportCustomersCsv);
searchInput.addEventListener('input',()=>{ordersPage=1;renderOrders();});
statusFilter.addEventListener('change',()=>{ordersPage=1;renderOrders();});
ordersDateFrom?.addEventListener('change',()=>{ordersPage=1;renderOrders();});
ordersDateTo?.addEventListener('change',()=>{ordersPage=1;renderOrders();});
clearOrderFiltersBtn?.addEventListener('click',()=>{
  searchInput.value=''; statusFilter.value='all';
  if(ordersDateFrom) ordersDateFrom.value='';
  if(ordersDateTo) ordersDateTo.value='';
  ordersPage=1; renderOrders();
});
exportOrdersCsvBtn?.addEventListener('click',exportFilteredOrdersCsv);
copyOrderSummaryBtn?.addEventListener('click',copyCurrentOrderSummary);
printOrderBtn?.addEventListener('click',printCurrentOrder);
ordersPrevPage?.addEventListener('click',()=>{if(ordersPage>1){ordersPage-=1;renderOrders();ordersPanel.scrollIntoView({behavior:'smooth',block:'start'});}});
ordersNextPage?.addEventListener('click',()=>{const pages=Math.max(1,Math.ceil(filteredOrders().length/ordersPerPage));if(ordersPage<pages){ordersPage+=1;renderOrders();ordersPanel.scrollIntoView({behavior:'smooth',block:'start'});}});
document.querySelectorAll('[data-close-order-modal]').forEach(el=>el.addEventListener('click',closeOrderDetails));
document.querySelectorAll('[data-close-customer-modal]').forEach(el=>el.addEventListener('click',closeCustomerProfile));
document.addEventListener('keydown',e=>{
  if(e.key!=='Escape') return;
  if(customerDetailsModal && !customerDetailsModal.hidden) closeCustomerProfile();
  else if(orderDetailsModal && !orderDetailsModal.hidden) closeOrderDetails();
});
productSearch.addEventListener('input',renderProductsAdmin);
productFilter.addEventListener('change',renderProductsAdmin);
if(productLowThreshold){
  const savedThreshold=Number(localStorage.getItem('domaro_low_stock_threshold') || 5);
  if(Number.isFinite(savedThreshold) && savedThreshold>=1) productLowThreshold.value=String(Math.min(999,Math.floor(savedThreshold)));
  productLowThreshold.addEventListener('change',()=>{
    const value=getLowStockThreshold();
    productLowThreshold.value=String(value);
    localStorage.setItem('domaro_low_stock_threshold',String(value));
    renderProductStats();
    renderProductsAdmin();
  });
}

['pointerdown','keydown','touchstart'].forEach(eventName=>{
  document.addEventListener(eventName,()=>{
    if(accessToken && !dashboardSection.hidden) resetAdminIdleTimer();
  },{passive:true});
});

document.addEventListener('visibilitychange',()=>{
  if(document.visibilityState==='visible' && accessToken && !dashboardSection.hidden) resetAdminIdleTimer();
});

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
