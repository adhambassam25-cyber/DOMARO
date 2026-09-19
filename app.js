
const SUPABASE_URL = "https://zuqjxcsjjgotwwmlvxmf.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_gaSdKLisgpHYocKX5dYAmw_CZeW6s0c";
const SHIPPING_FEE = 80;

let products = [];
let productVariants = [];
let productImages = [];
let storeSettings = {};

const money = n => Number(n || 0).toLocaleString('en-EG') + ' EGP';

function getCart(){
  try{
    const parsed=JSON.parse(localStorage.getItem('domaro_cart') || '[]');
    return Array.isArray(parsed) ? parsed.map(item=>({
      id:String(item?.id || ''),
      variantId:item?.variantId || item?.variant_id || null,
      qty:Math.max(1,Number(item?.qty || 1))
    })).filter(item=>item.id) : [];
  }catch(_){ return []; }
}
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
function variantForProduct(product, variantId=null){
  if(!product) return null;
  const list=Array.isArray(product.variants) ? product.variants.filter(v=>v.active!==false) : [];
  if(!list.length) return null;
  return (variantId && list.find(v=>v.id===variantId)) || list.find(v=>v.isDefault) || list[0];
}
function variantAvailable(v){
  return Boolean(v && v.active!==false && v.inStock && (v.stockQuantity===null || Number(v.stockQuantity)>0));
}
function cartProduct(item){
  const product=products.find(x=>x.id===item.id);
  const variant=variantForProduct(product,item.variantId);
  return {product,variant};
}
function addToCart(id, qty=1, variantId=null){
  const p=products.find(x=>x.id===id);
  const variant=variantForProduct(p,variantId);
  if(!p || !variant || !variantAvailable(variant)){ toast('This product option is currently out of stock.'); return; }
  const cart=getCart();
  const item=cart.find(x=>x.id===id && (x.variantId || null)===(variant.id || null));
  const safeQty=Math.max(1,Math.min(10,Number(qty||1)));
  if(item) item.qty=Math.min(10,item.qty+safeQty); else cart.push({id,variantId:variant.id,qty:safeQty});
  setCart(cart);
  toast('Added to cart');
}
function removeItem(id,variantId=null){
  setCart(getCart().filter(x=>!(x.id===id && (x.variantId || null)===(variantId || null))));
  renderCart();
}
function customerAuthHeaders(extra={}){
  let token='';
  try{
    const session=JSON.parse(localStorage.getItem('domaro_customer_session') || 'null');
    token=session?.access_token || '';
  }catch(_){}
  return {'apikey':SUPABASE_PUBLISHABLE_KEY,...(token?{'Authorization':`Bearer ${token}`}:{ }),...extra};
}

