
const SUPABASE_URL = "https://zuqjxcsjjgotwwmlvxmf.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_gaSdKLisgpHYocKX5dYAmw_CZeW6s0c";
const SHIPPING_FEE = 80;

const fallbackProducts = [
  {
    id:'hook-blue', name:'HOOK BLUE', type:'Eau de Parfum', price:2000,
    size:'200 ML', size_ml:200, img:'assets/hook-blue.png', cat:'men',
    badge:'MEN', inStock:true, active:true,
    desc:'HOOK BLUE by Assaf. Fragrance notes and the final product description can be added once confirmed.'
  },
  {
    id:'arrogate-blue', name:'ARROGATE BLUE', type:'Eau de Parfum', price:2000,
    size:'200 ML', size_ml:200, img:'assets/arrogate-blue.png', cat:'men',
    badge:'MEN', inStock:true, active:true,
    desc:'ARROGATE BLUE by Assaf. Fragrance notes and the final product description can be added once confirmed.'
  },
  {
    id:'arrogate-pink', name:'ARROGATE PINK', type:'Eau de Parfum', price:2000,
    size:'200 ML', size_ml:200, img:'assets/arrogate-pink.png', cat:'women',
    badge:'WOMEN', inStock:true, active:true,
    desc:'ARROGATE PINK by Assaf. Fragrance notes and the final product description can be added once confirmed.'
  }
];

let products = [...fallbackProducts];

const money = n => Number(n || 0).toLocaleString('en-EG') + ' EGP';

function getCart(){ return JSON.parse(localStorage.getItem('domaro_cart') || '[]'); }
function setCart(cart){ localStorage.setItem('domaro_cart', JSON.stringify(cart)); updateCartCount(); }
function updateCartCount(){
  const count = getCart().reduce((a,x)=>a+x.qty,0);
  document.querySelectorAll('[data-cart-count]').forEach(el=>el.textContent=count);
}
function toast(msg){
  let el=document.querySelector('.toast');
  if(!el){ el=document.createElement('div'); el.className='toast'; document.body.appendChild(el); }
  el.textContent=msg; el.classList.add('show');
  clearTimeout(window.__toastTimer);
  window.__toastTimer=setTimeout(()=>el.classList.remove('show'),1700);
}
function addToCart(id, qty=1){
  const p=products.find(x=>x.id===id);
  if(!p || !p.inStock){ toast('This product is currently out of stock.'); return; }
  const cart=getCart();
  const item=cart.find(x=>x.id===id);
  if(item) item.qty += qty; else cart.push({id,qty});
  setCart(cart);
  toast('Added to cart');
}
function removeItem(id){
  setCart(getCart().filter(x=>x.id!==id));
  renderCart();
}

