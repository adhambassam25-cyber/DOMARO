
const { SUPABASE_URL, SUPABASE_KEY } = window.DOMARO_ADMIN_CONFIG;

const loginSection = document.getElementById('admin-login');
const dashboardSection = document.getElementById('admin-dashboard');
const loginForm = document.getElementById('admin-login-form');
const loginError = document.getElementById('login-error');
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const adminUserLabel = document.getElementById('admin-user-label');
const enableNotificationsBtn = document.getElementById('enable-notifications-btn');

const ordersPanel = document.getElementById('admin-orders-panel');
const productsPanel = document.getElementById('admin-products-panel');

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
let editingProduct = null;
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
  const response=await fetch(`${SUPABASE_URL}/rest/v1/orders?select=id&limit=1`,{headers:authHeaders()});
  if(response.status===401) throw new Error('Your session has expired. Please sign in again.');
  if(response.status===403) throw new Error('This account does not have DOMARO admin access.');
  if(!response.ok){
    const data=await response.json().catch(()=>({}));
    throw new Error(data?.message || 'Could not verify admin access.');
  }
  return true;
}

function showDashboard(){
  loginSection.hidden=true;
  dashboardSection.hidden=false;
  logoutBtn.hidden=false;
  enableNotificationsBtn.hidden=false;
  updateNotificationButton();
  adminUserLabel.textContent=adminEmail || 'Admin';
}
function showLogin(message=''){
  dashboardSection.hidden=true;
  loginSection.hidden=false;
  logoutBtn.hidden=true;
  enableNotificationsBtn.hidden=true;
  stopOrderNotificationPolling();
  adminUserLabel.textContent='';
  if(message) loginError.textContent=message;
}
function clearSession(){
  accessToken='';
  adminEmail='';
  sessionStorage.removeItem('domaro_admin_access_token');
  sessionStorage.removeItem('domaro_admin_email');
}

function setTab(tab){
  document.querySelectorAll('.admin-tab').forEach(btn=>btn.classList.toggle('active',btn.dataset.adminTab===tab));
  ordersPanel.hidden = tab!=='orders';
  productsPanel.hidden = tab!=='products';
  if(tab==='products' && !allProducts.length) loadProducts();
}

document.querySelectorAll('.admin-tab').forEach(btn=>{
  btn.addEventListener('click',()=>setTab(btn.dataset.adminTab));
});

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
      <div class="admin-order-totals"><span>Subtotal: <b>${money(order.subtotal)}</b></span><span>Shipping: <b>${money(order.shipping)}</b></span><span>Total: <b>${money(order.total)}</b></span></div>
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
    const matchesSearch=!q || [p.name,p.id,p.category].join(' ').toLowerCase().includes(q);
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
          <div><h3>${esc(p.name)}</h3><span>${esc(String(p.category).toUpperCase())} · ${esc(p.size_ml)} ML</span></div>
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
  document.getElementById('product-category').value=product?.category || 'men';
  document.getElementById('product-size').value=product?.size_ml || 200;
  document.getElementById('product-price').value=product?.price || 2000;
  document.getElementById('product-description').value=product?.description || '';
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
  const category=document.getElementById('product-category').value;
  const size_ml=Number(document.getElementById('product-size').value);
  const price=Number(document.getElementById('product-price').value);
  const description=document.getElementById('product-description').value.trim();
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
      category,
      size_ml,
      price,
      description,
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


function updateNotificationButton(){
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
  if(!accessToken) return;
  notificationPollTimer=setInterval(checkForNewOrders,60000);
}

function stopOrderNotificationPolling(){
  if(notificationPollTimer){
    clearInterval(notificationPollTimer);
    notificationPollTimer=null;
  }
}

async function checkForNewOrders(){
  if(!accessToken) return;

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
    await loadOrders();
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
  allOrders=[]; orderItems=[]; allProducts=[];
  ordersList.innerHTML=''; productsList.innerHTML='';
  showLogin();
});
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
    await loadOrders();
    startOrderNotificationPolling();
  }catch(err){
    clearSession();
    showLogin(err.message || 'Please sign in again.');
  }
})();