async function loadCatalog(){
  try{
    const [productsRes,variantsRes,imagesRes,settingsRes]=await Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/products?select=id,name,category,size_ml,price,cost_price,has_variants,image_path,description,brand,story,top_notes,heart_notes,base_notes,in_stock,stock_quantity,active&active=eq.true&order=created_at.asc`,{headers:{'apikey':SUPABASE_PUBLISHABLE_KEY}}),
      fetch(`${SUPABASE_URL}/rest/v1/product_variants?select=id,product_id,sku,label,size_ml,price,stock_quantity,in_stock,active,is_default,sort_order&active=eq.true&order=product_id.asc,sort_order.asc`,{headers:{'apikey':SUPABASE_PUBLISHABLE_KEY}}),
      fetch(`${SUPABASE_URL}/rest/v1/product_images?select=id,product_id,image_path,alt_text,sort_order&order=product_id.asc,sort_order.asc,id.asc`,{headers:{'apikey':SUPABASE_PUBLISHABLE_KEY}}),
      fetch(`${SUPABASE_URL}/rest/v1/rpc/get_public_store_settings`,{method:'POST',headers:{'apikey':SUPABASE_PUBLISHABLE_KEY,'Content-Type':'application/json'},body:'{}'})
    ]);
    const data=await productsRes.json();
    if(!productsRes.ok || !Array.isArray(data)) throw new Error(data?.message || 'Catalog unavailable');
    productVariants=variantsRes.ok ? await variantsRes.json().catch(()=>[]) : [];
    productImages=imagesRes.ok ? await imagesRes.json().catch(()=>[]) : [];
    storeSettings=settingsRes.ok ? (await settingsRes.json().catch(()=>({})) || {}) : {};

    products=data.map(p=>{
      const variants=(Array.isArray(productVariants)?productVariants:[]).filter(v=>v.product_id===p.id).map(v=>({
        id:v.id,sku:String(v.sku||''),label:String(v.label||`${v.size_ml} ML`),size_ml:Number(v.size_ml),size:`${Number(v.size_ml)} ML`,price:Number(v.price),stockQuantity:v.stock_quantity===null?null:Number(v.stock_quantity),inStock:Boolean(v.in_stock),active:Boolean(v.active),isDefault:Boolean(v.is_default),sortOrder:Number(v.sort_order||0)
      }));
      if(!variants.length){
        variants.push({id:null,sku:'',label:`${Number(p.size_ml)} ML`,size_ml:Number(p.size_ml),size:`${Number(p.size_ml)} ML`,price:Number(p.price),stockQuantity:p.stock_quantity===null?null:Number(p.stock_quantity),inStock:Boolean(p.in_stock),active:true,isDefault:true,sortOrder:0});
      }
      const defaultVariant=variants.find(v=>v.isDefault) || variants[0];
      const gallery=(Array.isArray(productImages)?productImages:[]).filter(i=>i.product_id===p.id).map(i=>({id:i.id,path:i.image_path,alt:i.alt_text||p.name,sortOrder:Number(i.sort_order||0)}));
      const availableVariants=variants.filter(variantAvailable);
      const minPrice=Math.min(...variants.filter(v=>v.active!==false).map(v=>v.price));
      return {
        id:p.id,name:p.name,type:'Eau de Parfum',price:Number.isFinite(minPrice)?minPrice:Number(p.price),size:defaultVariant?.size || `${p.size_ml} ML`,size_ml:defaultVariant?.size_ml || Number(p.size_ml),img:p.image_path || 'assets/hero.svg',cat:p.category,
        badge:availableVariants.length ? String(p.category).toUpperCase() : 'OUT OF STOCK',stockQuantity:p.stock_quantity===null?null:Number(p.stock_quantity),inStock:availableVariants.length>0,active:Boolean(p.active),brand:String(p.brand||'').trim(),story:String(p.story||'').trim(),topNotes:String(p.top_notes||'').trim(),heartNotes:String(p.heart_notes||'').trim(),baseNotes:String(p.base_notes||'').trim(),desc:p.description||'',hasVariants:Boolean(p.has_variants)||variants.length>1,variants,gallery
      };
    });
    window.DOMARO_CATALOG_UNAVAILABLE=false;
    window.DOMARO_STORE_SETTINGS=storeSettings;
    window.dispatchEvent(new CustomEvent('domaro:catalog-ready',{detail:{products,storeSettings}}));
  }catch(err){
    console.error('DOMARO catalog unavailable:', err);
    products=[]; productVariants=[]; productImages=[]; storeSettings={};
    window.DOMARO_CATALOG_UNAVAILABLE = true;
  }
}

function productCard(p){
  const brandLine=p.brand ? `<div class="product-brand">${escapeTrackHtml(p.brand)}</div>` : '';
  const activeVariants=(p.variants||[]).filter(v=>v.active!==false);
  const prices=[...new Set(activeVariants.map(v=>Number(v.price)))];
  const priceLabel=prices.length>1 ? `FROM ${money(Math.min(...prices))}` : money(p.price);
  return `<a class="product-card" href="product.html?id=${encodeURIComponent(p.id)}" data-product-id="${escapeTrackHtml(p.id)}">
    <div class="product-img real-photo">
      <span class="badge ${p.inStock ? '' : 'badge-out'}">${p.inStock ? p.badge : 'OUT OF STOCK'}</span>
      <img src="${safeImageSrc(p.img)}" alt="${escapeTrackHtml(p.name)}" loading="lazy" decoding="async">
    </div>
    <div class="product-info">
      ${brandLine}
      <h3>${escapeTrackHtml(p.name)}</h3>
      <div class="meta">${escapeTrackHtml(p.type)} · ${activeVariants.length>1 ? `${activeVariants.length} SIZES` : escapeTrackHtml(p.size)}</div>
      <div class="price-row"><span class="price">${priceLabel}</span><span class="meta">${escapeTrackHtml(String(p.cat || '').toUpperCase())}</span></div>
    </div>
  </a>`;
}

function normalizeBrand(value){
  return String(value || '').trim().toLowerCase();
}

function filteredCatalog(category='all', brand='', query=''){
  const q=String(query || '').trim().toLowerCase();
  return products.filter(p=>{
    const categoryMatch=category==='all' || p.cat===category;
    const brandMatch=!brand || normalizeBrand(p.brand)===normalizeBrand(brand);
    const searchMatch=!q || [p.name,p.brand,p.cat,p.desc].join(' ').toLowerCase().includes(q);
    return categoryMatch && brandMatch && searchMatch;
  });
}

function renderProducts(targetId, filter='all', limit=null, brand='', query=''){
  const el=document.getElementById(targetId);
  if(!el) return;
  let list=filteredCatalog(filter,brand,query);
  if(limit) list=list.slice(0,limit);
  el.innerHTML=list.length
    ? list.map(productCard).join('')
    : `<div class="empty" style="grid-column:1/-1">${window.DOMARO_CATALOG_UNAVAILABLE ? 'Our catalog is temporarily unavailable. Please refresh in a moment.' : 'No products match this selection yet.'}</div>`;
  if(typeof window.DOMAROV30DecorateProductCards==='function') window.DOMAROV30DecorateProductCards();
}

function catalogBrands(){
  const map=new Map();
  products.forEach(p=>{
    const label=String(p.brand || '').trim();
    if(!label) return;
    const key=label.toLowerCase();
    if(!map.has(key)) map.set(key,label);
  });
  return [...map.values()].sort((a,b)=>a.localeCompare(b));
}

function renderBrandDirectory(){
  const grid=document.getElementById('brands-grid');
  if(!grid) return;
  const brands=catalogBrands();

  grid.innerHTML=brands.length
    ? brands.map(brand=>{
        const count=products.filter(p=>normalizeBrand(p.brand)===normalizeBrand(brand)).length;
        return `<a class="brand-directory-card" href="shop.html?brand=${encodeURIComponent(brand)}">
          <span class="brand-directory-label">FRAGRANCE HOUSE</span>
          <h2>${escapeTrackHtml(brand)}</h2>
          <span>${count} PRODUCT${count===1?'':'S'} →</span>
        </a>`;
      }).join('')
    : '<div class="empty" style="grid-column:1/-1">Brands will appear here as soon as you add a Brand to your products from the Admin dashboard.</div>';
}

function renderShopBrandFilters(activeBrand=''){
  const box=document.getElementById('brand-filters');
  if(!box) return;

  const brands=catalogBrands();
  box.innerHTML = brands.length
    ? `<button class="brand-filter-btn ${!activeBrand?'active':''}" data-brand="">ALL BRANDS</button>` +
      brands.map(brand=>`<button class="brand-filter-btn ${normalizeBrand(activeBrand)===normalizeBrand(brand)?'active':''}" data-brand="${escapeTrackHtml(brand)}">${escapeTrackHtml(brand)}</button>`).join('')
    : '';
}


function setShopView(view){
  const grid=document.getElementById('shop-products');
  if(!grid) return;

  const mode=view==='list' ? 'list' : 'thumbnail';
  grid.classList.toggle('products-list-view',mode==='list');
  grid.classList.toggle('products-thumbnail-view',mode==='thumbnail');

  document.querySelectorAll('.shop-view-btn').forEach(btn=>{
    const active=btn.dataset.view===mode;
    btn.classList.toggle('active',active);
    btn.setAttribute('aria-pressed',active ? 'true' : 'false');
  });

  try{ localStorage.setItem('domaroProductView',mode); }catch(_){}
}

function initShopView(){
  if(!document.getElementById('shop-products')) return;

  let saved='thumbnail';
  try{
    const value=localStorage.getItem('domaroProductView');
    if(value==='list' || value==='thumbnail') saved=value;
  }catch(_){}

  document.querySelectorAll('.shop-view-btn').forEach(btn=>{
    btn.addEventListener('click',()=>setShopView(btn.dataset.view));
  });

  setShopView(saved);
}

function initFilters(){
  const allowedFilters=['all','men','women','unisex'];
  const params=new URLSearchParams(location.search);
  const urlFilter=(params.get('category') || 'all').toLowerCase();
  let activeCategory=allowedFilters.includes(urlFilter) ? urlFilter : 'all';
  let activeBrand=String(params.get('brand') || '').trim();
  let activeSearch=String(params.get('search') || '').trim();

  const updateShop=()=>{
    document.querySelectorAll('.filter-btn').forEach(btn=>{
      btn.classList.toggle('active',btn.dataset.filter===activeCategory);
    });
    renderShopBrandFilters(activeBrand);
    document.querySelectorAll('.brand-filter-btn').forEach(btn=>{
      btn.addEventListener('click',()=>{
        activeBrand=btn.dataset.brand || '';
        updateShopUrl();
        updateShop();
      });
    });
    renderProducts('shop-products',activeCategory,null,activeBrand,activeSearch);
    const title=document.getElementById('shop-context-title');
    const sub=document.getElementById('shop-context-sub');
    if(title){
      if(activeSearch) title.textContent='SEARCH RESULTS';
      else if(activeBrand) title.textContent=activeBrand;
      else if(activeCategory!=='all') title.textContent=activeCategory.toUpperCase()+' FRAGRANCES';
      else title.textContent='SHOP FRAGRANCES';
    }
    if(sub){
      sub.textContent=activeSearch
        ? `Products matching “${activeSearch}” by fragrance name or brand.`
        : activeBrand
          ? `Explore every ${activeBrand} fragrance currently available at DOMARO.`
          : activeCategory!=='all'
            ? `Explore the ${activeCategory} collection.`
            : 'Browse the currently available DOMARO collection.';
    }
  };

  const updateShopUrl=()=>{
    const url=new URL(location.href);
    if(activeCategory==='all') url.searchParams.delete('category');
    else url.searchParams.set('category',activeCategory);
    if(activeBrand) url.searchParams.set('brand',activeBrand);
    else url.searchParams.delete('brand');
    if(activeSearch) url.searchParams.set('search',activeSearch);
    else url.searchParams.delete('search');
    history.replaceState({},'',url);
  };

  document.querySelectorAll('.filter-btn').forEach(btn=>{
    btn.addEventListener('click',()=>{
      activeCategory=btn.dataset.filter;
      updateShopUrl();
      updateShop();
    });
  });

  updateShop();
}

function safeImageSrc(value){
  const raw=String(value || '').trim();
  if(!raw) return 'assets/hero.svg';
  if(/^assets\/[a-z0-9._/-]+$/i.test(raw)) return raw;
  try{
    const url=new URL(raw, location.origin);
    const allowedHosts=new Set([location.host,'zuqjxcsjjgotwwmlvxmf.supabase.co']);
    if(url.protocol==='https:' && allowedHosts.has(url.host)) return escapeTrackHtml(url.href);
  }catch(_){}
  return 'assets/hero.svg';
}

function renderProductDetail(){
  const detail=document.getElementById('product-detail');
  if(!detail) return;

  const id=new URLSearchParams(location.search).get('id') || products[0]?.id;
  const p=products.find(x=>x.id===id);

  if(!p){
    const message=window.DOMARO_CATALOG_UNAVAILABLE
      ? 'Our catalog is temporarily unavailable. Please refresh in a moment.'
      : 'Product not found.';
    detail.innerHTML=`<div class="empty" style="grid-column:1/-1">${message}<br><br><a class="btn dark" href="shop.html">BACK TO SHOP</a></div>`;
    return;
  }

  try{
    const recent=JSON.parse(localStorage.getItem('domaro_recently_viewed') || '[]');
    const next=[p.id,...recent.filter(x=>x!==p.id)].slice(0,8);
    localStorage.setItem('domaro_recently_viewed',JSON.stringify(next));
  }catch(_){}

  const variants=(p.variants||[]).filter(v=>v.active!==false);
  const initialVariant=variantForProduct(p,null);
  const brandLabel=p.brand ? escapeTrackHtml(p.brand) : 'DOMARO EDIT';
  const storyText=p.story || p.desc || '';
  const hasNotes=Boolean(p.topNotes || p.heartNotes || p.baseNotes);
  const gallery=[{path:p.img,alt:p.name},...(p.gallery||[]).filter(g=>g.path && g.path!==p.img)];
  const notesHtml=hasNotes ? `
    <section class="scent-notes-section">
      <div class="editorial-kicker">THE SCENT</div>
      <h2>THE COMPOSITION</h2>
      <div class="scent-notes-grid">
        <div class="scent-note-card"><span>01</span><b>TOP NOTES</b><p>${escapeTrackHtml(p.topNotes || 'To be added')}</p></div>
        <div class="scent-note-card"><span>02</span><b>HEART NOTES</b><p>${escapeTrackHtml(p.heartNotes || 'To be added')}</p></div>
        <div class="scent-note-card"><span>03</span><b>BASE NOTES</b><p>${escapeTrackHtml(p.baseNotes || 'To be added')}</p></div>
      </div>
    </section>` : '';

  const variantButtons=variants.length>1 ? `<div class="variant-selector-wrap">
    <span class="variant-selector-label">SELECT SIZE</span>
    <div class="variant-selector" id="variant-selector">
      ${variants.map((v,i)=>`<button type="button" class="variant-option ${v.id===initialVariant?.id?'active':''}" data-variant-id="${escapeTrackHtml(v.id||'')}">
        <b>${escapeTrackHtml(v.label || v.size)}</b><span>${money(v.price)}</span>${variantAvailable(v)?'':'<small>OUT OF STOCK</small>'}
      </button>`).join('')}
    </div>
  </div>` : '';

  detail.innerHTML=`
    <div class="product-main-grid">
      <div class="product-gallery-v30">
        <div class="product-gallery real-photo product-gallery-main"><img id="product-main-image" src="${safeImageSrc(gallery[0]?.path || p.img)}" alt="${escapeTrackHtml(p.name)}" decoding="async" fetchpriority="high"></div>
        ${gallery.length>1?`<div class="product-gallery-thumbs">${gallery.map((g,i)=>`<button type="button" class="product-gallery-thumb ${i===0?'active':''}" data-gallery-src="${safeImageSrc(g.path)}"><img src="${safeImageSrc(g.path)}" alt="${escapeTrackHtml(g.alt||p.name)}" loading="lazy"></button>`).join('')}</div>`:''}
      </div>
      <div class="product-copy">
        <a class="product-brand-link" href="${p.brand ? `shop.html?brand=${encodeURIComponent(p.brand)}` : 'shop.html'}">${brandLabel}</a>
        <h1>${escapeTrackHtml(p.name)}</h1>
        <div class="product-facts">
          <span>${escapeTrackHtml(String(p.cat || '').toUpperCase())}</span>
          <span id="product-selected-size">${escapeTrackHtml(initialVariant?.size || p.size)}</span>
          <span>${escapeTrackHtml(p.type)}</span>
        </div>
        <div class="price" id="product-selected-price" style="font-size:22px;margin:18px 0">${money(initialVariant?.price ?? p.price)}</div>
        <div class="stock-line" id="product-selected-stock"><span class="stock-dot ${variantAvailable(initialVariant) ? '' : 'stock-dot-out'}"></span>${variantAvailable(initialVariant) ? (initialVariant.stockQuantity === null ? 'AVAILABLE' : `${initialVariant.stockQuantity} IN STOCK`) : 'OUT OF STOCK'}</div>
        ${variantButtons}
        ${p.desc ? `<p class="product-short-desc">${escapeTrackHtml(p.desc)}</p>` : ''}
        <div class="qty"><button id="minus">−</button><input id="qty" type="number" min="1" max="10" value="1"><button id="plus">+</button></div>
        <div class="product-buy-row"><button class="add-btn" id="add" ${variantAvailable(initialVariant) ? '' : 'disabled'}>${variantAvailable(initialVariant) ? 'ADD TO CART' : 'OUT OF STOCK'}</button><button class="wishlist-product-btn" id="wishlist-product-btn" type="button" aria-label="Add to wishlist">♡</button></div>
        <div class="product-service-row">
          <span>80 EGP FLAT SHIPPING</span>
          <span>CASH ON DELIVERY</span>
        </div>
      </div>
    </div>

    <div class="product-editorial">
      ${storyText ? `<section class="product-story-section">
        <div class="editorial-kicker">THE STORY</div>
        <h2>A SCENT WITH A POINT OF VIEW</h2>
        <p>${escapeTrackHtml(storyText)}</p>
      </section>` : ''}
      ${notesHtml}
    </div>

    <div class="product-accordion-wide accordion">
      <details open><summary>PRODUCT INFORMATION</summary><p>${p.brand ? `Brand: ${escapeTrackHtml(p.brand)}<br>` : ''}Size: <span id="product-info-size">${escapeTrackHtml(initialVariant?.size || p.size)}</span><br>Category: ${escapeTrackHtml(String(p.cat || '').charAt(0).toUpperCase()+String(p.cat || '').slice(1))}<br>Price: <span id="product-info-price">${money(initialVariant?.price ?? p.price)}</span></p></details>
      <details><summary>DELIVERY</summary><p>Flat shipping is currently 80 EGP per order across Egypt.</p></details>
    </div>
    <section id="product-recommendations" class="product-recommendations-v30"></section>`;

  let selectedVariant=initialVariant;
  const qty=document.getElementById('qty');
  const addBtn=document.getElementById('add');
  const updateVariantUi=variant=>{
    selectedVariant=variant;
    document.querySelectorAll('.variant-option').forEach(btn=>btn.classList.toggle('active',btn.dataset.variantId===(variant?.id||'')));
    const priceEl=document.getElementById('product-selected-price'); if(priceEl) priceEl.textContent=money(variant?.price ?? p.price);
    const sizeEl=document.getElementById('product-selected-size'); if(sizeEl) sizeEl.textContent=variant?.size || p.size;
    const infoSize=document.getElementById('product-info-size'); if(infoSize) infoSize.textContent=variant?.size || p.size;
    const infoPrice=document.getElementById('product-info-price'); if(infoPrice) infoPrice.textContent=money(variant?.price ?? p.price);
    const stock=document.getElementById('product-selected-stock');
    if(stock) stock.innerHTML=`<span class="stock-dot ${variantAvailable(variant)?'':'stock-dot-out'}"></span>${variantAvailable(variant) ? (variant.stockQuantity===null?'AVAILABLE':`${variant.stockQuantity} IN STOCK`) : 'OUT OF STOCK'}`;
    if(addBtn){ addBtn.disabled=!variantAvailable(variant); addBtn.textContent=variantAvailable(variant)?'ADD TO CART':'OUT OF STOCK'; }
  };
  document.querySelectorAll('.variant-option').forEach(btn=>btn.addEventListener('click',()=>{
    const variant=variants.find(v=>(v.id||'')===btn.dataset.variantId); if(variant) updateVariantUi(variant);
  }));
  document.querySelectorAll('.product-gallery-thumb').forEach(btn=>btn.addEventListener('click',()=>{
    const img=document.getElementById('product-main-image'); if(img) img.src=btn.dataset.gallerySrc || img.src;
    document.querySelectorAll('.product-gallery-thumb').forEach(x=>x.classList.toggle('active',x===btn));
  }));
  document.getElementById('minus').onclick=()=>qty.value=Math.max(1,(+qty.value||1)-1);
  document.getElementById('plus').onclick=()=>qty.value=Math.min(10,(+qty.value||1)+1);
  addBtn.onclick=()=>{ if(variantAvailable(selectedVariant)) addToCart(p.id,Math.max(1,Math.min(10,+qty.value||1)),selectedVariant?.id || null); };

  if(typeof window.DOMAROV30InitProductExtras==='function') window.DOMAROV30InitProductExtras(p);
}

function renderCart(){
  const box=document.getElementById('cart-items');
  if(!box) return;
  const cart=getCart();
  const summary=document.getElementById('cart-summary');

  if(window.DOMARO_CATALOG_UNAVAILABLE){
    box.innerHTML='<div class="empty">Our catalog is temporarily unavailable. Your cart has been kept safely in this browser. Please refresh in a moment.</div>';
    if(summary) summary.style.display='none';
    return;
  }

  if(!cart.length){
    box.innerHTML='<div class="empty">Your cart is empty.<br><br><a class="btn dark" href="shop.html">SHOP FRAGRANCES</a></div>';
    if(summary) summary.style.display='none';
    return;
  }

  let subtotal=0;
  const validItems=[];

  box.innerHTML=cart.map(item=>{
    const {product:p,variant}=cartProduct(item);
    if(!p || !variant) return '';
    validItems.push({...item,variantId:variant.id});
    subtotal += variant.price*item.qty;
    const available=variantAvailable(variant);
    return `<div class="cart-item">
      <img src="${safeImageSrc(p.img)}" alt="${escapeTrackHtml(p.name)}" loading="lazy" decoding="async">
      <div>
        <b>${escapeTrackHtml(p.name)}</b>
        <div class="meta">${escapeTrackHtml(p.type)} · ${escapeTrackHtml(variant.label || variant.size)}</div>
        <div style="margin-top:6px">${item.qty} × ${money(variant.price)}</div>
        ${available ? '' : '<div class="cart-warning">Currently out of stock — remove before checkout.</div>'}
        <button class="remove" type="button" data-remove-product="${escapeTrackHtml(p.id)}" data-remove-variant="${escapeTrackHtml(variant.id||'')}">Remove</button>
      </div>
      <div class="item-total">${money(variant.price*item.qty)}</div>
    </div>`;
  }).join('');

  if(validItems.length !== cart.length || validItems.some((x,i)=>x.variantId!==cart[i]?.variantId)) setCart(validItems);

  box.querySelectorAll('[data-remove-product]').forEach(btn=>{
    btn.addEventListener('click',()=>removeItem(btn.dataset.removeProduct || '',btn.dataset.removeVariant || null));
  });

  if(summary){
    summary.style.display='block';
    document.getElementById('subtotal').textContent=money(subtotal);
    const shipEl=document.getElementById('shipping-fee'); if(shipEl) shipEl.textContent=money(SHIPPING_FEE);
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

  if(window.DOMARO_CATALOG_UNAVAILABLE){
    if(grid) grid.innerHTML='<div class="empty" style="grid-column:1/-1">Our catalog is temporarily unavailable. Your cart has been kept safely in this browser. Please refresh before checkout.</div>';
    return;
  }
  const reviewModal=document.getElementById('review-modal');
  const reviewContent=document.getElementById('review-content');
  const reviewError=document.getElementById('review-error');
  const confirmBtn=document.getElementById('confirm-place-order-btn');
  const editBtn=document.getElementById('edit-order-btn');

  if(!cart.length){
    if(grid) grid.innerHTML='<div class="empty" style="grid-column:1/-1">Your cart is empty.<br><br><a class="btn dark" href="shop.html">SHOP FRAGRANCES</a></div>';
    return;
  }

  let subtotal=0;
  let hasUnavailable=false;
  let appliedCoupon=null;
  let pendingPayload=null;
  let checkoutToken=sessionStorage.getItem('domaro_checkout_token') || '';

  itemsBox.innerHTML=cart.map(item=>{
    const {product:p,variant}=cartProduct(item);
    if(!p || !variant) return '';
    const available=variantAvailable(variant);
    if(!available) hasUnavailable=true;
    subtotal += variant.price*item.qty;
    return `<div class="checkout-product">
      <img src="${safeImageSrc(p.img)}" alt="${escapeTrackHtml(p.name)}" loading="lazy" decoding="async">
      <div><b>${escapeTrackHtml(p.name)}</b><div class="meta">${escapeTrackHtml(variant.label || variant.size)} · Qty ${item.qty}</div>${available ? '' : '<div class="cart-warning">Out of stock</div>'}</div>
      <div class="checkout-product-price">${money(variant.price*item.qty)}</div>
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
  const placeBtn=form.querySelector('.place-order-btn');
  const checkoutError=document.getElementById('checkout-error');

  function currentDiscount(){ return Number(appliedCoupon?.discount || 0); }
  function currentTotal(){ return Math.max(0, subtotal-currentDiscount()) + SHIPPING_FEE; }

  function renderCheckoutTotals(){
    const discount=currentDiscount();
    subtotalEl.textContent=money(subtotal);
    totalEl.textContent=money(currentTotal());
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

  if(hasUnavailable){
    checkoutError.textContent='One or more items are out of stock. Please return to your cart and remove them.';
    placeBtn.disabled=true;
  }

  function fieldValue(id){ return document.getElementById(id)?.value.trim() || ''; }

  function validateCheckout(){
    checkoutError.textContent='';
    const fields=[
      ['first-name','Please enter your first name.'],
      ['last-name','Please enter your last name.'],
      ['phone','Please enter your mobile number.'],
      ['governorate','Please select your governorate.'],
      ['area','Please enter your area or district.'],
      ['address','Please enter your detailed delivery address.']
    ];

    for(const [id,message] of fields){
      const el=document.getElementById(id);
      if(!el || !String(el.value || '').trim()){
        checkoutError.textContent=message;
        el?.focus();
        return false;
      }
    }

    if(!isValidEgyptPhone(fieldValue('phone'))){
      checkoutError.textContent='Please enter a valid Egyptian mobile number (11 digits starting with 010, 011, 012 or 015).';
      document.getElementById('phone').focus();
      return false;
    }

    if(hasUnavailable){
      checkoutError.textContent='One or more items are out of stock. Please return to your cart and remove them.';
      return false;
    }

    return true;
  }

  function buildPayload(){
    if(!checkoutToken){
      checkoutToken=(window.crypto && crypto.randomUUID)
        ? crypto.randomUUID()
        : `domaro-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      sessionStorage.setItem('domaro_checkout_token',checkoutToken);
    }

    return {
      p_first_name: fieldValue('first-name'),
      p_last_name: fieldValue('last-name'),
      p_phone: fieldValue('phone').replace(/\s+/g,''),
      p_governorate: document.getElementById('governorate').value,
      p_area: fieldValue('area'),
      p_building: fieldValue('building'),
      p_address: fieldValue('address'),
      p_notes: fieldValue('notes'),
      p_items: cart.map(item=>({id:item.id,variant_id:item.variantId || null,qty:item.qty})),
      p_coupon_code: appliedCoupon?.code || null,
      p_checkout_token: checkoutToken,
      p_email: fieldValue('email') || null
    };
  }

  function openReview(payload){
    pendingPayload=payload;
    if(reviewError) reviewError.textContent='';

    const itemRows=cart.map(item=>{
      const {product:p,variant}=cartProduct(item);
      if(!p || !variant) return '';
      return `<div class="review-item"><div><b>${escapeTrackHtml(p.name)}</b><span>${escapeTrackHtml(variant.label || variant.size)} · Qty ${item.qty}</span></div><strong>${money(variant.price*item.qty)}</strong></div>`;
    }).join('');

    reviewContent.innerHTML=`
      <div class="review-section">
        <h3>DELIVERY</h3>
        <div class="review-detail-grid">
          <div><span>Customer</span><b>${escapeTrackHtml(payload.p_first_name)} ${escapeTrackHtml(payload.p_last_name)}</b></div>
          <div><span>Mobile</span><b>${escapeTrackHtml(payload.p_phone)}</b></div>
          <div><span>Governorate</span><b>${escapeTrackHtml(payload.p_governorate)}</b></div>
          <div><span>Area</span><b>${escapeTrackHtml(payload.p_area)}</b></div>
        </div>
        <div class="review-address"><span>Address</span><b>${escapeTrackHtml(payload.p_address)}${payload.p_building ? `<br>${escapeTrackHtml(payload.p_building)}` : ''}</b></div>
        ${payload.p_notes ? `<div class="review-address"><span>Notes</span><b>${escapeTrackHtml(payload.p_notes)}</b></div>` : ''}
      </div>
      <div class="review-section">
        <h3>ORDER</h3>
        <div class="review-items">${itemRows}</div>
        <div class="review-totals">
          <div><span>Subtotal</span><b>${money(subtotal)}</b></div>
          ${currentDiscount()>0 ? `<div class="review-discount"><span>Discount ${appliedCoupon ? `(${escapeTrackHtml(appliedCoupon.code)})` : ''}</span><b>− ${money(currentDiscount())}</b></div>` : ''}
          <div><span>Shipping</span><b>${money(SHIPPING_FEE)}</b></div>
          <div class="review-grand"><span>Total</span><b>${money(currentTotal())}</b></div>
        </div>
      </div>
      <div class="review-payment">PAYMENT METHOD <b>Cash on Delivery</b></div>`;

    reviewModal.hidden=false;
    reviewModal.setAttribute('aria-hidden','false');
    document.body.classList.add('review-open');
    setTimeout(()=>confirmBtn?.focus(),20);
  }

  function closeReview(){
    if(!reviewModal) return;
    reviewModal.hidden=true;
    reviewModal.setAttribute('aria-hidden','true');
    document.body.classList.remove('review-open');
    placeBtn?.focus();
  }

  document.querySelectorAll('[data-close-review]').forEach(el=>el.addEventListener('click',closeReview));
  if(editBtn) editBtn.addEventListener('click',closeReview);
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape' && reviewModal && !reviewModal.hidden) closeReview();
  });

  form.addEventListener('submit',e=>{
    e.preventDefault();
    if(!validateCheckout()) return;
    openReview(buildPayload());
  });

  if(confirmBtn){
    confirmBtn.addEventListener('click',async()=>{
      if(!pendingPayload || confirmBtn.disabled) return;
      if(reviewError) reviewError.textContent='';

      const originalText=confirmBtn.textContent;
      confirmBtn.disabled=true;
      if(editBtn) editBtn.disabled=true;
      confirmBtn.textContent='PLACING ORDER...';

      try{
        const response=await fetch(`${SUPABASE_URL}/rest/v1/rpc/place_order_v30`,{
          method:'POST',
          headers:customerAuthHeaders({
            'Content-Type':'application/json',
            'Accept':'application/json'
          }),
          body:JSON.stringify(pendingPayload)
        });

        let result=null;
        try{ result=await response.json(); }catch(_){}

        if(!response.ok){
          throw new Error(result?.message || result?.error || 'Could not place order. Please try again.');
        }

        localStorage.removeItem('domaro_cart');
        sessionStorage.removeItem('domaro_checkout_token');
        updateCartCount();
        closeReview();

        const newOrderNumber=result?.orderNumber || 'Order received';
        const checkoutPage=document.querySelector('.checkout-page');
        const pageHero=document.querySelector('.page-hero');

        if(pageHero) pageHero.hidden=true;

        if(checkoutPage){
          checkoutPage.innerHTML=`
            <section class="order-success order-success-only">
              <div class="success-mark">✓</div>
              <div class="eyebrow" style="color:#766b5d">ORDER CONFIRMED</div>
              <h2>Thank you for your order.</h2>
              <p class="success-label">YOUR ORDER NUMBER</p>
              <div class="success-order-number">${escapeTrackHtml(newOrderNumber)}</div>
              <button class="copy-order-btn" id="copy-order-number" type="button" data-order-number="${escapeTrackHtml(newOrderNumber)}">COPY ORDER NUMBER</button>
              <p>Keep this number to track your order.</p>
              <div class="success-actions">
                <a class="btn dark" href="track.html?order=${encodeURIComponent(newOrderNumber)}">TRACK YOUR ORDER</a>
                <a class="btn track-secondary" href="shop.html">CONTINUE SHOPPING</a>
              </div>
            </section>`;
        }

        const copyOrderBtn=document.getElementById('copy-order-number');
        if(copyOrderBtn){
          copyOrderBtn.addEventListener('click',async()=>{
            const value=copyOrderBtn.dataset.orderNumber || newOrderNumber;
            try{
              await navigator.clipboard.writeText(value);
              const oldText=copyOrderBtn.textContent;
              copyOrderBtn.textContent='COPIED ✓';
              copyOrderBtn.classList.add('copied');
              setTimeout(()=>{
                copyOrderBtn.textContent=oldText;
                copyOrderBtn.classList.remove('copied');
              },1600);
            }catch(_){
              copyOrderBtn.textContent='ORDER: '+value;
            }
          });
        }

        window.scrollTo({top:0,behavior:'smooth'});
      }catch(err){
        if(reviewError) reviewError.textContent=err.message || 'Could not place order. Please try again.';
      }finally{
        confirmBtn.disabled=false;
        if(editBtn) editBtn.disabled=false;
        confirmBtn.textContent=originalText;
      }
    });
  }
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



// DOMARO V29 — global product & brand search
function initGlobalSearch(){
  const triggers=[...document.querySelectorAll('.nav-search-trigger')];
  if(!triggers.length) return;

  const overlay=document.createElement('div');
  overlay.id='global-search-overlay';
  overlay.className='global-search-overlay';
  overlay.hidden=true;
  overlay.innerHTML=`
    <div class="global-search-backdrop" data-search-close></div>
    <section class="global-search-panel" role="dialog" aria-modal="true" aria-labelledby="global-search-title">
      <div class="global-search-head">
        <div><span>DISCOVER DOMARO</span><h2 id="global-search-title">SEARCH</h2></div>
        <button class="global-search-close" type="button" data-search-close aria-label="Close search">×</button>
      </div>
      <form id="global-search-form" class="global-search-form">
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"></circle><path d="m16 16 4 4"></path></svg>
        <input id="global-search-input" type="search" autocomplete="off" placeholder="Search products or brands" aria-label="Search products or brands">
        <button type="submit">VIEW ALL</button>
      </form>
      <div id="global-search-results" class="global-search-results"></div>
    </section>`;
  document.body.appendChild(overlay);

  const input=overlay.querySelector('#global-search-input');
  const results=overlay.querySelector('#global-search-results');
  const form=overlay.querySelector('#global-search-form');

  const close=()=>{
    overlay.hidden=true;
    document.body.classList.remove('global-search-open');
  };

  const render=(value='')=>{
    const q=String(value || '').trim().toLowerCase();
    const brands=catalogBrands();
    if(!q){
      results.innerHTML=`
        <div class="global-search-empty">
          <span>SEARCH THE COLLECTION</span>
          <p>Type a fragrance name or brand.</p>
          ${brands.length?`<div class="global-search-brand-chips">${brands.slice(0,8).map(brand=>`<a href="shop.html?brand=${encodeURIComponent(brand)}">${escapeTrackHtml(brand)}</a>`).join('')}</div>`:''}
        </div>`;
      return;
    }

    const productMatches=products.filter(p=>[p.name,p.brand,p.cat].join(' ').toLowerCase().includes(q)).slice(0,6);
    const brandMatches=brands.filter(brand=>brand.toLowerCase().includes(q)).slice(0,6);

    if(!productMatches.length && !brandMatches.length){
      results.innerHTML=`<div class="global-search-empty"><span>NO RESULTS</span><p>Try another product or brand name.</p></div>`;
      return;
    }

    const productHtml=productMatches.length?`
      <div class="global-search-section">
        <div class="global-search-section-title">PRODUCTS</div>
        <div class="global-search-product-list">${productMatches.map(p=>`
          <a class="global-search-product" href="product.html?id=${encodeURIComponent(p.id)}">
            <img src="${safeImageSrc(p.img)}" alt="${escapeTrackHtml(p.name)}" loading="lazy">
            <span><b>${escapeTrackHtml(p.name)}</b><small>${p.brand?escapeTrackHtml(p.brand)+' · ':''}${escapeTrackHtml(p.size)}</small></span>
            <strong>${money(p.price)}</strong>
          </a>`).join('')}</div>
      </div>`:'';

    const brandHtml=brandMatches.length?`
      <div class="global-search-section">
        <div class="global-search-section-title">BRANDS</div>
        <div class="global-search-brand-results">${brandMatches.map(brand=>`<a href="shop.html?brand=${encodeURIComponent(brand)}">${escapeTrackHtml(brand)}<span>→</span></a>`).join('')}</div>
      </div>`:'';

    results.innerHTML=productHtml+brandHtml;
  };

  const open=()=>{
    overlay.hidden=false;
    document.body.classList.add('global-search-open');
    input.value='';
    render('');
    requestAnimationFrame(()=>input.focus());
  };

  triggers.forEach(btn=>btn.addEventListener('click',open));
  overlay.querySelectorAll('[data-search-close]').forEach(el=>el.addEventListener('click',close));
  input.addEventListener('input',()=>render(input.value));
  form.addEventListener('submit',e=>{
    e.preventDefault();
    const q=input.value.trim();
    if(!q) return;
    window.location.href=`shop.html?search=${encodeURIComponent(q)}`;
  });
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape' && !overlay.hidden) close();
    if(e.key==='/' && overlay.hidden && !/input|textarea|select/i.test(document.activeElement?.tagName || '')){
      e.preventDefault();
      open();
    }
  });
}

// DOMARO V19 — audience entry gate
function initEntryGate(){
  const gate=document.getElementById('entry-gate');
  if(!gate) return;

  let alreadyChosen=false;
  try{
    alreadyChosen=sessionStorage.getItem('domaroAudienceChosen')==='1';
  }catch(_){}

  if(alreadyChosen){
    gate.remove();
    return;
  }

  document.documentElement.classList.add('entry-gate-open');
  document.body.classList.add('entry-gate-open');
  gate.setAttribute('aria-hidden','false');

  gate.querySelectorAll('[data-entry-category]').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const category=btn.dataset.entryCategory;
      try{
        sessionStorage.setItem('domaroAudienceChosen','1');
        sessionStorage.setItem('domaroAudienceCategory',category);
      }catch(_){}
      window.location.href=`shop.html?category=${encodeURIComponent(category)}`;
    });
  });
}

// DOMARO V14 — mobile navigation
function initMobileNavigation(){
  const nav=document.querySelector('.nav');
  const links=document.querySelector('.navlinks');
  const icons=document.querySelector('.navicons');
  if(!nav || !links || !icons || nav.querySelector('.mobile-menu-toggle')) return;

  const button=document.createElement('button');
  button.type='button';
  button.className='mobile-menu-toggle';
  button.setAttribute('aria-label','Open menu');
  button.setAttribute('aria-expanded','false');
  button.innerHTML='<span></span><span></span><span></span>';

  nav.insertBefore(button, icons);

  const closeMenu=()=>{
    nav.classList.remove('mobile-nav-open');
    button.setAttribute('aria-expanded','false');
    button.setAttribute('aria-label','Open menu');
  };

  button.addEventListener('click',()=>{
    const opening=!nav.classList.contains('mobile-nav-open');
    nav.classList.toggle('mobile-nav-open',opening);
    button.setAttribute('aria-expanded',opening ? 'true' : 'false');
    button.setAttribute('aria-label',opening ? 'Close menu' : 'Open menu');
  });

  links.querySelectorAll('a').forEach(link=>link.addEventListener('click',closeMenu));

  document.addEventListener('click',e=>{
    if(window.innerWidth<=980 && nav.classList.contains('mobile-nav-open') && !nav.contains(e.target)){
      closeMenu();
    }
  });

  window.addEventListener('resize',()=>{
    if(window.innerWidth>980) closeMenu();
  });
}

async function initStore(){
  initEntryGate();
  initMobileNavigation();
  updateCartCount();
  await loadCatalog();
  initGlobalSearch();
  renderProducts('best-products','all',4);
  renderBrandDirectory();
  initFilters();
  initShopView();
  renderProductDetail();
  renderCart();
  renderCheckout();
  initOrderTracking();
  initDemoForms();
}

initStore();
