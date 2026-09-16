
const products = [
  {
    id:'noir',
    name:'THE NOIR',
    type:'Eau de Parfum',
    price:1250,
    img:'assets/noir.svg',
    cat:'men',
    badge:'BEST SELLER',
    desc:'A dark, refined composition of ambered woods, soft spice and a subtle smoky trail. Built for evening presence without becoming overpowering.',
    notes:['Bergamot','Amber Wood','Smoked Vetiver']
  },
  {
    id:'lumiere',
    name:'LUMIÈRE',
    type:'Eau de Parfum',
    price:1100,
    img:'assets/lumiere.svg',
    cat:'women',
    badge:'NEW',
    desc:'A bright, polished fragrance with radiant florals, clean musk and creamy woods. Elegant, effortless and made for everyday luxury.',
    notes:['Neroli','White Flowers','Soft Musk']
  },
  {
    id:'oud',
    name:'OUD PRIVÉ',
    type:'Eau de Parfum',
    price:1450,
    img:'assets/oud.svg',
    cat:'unisex',
    badge:'SIGNATURE',
    desc:'A rich unisex oud wrapped in spice, resin and smooth woods. Deep enough for night, balanced enough to wear year-round.',
    notes:['Saffron','Oud Accord','Resinous Woods']
  },
  {
    id:'bella',
    name:'BELLA',
    type:'Eau de Parfum',
    price:1200,
    img:'assets/bella.svg',
    cat:'women',
    badge:'FAVORITE',
    desc:'A soft feminine blend of delicate petals, warm vanilla and modern musk with a smooth skin-like finish.',
    notes:['Rose Petals','Vanilla','Cashmere Musk']
  }
];

const money = n => n.toLocaleString('en-EG') + ' EGP';

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
    <div class="product-img"><span class="badge">${p.badge}</span><img src="${p.img}" alt="${p.name}"></div>
    <div class="product-info">
      <h3>${p.name}</h3>
      <div class="meta">${p.type} · 100 ML</div>
      <div class="price-row"><span class="price">${money(p.price)}</span><span class="stars">★★★★★</span></div>
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

renderProducts('best-products','all',4);
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
  const id=new URLSearchParams(location.search).get('id') || 'noir';
  const p=products.find(x=>x.id===id) || products[0];
  detail.innerHTML=`
    <div class="product-gallery"><img src="${p.img}" alt="${p.name}"></div>
    <div class="product-copy">
      <div class="eyebrow" style="color:#766b5d">DOMARO FRAGRANCES</div>
      <h1>${p.name}</h1>
      <div class="meta">${p.type} · 100 ML</div>
      <div class="price" style="font-size:22px;margin:18px 0">${money(p.price)}</div>
      <div class="stars">★★★★★ <span style="color:#7a736b"> 4.9 / 5</span></div>
      <p class="desc">${p.desc}</p>
      <div class="note-list">${p.notes.map((n,i)=>`<div class="note"><b>${['TOP','HEART','BASE'][i]}</b>${n}</div>`).join('')}</div>
      <div class="qty"><button id="minus">−</button><input id="qty" type="number" min="1" value="1"><button id="plus">+</button></div>
      <button class="add-btn" id="add">ADD TO CART</button>
      <div class="accordion">
        <details open><summary>DESCRIPTION</summary><p>${p.desc}</p></details>
        <details><summary>DELIVERY</summary><p>Delivery options will be connected to your final shipping setup before launch.</p></details>
        <details><summary>RETURNS</summary><p>Your final returns policy can be added here before launch.</p></details>
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
    summary.style.display='none';
    return;
  }
  let subtotal=0;
  box.innerHTML=cart.map(item=>{
    const p=products.find(x=>x.id===item.id);
    if(!p) return '';
    subtotal += p.price*item.qty;
    return `<div class="cart-item">
      <img src="${p.img}" alt="${p.name}">
      <div><b>${p.name}</b><div class="meta">${p.type}</div><div style="margin-top:6px">${item.qty} × ${money(p.price)}</div><button class="remove" onclick="removeItem('${p.id}')">Remove</button></div>
      <div class="item-total">${money(p.price*item.qty)}</div>
    </div>`;
  }).join('');
  summary.style.display='block';
  document.getElementById('subtotal').textContent=money(subtotal);
  document.getElementById('cart-total').textContent=money(subtotal);
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