async function loadCatalog(){
  try{
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/products?select=id,name,category,size_ml,price,image_path,description,in_stock,stock_quantity,active&active=eq.true&order=created_at.asc`,
      { headers: { 'apikey': SUPABASE_PUBLISHABLE_KEY } }
    );
    const data = await response.json();
    if(!response.ok || !Array.isArray(data)) throw new Error(data?.message || 'Catalog unavailable');

    products = data.map(p=>({
      id:p.id,
      name:p.name,
      type:'Eau de Parfum',
      price:Number(p.price),
      size:`${p.size_ml} ML`,
      size_ml:Number(p.size_ml),
      img:p.image_path || 'assets/hero.svg',
      cat:p.category,
      badge:p.in_stock ? String(p.category).toUpperCase() : 'OUT OF STOCK',
      stockQuantity:p.stock_quantity === null ? null : Number(p.stock_quantity),
      inStock:Boolean(p.in_stock) && (p.stock_quantity === null || Number(p.stock_quantity) > 0),
      active:Boolean(p.active),
      desc:p.description || `${p.name} by DOMARO.`
    }));
  }catch(err){
    console.warn('Using local fallback catalog:', err);
    products=[...fallbackProducts];
  }
}

function productCard(p){
  return `<a class="product-card" href="product.html?id=${encodeURIComponent(p.id)}">
    <div class="product-img real-photo">
      <span class="badge ${p.inStock ? '' : 'badge-out'}">${p.inStock ? p.badge : 'OUT OF STOCK'}</span>
      <img src="${p.img}" alt="${p.name}">
    </div>
    <div class="product-info">
      <h3>${p.name}</h3>
      <div class="meta">${p.type} · ${p.size}</div>
      <div class="price-row"><span class="price">${money(p.price)}</span><span class="meta">${p.cat.toUpperCase()}</span></div>
    </div>
  </a>`;
}
function renderProducts(targetId, filter='all', limit=null){
  const el=document.getElementById(targetId);
  if(!el) return;
  let list=filter==='all' ? products : products.filter(p=>p.cat===filter);
  if(limit) list=list.slice(0,limit);
  el.innerHTML=list.length ? list.map(productCard).join('') : '<div class="empty" style="grid-column:1/-1">No products in this category yet.</div>';
}

function initFilters(){
  document.querySelectorAll('.filter-btn').forEach(btn=>{
    btn.addEventListener('click',()=>{
      document.querySelectorAll('.filter-btn').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      renderProducts('shop-products', btn.dataset.filter);
    });
  });
}

function renderProductDetail(){
  const detail=document.getElementById('product-detail');
  if(!detail) return;

  const id=new URLSearchParams(location.search).get('id') || products[0]?.id;
  const p=products.find(x=>x.id===id);

  if(!p){
    detail.innerHTML='<div class="empty" style="grid-column:1/-1">Product not found.<br><br><a class="btn dark" href="shop.html">BACK TO SHOP</a></div>';
    return;
  }

  detail.innerHTML=`
    <div class="product-gallery real-photo"><img src="${p.img}" alt="${p.name}"></div>
    <div class="product-copy">
      <div class="eyebrow" style="color:#766b5d">DOMARO FRAGRANCES</div>
      <h1>${p.name}</h1>
      <div class="meta">${p.type} · ${p.size} · ${p.cat.toUpperCase()}</div>
      <div class="price" style="font-size:22px;margin:18px 0">${money(p.price)}</div>
      <div class="stock-line"><span class="stock-dot ${p.inStock ? '' : 'stock-dot-out'}"></span>${p.inStock ? (p.stockQuantity === null ? 'AVAILABLE' : `${p.stockQuantity} IN STOCK`) : 'OUT OF STOCK'}</div>
      <p class="desc">${p.desc}</p>
      <div class="qty"><button id="minus">−</button><input id="qty" type="number" min="1" max="10" value="1"><button id="plus">+</button></div>
      <button class="add-btn" id="add" ${p.inStock ? '' : 'disabled'}>${p.inStock ? 'ADD TO CART' : 'OUT OF STOCK'}</button>
      <div class="accordion">
        <details open><summary>PRODUCT INFORMATION</summary><p>Size: ${p.size}<br>Category: ${p.cat.charAt(0).toUpperCase()+p.cat.slice(1)}<br>Price: ${money(p.price)}</p></details>
        <details><summary>DELIVERY</summary><p>Flat shipping is currently 80 EGP per order across Egypt.</p></details>
        <details><summary>RETURNS</summary><p>The final return and exchange policy will be added before full launch.</p></details>
      </div>
    </div>`;

  const qty=document.getElementById('qty');
  document.getElementById('minus').onclick=()=>qty.value=Math.max(1,(+qty.value||1)-1);
  document.getElementById('plus').onclick=()=>qty.value=Math.min(10,(+qty.value||1)+1);
  if(p.inStock) document.getElementById('add').onclick=()=>addToCart(p.id,Math.max(1,Math.min(10,+qty.value||1)));
}

function renderCart(){
  const box=document.getElementById('cart-items');
  if(!box) return;
  const cart=getCart();
  const summary=document.getElementById('cart-summary');

  if(!cart.length){
    box.innerHTML='<div class="empty">Your cart is empty.<br><br><a class="btn dark" href="shop.html">SHOP FRAGRANCES</a></div>';
    if(summary) summary.style.display='none';
    return;
  }

  let subtotal=0;
  const validItems=[];

  box.innerHTML=cart.map(item=>{
    const p=products.find(x=>x.id===item.id);
    if(!p) return '';
    validItems.push(item);
    subtotal += p.price*item.qty;
    return `<div class="cart-item">
      <img src="${p.img}" alt="${p.name}">
      <div>
        <b>${p.name}</b>
        <div class="meta">${p.type} · ${p.size}</div>
        <div style="margin-top:6px">${item.qty} × ${money(p.price)}</div>
        ${p.inStock ? '' : '<div class="cart-warning">Currently out of stock — remove before checkout.</div>'}
        <button class="remove" onclick="removeItem('${p.id}')">Remove</button>
      </div>
      <div class="item-total">${money(p.price*item.qty)}</div>
    </div>`;
  }).join('');

  if(validItems.length !== cart.length) setCart(validItems);

  if(summary){
    summary.style.display='block';
    document.getElementById('subtotal').textContent=money(subtotal);
    const shipEl=document.getElementById('shipping-fee');
    if(shipEl) shipEl.textContent=money(SHIPPING_FEE);
    document.getElementById('cart-total').textContent=money(subtotal + SHIPPING_FEE);
  }
}

function isValidEgyptPhone(value){
  return /^01[0125][0-9]{8}$/.test((value || '').replace(/\s+/g,''));
}

function renderCheckout(){
  const itemsBox=document.getElementById('checkout-items');
  if(!itemsBox) return;

  const cart=getCart();
  const form=document.getElementById('checkout-form');
  const grid=document.querySelector('.checkout-grid');

  if(!cart.length){
    if(grid) grid.innerHTML='<div class="empty" style="grid-column:1/-1">Your cart is empty.<br><br><a class="btn dark" href="shop.html">SHOP FRAGRANCES</a></div>';
    return;
  }

  let subtotal=0;
  let hasUnavailable=false;
  let appliedCoupon=null;

  itemsBox.innerHTML=cart.map(item=>{
    const p=products.find(x=>x.id===item.id);
    if(!p) return '';
    if(!p.inStock) hasUnavailable=true;
    subtotal += p.price*item.qty;
    return `<div class="checkout-product">
      <img src="${p.img}" alt="${p.name}">
      <div><b>${p.name}</b><div class="meta">${p.size} · Qty ${item.qty}</div>${p.inStock ? '' : '<div class="cart-warning">Out of stock</div>'}</div>
      <div class="checkout-product-price">${money(p.price*item.qty)}</div>
    </div>`;
  }).join('');

  const subtotalEl=document.getElementById('checkout-subtotal');
  const totalEl=document.getElementById('checkout-total');
  const discountRow=document.getElementById('checkout-discount-row');
  const discountEl=document.getElementById('checkout-discount');
  const couponLabel=document.getElementById('checkout-coupon-label');
  const couponInput=document.getElementById('coupon-code');
  const couponButton=document.getElementById('apply-coupon-btn');
  const couponMessage=document.getElementById('coupon-message');

  function renderCheckoutTotals(){
    const discount=Number(appliedCoupon?.discount || 0);
    subtotalEl.textContent=money(subtotal);
    totalEl.textContent=money(Math.max(0, subtotal-discount) + SHIPPING_FEE);
    if(appliedCoupon && discount>0){
      discountRow.hidden=false;
      discountEl.textContent=`− ${money(discount)}`;
      couponLabel.textContent=`(${appliedCoupon.code})`;
    }else{
      discountRow.hidden=true;
      discountEl.textContent='− 0 EGP';
      couponLabel.textContent='';
    }
  }
  renderCheckoutTotals();

  async function applyCoupon(){
    const code=(couponInput?.value || '').trim().toUpperCase();
    couponMessage.textContent='';
    couponMessage.className='coupon-message';
    appliedCoupon=null;
    renderCheckoutTotals();

    if(!code){
      couponMessage.textContent='Enter a discount code first.';
      couponMessage.classList.add('coupon-message-error');
      return;
    }

    couponButton.disabled=true;
    const originalText=couponButton.textContent;
    couponButton.textContent='CHECKING…';
    try{
      const response=await fetch(`${SUPABASE_URL}/rest/v1/rpc/validate_coupon`,{
        method:'POST',
        headers:{
          'apikey':SUPABASE_PUBLISHABLE_KEY,
          'Content-Type':'application/json',
          'Accept':'application/json'
        },
        body:JSON.stringify({p_code:code,p_subtotal:subtotal})
      });
      const result=await response.json().catch(()=>null);
      if(!response.ok) throw new Error(result?.message || 'Could not validate this code.');
      if(!result?.valid){
        couponMessage.textContent=result?.message || 'Invalid coupon code.';
        couponMessage.classList.add('coupon-message-error');
        return;
      }
      appliedCoupon={
        code:String(result.code || code).toUpperCase(),
        discount:Number(result.discount || 0)
      };
      couponInput.value=appliedCoupon.code;
      couponMessage.textContent=`${appliedCoupon.code} applied — you save ${money(appliedCoupon.discount)}.`;
      couponMessage.classList.add('coupon-message-success');
      renderCheckoutTotals();
    }catch(err){
      couponMessage.textContent=err.message || 'Could not validate this code.';
      couponMessage.classList.add('coupon-message-error');
    }finally{
      couponButton.disabled=false;
      couponButton.textContent=originalText;
    }
  }

  if(couponButton) couponButton.addEventListener('click',applyCoupon);
  if(couponInput){
    couponInput.addEventListener('input',()=>{
      const current=couponInput.value.trim().toUpperCase();
      couponInput.value=current;
      if(appliedCoupon && current!==appliedCoupon.code){
        appliedCoupon=null;
        couponMessage.textContent='Code changed — press APPLY again.';
        couponMessage.className='coupon-message';
        renderCheckoutTotals();
      }
    });
    couponInput.addEventListener('keydown',e=>{
      if(e.key==='Enter'){
        e.preventDefault();
        applyCoupon();
      }
    });
  }

  const placeBtn=form.querySelector('.place-order-btn');
  if(hasUnavailable){
    document.getElementById('checkout-error').textContent='One or more items are out of stock. Please return to your cart and remove them.';
    placeBtn.disabled=true;
  }

  form.addEventListener('submit', async e=>{
    e.preventDefault();
    const error=document.getElementById('checkout-error');
    error.textContent='';

    const phone=document.getElementById('phone').value.trim();
    if(!isValidEgyptPhone(phone)){
      error.textContent='Please enter a valid Egyptian mobile number (11 digits starting with 010, 011, 012 or 015).';
      document.getElementById('phone').focus();
      return;
    }

    const submitBtn=form.querySelector('.place-order-btn');
    const originalBtnText=submitBtn.textContent;
    submitBtn.disabled=true;
    submitBtn.textContent='PLACING ORDER...';

    const payload = {
      p_first_name: document.getElementById('first-name').value.trim(),
      p_last_name: document.getElementById('last-name').value.trim(),
      p_phone: phone,
      p_governorate: document.getElementById('governorate').value,
      p_area: document.getElementById('area').value.trim(),
      p_building: document.getElementById('building').value.trim(),
      p_address: document.getElementById('address').value.trim(),
      p_notes: document.getElementById('notes').value.trim(),
      p_items: cart.map(item=>({id:item.id,qty:item.qty})),
      p_coupon_code: appliedCoupon?.code || null
    };

    try{
      const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/place_order`, {
        method:'POST',
        headers:{
          'apikey': SUPABASE_PUBLISHABLE_KEY,
          'Content-Type':'application/json',
          'Accept':'application/json'
        },
        body: JSON.stringify(payload)
      });

      let result=null;
      try{ result=await response.json(); }catch(_){}

      if(!response.ok){
        throw new Error(result?.message || result?.error || 'Could not place order. Please try again.');
      }

      localStorage.removeItem('domaro_cart');
      updateCartCount();

      document.querySelector('.checkout-grid').hidden=true;
      const success=document.getElementById('order-success');
      const newOrderNumber=result?.orderNumber || 'Order received';
      document.getElementById('order-number').textContent=newOrderNumber;
      const trackLink=document.getElementById('track-order-link');
      if(trackLink && result?.orderNumber) trackLink.href=`track.html?order=${encodeURIComponent(result.orderNumber)}`;
      success.hidden=false;
      window.scrollTo({top:0,behavior:'smooth'});
    }catch(err){
      error.textContent = err.message || 'Could not place order. Please try again.';
      submitBtn.disabled=false;
      submitBtn.textContent=originalBtnText;
    }
  });
}

