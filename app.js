
const products = [
  {
    id:'hook-blue',
    name:'HOOK BLUE',
    type:'Eau de Parfum',
    price:2000,
    size:'200 ML',
    img:'assets/hook-blue.png',
    cat:'men',
    badge:'MEN',
    desc:'HOOK BLUE by Assaf. Fragrance notes and the final product description can be added once confirmed.'
  },
  {
    id:'arrogate-blue',
    name:'ARROGATE BLUE',
    type:'Eau de Parfum',
    price:2000,
    size:'200 ML',
    img:'assets/arrogate-blue.png',
    cat:'men',
    badge:'MEN',
    desc:'ARROGATE BLUE by Assaf. Fragrance notes and the final product description can be added once confirmed.'
  },
  {
    id:'arrogate-pink',
    name:'ARROGATE PINK',
    type:'Eau de Parfum',
    price:2000,
    size:'200 ML',
    img:'assets/arrogate-pink.png',
    cat:'women',
    badge:'WOMEN',
    desc:'ARROGATE PINK by Assaf. Fragrance notes and the final product description can be added once confirmed.'
  }
];

const money = n => n.toLocaleString('en-EG') + ' EGP';
const SHIPPING_FEE = 80;
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
function productCard(p){
  return `<a class="product-card" href="product.html?id=${p.id}">
    <div class="product-img real-photo"><span class="badge">${p.badge}</span><img src="${p.img}" alt="${p.name}"></div>
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
  el.innerHTML=list.map(productCard).join('');
}
renderProducts('best-products','all',3);
renderProducts('shop-products');

document.querySelectorAll('.filter-btn').forEach(btn=>{
  btn.addEventListener('click',()=>{
    document.querySelectorAll('.filter-btn').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    renderProducts('shop-products', btn.dataset.filter);
  });
});

const detail=document.getElementById('product-detail');
if(detail){
  const id=new URLSearchParams(location.search).get('id') || 'hook-blue';
  const p=products.find(x=>x.id===id) || products[0];
  detail.innerHTML=`
    <div class="product-gallery real-photo"><img src="${p.img}" alt="${p.name}"></div>
    <div class="product-copy">
      <div class="eyebrow" style="color:#766b5d">DOMARO FRAGRANCES</div>
      <h1>${p.name}</h1>
      <div class="meta">${p.type} · ${p.size} · ${p.cat.toUpperCase()}</div>
      <div class="price" style="font-size:22px;margin:18px 0">${money(p.price)}</div>
      <div class="stock-line"><span class="stock-dot"></span>AVAILABLE</div>
      <p class="desc">${p.desc}</p>
      <div class="qty"><button id="minus">−</button><input id="qty" type="number" min="1" value="1"><button id="plus">+</button></div>
      <button class="add-btn" id="add">ADD TO CART</button>
      <div class="accordion">
        <details open><summary>PRODUCT INFORMATION</summary><p>Size: ${p.size}<br>Category: ${p.cat.charAt(0).toUpperCase()+p.cat.slice(1)}<br>Price: ${money(p.price)}</p></details>
        <details><summary>DELIVERY</summary><p>Flat shipping is currently 80 EGP per order across Egypt.</p></details>
        <details><summary>RETURNS</summary><p>The final return and exchange policy will be added before checkout goes live.</p></details>
      </div>
    </div>`;
  const qty=document.getElementById('qty');
  document.getElementById('minus').onclick=()=>qty.value=Math.max(1,(+qty.value||1)-1);
  document.getElementById('plus').onclick=()=>qty.value=(+qty.value||1)+1;
  document.getElementById('add').onclick=()=>addToCart(p.id,Math.max(1,+qty.value||1));
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
  box.innerHTML=cart.map(item=>{
    const p=products.find(x=>x.id===item.id);
    if(!p) return '';
    subtotal += p.price*item.qty;
    return `<div class="cart-item">
      <img src="${p.img}" alt="${p.name}">
      <div><b>${p.name}</b><div class="meta">${p.type} · ${p.size}</div><div style="margin-top:6px">${item.qty} × ${money(p.price)}</div><button class="remove" onclick="removeItem('${p.id}')">Remove</button></div>
      <div class="item-total">${money(p.price*item.qty)}</div>
    </div>`;
  }).join('');
  if(summary){
    summary.style.display='block';
    document.getElementById('subtotal').textContent=money(subtotal);
    const shipEl=document.getElementById('shipping-fee');
    if(shipEl) shipEl.textContent=money(SHIPPING_FEE);
    document.getElementById('cart-total').textContent=money(subtotal + SHIPPING_FEE);
  }
}
renderCart();
updateCartCount();

document.querySelectorAll('[data-demo-form]').forEach(form=>{
  form.addEventListener('submit',e=>{
    e.preventDefault();
    toast('Thanks — form connection comes next.');
    form.reset();
  });
});


function makeOrderNumber(){
  const now = new Date();
  const date = now.getFullYear().toString().slice(-2) +
               String(now.getMonth()+1).padStart(2,'0') +
               String(now.getDate()).padStart(2,'0');
  const rand = Math.floor(1000 + Math.random()*9000);
  return `DOM-${date}-${rand}`;
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
  itemsBox.innerHTML=cart.map(item=>{
    const p=products.find(x=>x.id===item.id);
    if(!p) return '';
    subtotal += p.price*item.qty;
    return `<div class="checkout-product">
      <img src="${p.img}" alt="${p.name}">
      <div><b>${p.name}</b><div class="meta">${p.size} · Qty ${item.qty}</div></div>
      <div class="checkout-product-price">${money(p.price*item.qty)}</div>
    </div>`;
  }).join('');

  document.getElementById('checkout-subtotal').textContent=money(subtotal);
  document.getElementById('checkout-total').textContent=money(subtotal + SHIPPING_FEE);

  form.addEventListener('submit', e=>{
    e.preventDefault();
    const error=document.getElementById('checkout-error');
    error.textContent='';

    const phone=document.getElementById('phone').value.trim();
    if(!isValidEgyptPhone(phone)){
      error.textContent='Please enter a valid Egyptian mobile number (11 digits starting with 010, 011, 012 or 015).';
      document.getElementById('phone').focus();
      return;
    }

    const order = {
      orderNumber: makeOrderNumber(),
      createdAt: new Date().toISOString(),
      customer: {
        firstName: document.getElementById('first-name').value.trim(),
        lastName: document.getElementById('last-name').value.trim(),
        phone,
        governorate: document.getElementById('governorate').value,
        area: document.getElementById('area').value.trim(),
        building: document.getElementById('building').value.trim(),
        address: document.getElementById('address').value.trim(),
        notes: document.getElementById('notes').value.trim()
      },
      items: cart.map(item=>{
        const p=products.find(x=>x.id===item.id);
        return {id:item.id,name:p?.name||item.id,qty:item.qty,price:p?.price||0,size:p?.size||''};
      }),
      subtotal,
      shipping: SHIPPING_FEE,
      total: subtotal + SHIPPING_FEE,
      paymentMethod: 'Cash on Delivery'
    };

    const previous=JSON.parse(localStorage.getItem('domaro_orders') || '[]');
    previous.unshift(order);
    localStorage.setItem('domaro_orders', JSON.stringify(previous));

    localStorage.removeItem('domaro_cart');
    updateCartCount();

    document.querySelector('.checkout-grid').hidden=true;
    const success=document.getElementById('order-success');
    document.getElementById('order-number').textContent=order.orderNumber;
    success.hidden=false;
    window.scrollTo({top:0,behavior:'smooth'});
  });
}
renderCheckout();