function initDemoForms(){
  document.querySelectorAll('[data-demo-form]').forEach(form=>{
    form.addEventListener('submit',e=>{
      e.preventDefault();
      toast('Thanks — form connection comes next.');
      form.reset();
    });
  });
}


// DOMARO v10 — secure customer order tracking
function escapeTrackHtml(value){
  return String(value ?? '')
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;')
    .replaceAll("'",'&#039;');
}

function trackingStatusLabel(status){
  const labels={
    new:'Order received',
    confirmed:'Confirmed',
    shipped:'Shipped',
    delivered:'Delivered',
    cancelled:'Cancelled'
  };
  return labels[status] || String(status || 'Unknown');
}

function renderTrackingResult(order){
  const box=document.getElementById('track-result');
  if(!box) return;

  const status=String(order.status || '').toLowerCase();
  const stages=['new','confirmed','shipped','delivered'];
  const currentIndex=stages.indexOf(status);
  const cancelled=status==='cancelled';
  const created=order.created_at ? new Date(order.created_at) : null;
  const dateText=created && !Number.isNaN(created.getTime())
    ? created.toLocaleString('en-EG',{dateStyle:'medium',timeStyle:'short'})
    : '';
  const items=Array.isArray(order.items) ? order.items : [];

  const timeline=cancelled
    ? `<div class="track-cancelled"><span>×</span><div><b>ORDER CANCELLED</b><p>This order is marked as cancelled.</p></div></div>`
    : `<div class="track-timeline">${stages.map((stage,index)=>{
        const done=currentIndex>=index;
        const active=currentIndex===index;
        return `<div class="track-stage ${done ? 'done' : ''} ${active ? 'active' : ''}">
          <div class="track-stage-dot">${done ? '✓' : index+1}</div>
          <div><b>${escapeTrackHtml(trackingStatusLabel(stage))}</b><span>${active ? 'CURRENT STATUS' : done ? 'COMPLETED' : 'UP NEXT'}</span></div>
        </div>`;
      }).join('')}</div>`;

  const itemsHtml=items.length
    ? items.map(item=>`<div class="track-item">
        <div><b>${escapeTrackHtml(item.product_name)}</b><span>${escapeTrackHtml(item.size_ml)} ML · Qty ${escapeTrackHtml(item.quantity)}</span></div>
        <strong>${money(item.line_total)}</strong>
      </div>`).join('')
    : '<div class="track-item"><div><b>Order items unavailable</b></div></div>';

  box.innerHTML=`
    <div class="track-result-head">
      <div>
        <div class="eyebrow" style="color:#766b5d">ORDER FOUND</div>
        <h2>${escapeTrackHtml(order.order_number)}</h2>
        ${dateText ? `<p>Placed ${escapeTrackHtml(dateText)}</p>` : ''}
      </div>
      <span class="track-status track-status-${escapeTrackHtml(status)}">${escapeTrackHtml(trackingStatusLabel(status)).toUpperCase()}</span>
    </div>
    ${timeline}
    <div class="track-order-details">
      <div>
        <h3>ORDER ITEMS</h3>
        <div class="track-items">${itemsHtml}</div>
      </div>
      <div class="track-total-card">
        <span>PAYMENT</span><b>${escapeTrackHtml(order.payment_method || 'Cash on Delivery')}</b>
        <span>ORDER TOTAL</span><strong>${money(order.total)}</strong>
      </div>
    </div>`;
  box.hidden=false;
  box.scrollIntoView({behavior:'smooth',block:'start'});
}

function initOrderTracking(){
  const form=document.getElementById('track-order-form');
  if(!form) return;

  const orderInput=document.getElementById('track-order-number');
  const phoneInput=document.getElementById('track-phone');
  const error=document.getElementById('track-error');
  const result=document.getElementById('track-result');
  const button=document.getElementById('track-submit');

  const preset=new URLSearchParams(location.search).get('order');
  if(preset) orderInput.value=preset;

  form.addEventListener('submit',async e=>{
    e.preventDefault();
    error.textContent='';
    result.hidden=true;

    const orderNumber=orderInput.value.trim();
    const phone=phoneInput.value.trim();

    if(!isValidEgyptPhone(phone)){
      error.textContent='Please enter the same valid Egyptian mobile number used at checkout.';
      phoneInput.focus();
      return;
    }

    const original=button.textContent;
    button.disabled=true;
    button.textContent='CHECKING...';

    try{
      const response=await fetch(`${SUPABASE_URL}/rest/v1/rpc/track_order`,{
        method:'POST',
        headers:{
          'apikey':SUPABASE_PUBLISHABLE_KEY,
          'Content-Type':'application/json',
          'Accept':'application/json'
        },
        body:JSON.stringify({p_order_number:orderNumber,p_phone:phone})
      });

      let data=null;
      try{ data=await response.json(); }catch(_){}
      if(!response.ok) throw new Error('Tracking is temporarily unavailable. Please try again.');
      if(!data){
        error.textContent='No matching order was found. Check the order number and mobile number and try again.';
        return;
      }
      renderTrackingResult(data);
    }catch(err){
      error.textContent=err.message || 'Tracking is temporarily unavailable. Please try again.';
    }finally{
      button.disabled=false;
      button.textContent=original;
    }
  });
}

async function initStore(){
  updateCartCount();
  await loadCatalog();
  renderProducts('best-products','all',4);
  renderProducts('shop-products');
  initFilters();
  renderProductDetail();
  renderCart();
  renderCheckout();
  initOrderTracking();
  initDemoForms();
}

initStore();
