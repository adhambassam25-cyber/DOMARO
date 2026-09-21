// DOMARO V30 — customer experience, wishlist, accounts, bilingual UI,
// homepage settings, abandoned checkout capture, returns and optional analytics.

const V30_SUPABASE_URL = "https://zuqjxcsjjgotwwmlvxmf.supabase.co";
const V30_SUPABASE_KEY = "sb_publishable_gaSdKLisgpHYocKX5dYAmw_CZeW6s0c";

function v30Session(){
  try{ return JSON.parse(localStorage.getItem('domaro_customer_session') || 'null'); }catch(_){ return null; }
}
function v30SaveSession(session){
  if(session) localStorage.setItem('domaro_customer_session',JSON.stringify(session));
  else localStorage.removeItem('domaro_customer_session');
}
function v30Headers(extra={}){
  const token=v30Session()?.access_token || '';
  return {'apikey':V30_SUPABASE_KEY,...(token?{'Authorization':`Bearer ${token}`}:{ }),...extra};
}
async function v30RefreshSession(){
  const session=v30Session();
  if(!session?.refresh_token) return null;
  if(session.expires_at && Number(session.expires_at)*1000 > Date.now()+60000) return session;
  try{
    const r=await fetch(`${V30_SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`,{
      method:'POST',headers:{'apikey':V30_SUPABASE_KEY,'Content-Type':'application/json'},body:JSON.stringify({refresh_token:session.refresh_token})
    });
    const data=await r.json().catch(()=>null);
    if(!r.ok || !data?.access_token){ v30SaveSession(null); return null; }
    const next={...data,expires_at:Math.floor(Date.now()/1000)+Number(data.expires_in||3600)};
    v30SaveSession(next); return next;
  }catch(_){ return session; }
}

// ---------- Wishlist ----------
function getWishlist(){
  try{ const v=JSON.parse(localStorage.getItem('domaro_wishlist') || '[]'); return Array.isArray(v)?v.map(String):[]; }catch(_){ return []; }
}
function setWishlist(list){
  const clean=[...new Set((list||[]).map(String).filter(Boolean))];
  localStorage.setItem('domaro_wishlist',JSON.stringify(clean));
  document.querySelectorAll('[data-wishlist-product]').forEach(btn=>{
    const active=clean.includes(btn.dataset.wishlistProduct);
    btn.classList.toggle('active',active);
    btn.setAttribute('aria-pressed',active?'true':'false');
    btn.textContent=active?'♥':'♡';
  });
  const count=document.querySelector('[data-wishlist-count]');
  if(count) count.textContent=clean.length;
}
async function syncWishlistItem(productId,active){
  const session=await v30RefreshSession();
  if(!session?.access_token) return;
  try{
    await fetch(`${V30_SUPABASE_URL}/rest/v1/rpc/set_customer_wishlist`,{
      method:'POST',headers:v30Headers({'Content-Type':'application/json'}),
      body:JSON.stringify({p_product_id:productId,p_active:Boolean(active)})
    });
  }catch(_){}
}
function toggleWishlist(productId){
  const list=getWishlist();
  const active=!list.includes(productId);
  setWishlist(active?[...list,productId]:list.filter(x=>x!==productId));
  syncWishlistItem(productId,active);
  if(typeof toast==='function') toast(active?'Saved to wishlist':'Removed from wishlist');
}
function decorateProductCards(){
  document.querySelectorAll('.product-card[data-product-id]').forEach(card=>{
    if(card.querySelector('.wishlist-card-btn')) return;
    const id=card.dataset.productId;
    const btn=document.createElement('button');
    btn.type='button'; btn.className='wishlist-card-btn'; btn.dataset.wishlistProduct=id;
    btn.setAttribute('aria-label','Save to wishlist');
    btn.addEventListener('click',e=>{ e.preventDefault(); e.stopPropagation(); toggleWishlist(id); });
    card.appendChild(btn);
  });
  setWishlist(getWishlist());
}
window.DOMAROV30DecorateProductCards=decorateProductCards;

window.DOMAROV30InitProductExtras=function(product){
  const wishBtn=document.getElementById('wishlist-product-btn');
  if(wishBtn){
    wishBtn.dataset.wishlistProduct=product.id;
    wishBtn.onclick=()=>toggleWishlist(product.id);
    setWishlist(getWishlist());
  }
  const host=document.getElementById('product-recommendations');
  if(!host || typeof products==='undefined') return;
  let recent=[];
  try{ recent=JSON.parse(localStorage.getItem('domaro_recently_viewed')||'[]'); }catch(_){}
  const recentProducts=recent.filter(id=>id!==product.id).map(id=>products.find(p=>p.id===id)).filter(Boolean).slice(0,4);
  const recommended=products.filter(p=>p.id!==product.id && !recentProducts.some(r=>r.id===p.id) && (p.cat===product.cat || (product.brand && p.brand===product.brand))).slice(0,4);
  const sections=[];
  if(recentProducts.length) sections.push(`<div class="section-head"><div class="kicker">YOUR HISTORY</div><h2>RECENTLY VIEWED</h2></div><div class="products">${recentProducts.map(productCard).join('')}</div>`);
  if(recommended.length) sections.push(`<div class="section-head v30-rec-head"><div class="kicker">DISCOVER MORE</div><h2>YOU MAY ALSO LIKE</h2></div><div class="products">${recommended.map(productCard).join('')}</div>`);
  host.innerHTML=sections.join('');
  decorateProductCards();
};

// ---------- Public nav helpers ----------
function injectV30Nav(){
  document.querySelectorAll('.navicons').forEach(nav=>{
    if(!nav.querySelector('.nav-account-action')){
      const account=document.createElement('a');
      account.className='nav-action nav-account-action'; account.href='account.html'; account.title='My account'; account.setAttribute('aria-label','My account');
      account.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.5"></circle><path d="M5.5 20c.8-4 3-6 6.5-6s5.7 2 6.5 6"></path></svg><span class="nav-action-label">ACCOUNT</span>';
      nav.insertBefore(account,nav.querySelector('.nav-cart-action'));
    }
    if(!nav.querySelector('.nav-wishlist-action')){
      const wish=document.createElement('a');
      wish.className='nav-action nav-wishlist-action'; wish.href='account.html#wishlist'; wish.title='Wishlist'; wish.setAttribute('aria-label','Wishlist');
      wish.innerHTML='<span class="nav-heart-icon">♡</span><span class="nav-action-label">WISHLIST</span><span class="cart-pill wishlist-pill" data-wishlist-count>0</span>';
      nav.insertBefore(wish,nav.querySelector('.nav-account-action'));
    }
    if(!nav.querySelector('.nav-lang-toggle')){
      const lang=document.createElement('button'); lang.type='button'; lang.className='nav-action nav-lang-toggle'; lang.title='العربية / English';
      lang.innerHTML='<span class="nav-lang-text">AR</span>';
      lang.onclick=()=>setLanguage(getLanguage()==='ar'?'en':'ar');
      nav.insertBefore(lang,nav.firstChild);
    }
  });
  document.querySelectorAll('.nav-lang-toggle').forEach(lang=>{
    lang.onclick=()=>setLanguage(getLanguage()==='ar'?'en':'ar');
    const txt=lang.querySelector('.nav-lang-text');
    if(txt) txt.textContent=getLanguage()==='ar'?'EN':'AR';
  });
  document.querySelectorAll('[data-wishlist-count]').forEach(c=>{ c.textContent=getWishlist().length; });
}

// ---------- Bilingual UI ----------
const V30_TRANSLATIONS={
  'DELIVERY ACROSS EGYPT':'التوصيل متاح في جميع أنحاء مصر',
  'DOMARO FRAGRANCES':'عطور دومارو','A SCENT THAT BECOMES YOU':'عطر يعبر عنك',
  'FLAT SHIPPING 80 EGP ACROSS EGYPT':'شحن ثابت 80 جنيه داخل مصر',
  'SEARCH':'بحث','TRACK':'تتبع','CART':'السلة','ACCOUNT':'حسابي','WISHLIST':'المفضلة',
  'MEN':'رجالي','WOMEN':'حريمي','UNISEX':'للجنسين','BRANDS':'الماركات','SHOP ALL':'تسوق الكل','ABOUT':'عن دومارو','CONTACT':'تواصل معنا','HOME':'الرئيسية','SHOP':'المتجر','COLLECTIONS':'المجموعات','TRACK ORDER':'تتبع الطلب',
  'SHOP COLLECTION →':'تسوق المجموعة ←','OUR FAVORITES':'اختياراتنا','CURRENT COLLECTION':'المجموعة الحالية','FOR MEN':'للرجال','FOR WOMEN':'للنساء','DISCOVER →':'اكتشف ←',
  'SHOP FRAGRANCES':'تسوق العطور','SHOP BY BRAND':'تسوق حسب الماركة','ALL':'الكل','VIEW':'العرض','THUMBNAILS':'صور','LIST':'قائمة',
  'ADD TO CART':'أضف للسلة','OUT OF STOCK':'غير متوفر','AVAILABLE':'متوفر','SELECT SIZE':'اختر الحجم','THE STORY':'القصة','THE SCENT':'الرائحة','THE COMPOSITION':'التركيبة','TOP NOTES':'المقدمة','HEART NOTES':'القلب','BASE NOTES':'القاعدة','PRODUCT INFORMATION':'معلومات المنتج','DELIVERY':'التوصيل',
  'YOUR CART':'سلة التسوق','Subtotal':'الإجمالي الفرعي','Shipping':'الشحن','Total':'الإجمالي','CHECKOUT':'إتمام الطلب','REMOVE':'حذف',
  'CHECKOUT':'إتمام الطلب','REVIEW ORDER':'مراجعة الطلب','Cash on Delivery':'الدفع عند الاستلام','Pay when your order arrives.':'ادفع عند استلام طلبك.','ORDER SUMMARY':'ملخص الطلب','DISCOUNT CODE':'كود الخصم','APPLY':'تطبيق',
  'TRACK YOUR ORDER':'تتبع طلبك','ORDER STATUS':'حالة الطلب','Mobile number':'رقم الموبايل','Order number':'رقم الطلب','TRACK ORDER':'تتبع الطلب',
  'JOIN OUR NEWSLETTER':'انضم لقائمتنا البريدية','SHOP FRAGRANCES':'تسوق العطور','BACK TO SHOP':'العودة للمتجر','CONTINUE SHOPPING':'متابعة التسوق',
  'WHO ARE YOU':'لمن','SHOPPING FOR?':'تتسوق؟','Choose a collection to enter.':'اختر المجموعة للدخول.','WELCOME TO DOMARO':'مرحبًا بك في دومارو'
};
function getLanguage(){ return localStorage.getItem('domaro_lang')==='ar'?'ar':'en'; }
function translateTextNodes(root=document.body){
  if(getLanguage()!=='ar') return;
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,{acceptNode(node){
    if(!node.parentElement || ['SCRIPT','STYLE','TEXTAREA','INPUT'].includes(node.parentElement.tagName)) return NodeFilter.FILTER_REJECT;
    return NodeFilter.FILTER_ACCEPT;
  }});
  const nodes=[]; while(walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach(node=>{
    const raw=node.nodeValue; const t=raw.trim(); if(!t) return;
    if(!node.parentElement.dataset.enText) node.parentElement.dataset.enText=t;
    const tr=V30_TRANSLATIONS[t] || V30_TRANSLATIONS[t.toUpperCase()];
    if(tr) node.nodeValue=raw.replace(t,tr);
  });
  document.documentElement.lang='ar'; document.documentElement.dir='rtl'; document.body.classList.add('lang-ar');
  document.querySelectorAll('.nav-lang-text').forEach(x=>x.textContent='EN');
}
function restoreEnglish(){
  document.querySelectorAll('[data-en-text]').forEach(el=>{ if(el.childNodes.length===1 && el.firstChild.nodeType===3) el.textContent=el.dataset.enText; });
  document.documentElement.lang='en'; document.documentElement.dir='ltr'; document.body.classList.remove('lang-ar');
  document.querySelectorAll('.nav-lang-text').forEach(x=>x.textContent='AR');
}
function applyLanguage(){ getLanguage()==='ar'?translateTextNodes():restoreEnglish(); }
function setLanguage(lang){ localStorage.setItem('domaro_lang',lang==='ar'?'ar':'en'); location.reload(); }

function updateHomeProof(catalog=[]){
  const proof=document.querySelector('.hero-proof');
  if(!proof || !Array.isArray(catalog) || !catalog.length) return;
  const live=catalog.filter(p=>p && p.active!==false);
  const sizes=[...new Set(live.flatMap(p=>(Array.isArray(p.variants)&&p.variants.length?p.variants:[{size_ml:p.size_ml}])).map(v=>Number(v?.size_ml)).filter(n=>Number.isFinite(n)&&n>0))].sort((a,b)=>a-b);
  const productCell=proof.children?.[0];
  const sizeCell=proof.children?.[1];
  if(productCell) productCell.innerHTML=`<b>${live.length}</b>LIVE PRODUCT${live.length===1?'':'S'}`;
  if(sizeCell){
    if(sizes.length===1) sizeCell.innerHTML=`<b>${sizes[0]} ML</b>AVAILABLE SIZE`;
    else if(sizes.length>1) sizeCell.innerHTML=`<b>${sizes.length}</b>AVAILABLE SIZES`;
  }
}
window.addEventListener('domaro:catalog-ready',e=>{
  updateHomeProof(e.detail?.products||[]);
  applyStoreSettings(e.detail?.storeSettings||window.DOMARO_STORE_SETTINGS||{});
  setTimeout(applyLanguage,0);
});

// ---------- Homepage manager ----------
function applyStoreSettings(settings=window.DOMARO_STORE_SETTINGS||{}){
  if(!settings || typeof settings!=='object') return;
  const top=document.querySelector('.topbar'); if(top && settings.announcement) top.textContent=settings.announcement;
  const hero=document.querySelector('.hero-copy-only');
  if(hero){
    const eye=hero.querySelector('.eyebrow'); const h1=hero.querySelector('h1'); const p=hero.querySelector('p'); const a=hero.querySelector('a.btn');
    if(eye && settings.hero_eyebrow) eye.textContent=settings.hero_eyebrow;
    if(h1 && settings.hero_title) h1.textContent=settings.hero_title;
    if(p && settings.hero_subtitle) p.textContent=settings.hero_subtitle;
    if(a && settings.hero_cta_label){ a.textContent=settings.hero_cta_label+' →'; a.href=settings.hero_cta_href||'shop.html'; }
  }
  if(settings.promo_title || settings.promo_text){
    let promo=document.getElementById('v30-home-promo');
    if(!promo){ promo=document.createElement('section'); promo.id='v30-home-promo'; promo.className='v30-home-promo'; const anchor=document.querySelector('.category-strip'); anchor?.insertAdjacentElement('afterend',promo); }
    promo.innerHTML=`<div class="container"><div class="v30-promo-copy"><span>DOMARO EDIT</span><h2>${escapeTrackHtml(settings.promo_title||'')}</h2><p>${escapeTrackHtml(settings.promo_text||'')}</p>${settings.promo_link_href?`<a class="btn dark" href="${escapeTrackHtml(settings.promo_link_href)}">${escapeTrackHtml(settings.promo_link_label||'DISCOVER')} →</a>`:''}</div></div>`;
  }
  initAnalytics(settings);
}

function initAnalytics(settings){
  if(window.__domaroAnalyticsInit) return; window.__domaroAnalyticsInit=true;
  const ga=String(settings?.ga4_id||'').trim();
  if(/^G-[A-Z0-9]+$/i.test(ga)){
    const s=document.createElement('script'); s.async=true; s.src=`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(ga)}`; document.head.appendChild(s);
    window.dataLayer=window.dataLayer||[]; window.gtag=function(){dataLayer.push(arguments)}; gtag('js',new Date()); gtag('config',ga);
  }
  const meta=String(settings?.meta_pixel_id||'').trim();
  if(/^\d{5,20}$/.test(meta)){
    !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
    fbq('init',meta); fbq('track','PageView');
  }
  const tt=String(settings?.tiktok_pixel_id||'').trim();
  if(/^[A-Z0-9]{10,30}$/i.test(tt)){
    !function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=['page','track','identify','instances','debug','on','off','once','ready','alias','group','enableCookie','disableCookie'];ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.load=function(e){var n='https://analytics.tiktok.com/i18n/pixel/events.js';var s=d.createElement('script');s.type='text/javascript';s.async=!0;s.src=n+'?sdkid='+e+'&lib='+t;var a=d.getElementsByTagName('script')[0];a.parentNode.insertBefore(s,a)};ttq.load(tt);ttq.page()}(window,document,'ttq');
  }
}

// ---------- Abandoned checkout capture ----------
function initCheckoutCapture(){
  const form=document.getElementById('checkout-form'); if(!form) return;
  let timer=null;
  const save=async()=>{
    let token=sessionStorage.getItem('domaro_checkout_token');
    if(!token){ token=(crypto?.randomUUID?crypto.randomUUID():`domaro-${Date.now()}-${Math.random().toString(36).slice(2)}`); sessionStorage.setItem('domaro_checkout_token',token); }
    const items=(typeof getCart==='function'?getCart():[]).map(x=>({id:x.id,variant_id:x.variantId||null,qty:x.qty}));
    try{ await fetch(`${V30_SUPABASE_URL}/rest/v1/rpc/save_checkout_session`,{method:'POST',headers:{'apikey':V30_SUPABASE_KEY,'Content-Type':'application/json'},body:JSON.stringify({p_token:token,p_phone:document.getElementById('phone')?.value.trim()||null,p_first_name:document.getElementById('first-name')?.value.trim()||null,p_last_name:document.getElementById('last-name')?.value.trim()||null,p_items:items})}); }catch(_){}
  };
  const schedule=()=>{ clearTimeout(timer); timer=setTimeout(save,800); };
  form.addEventListener('input',schedule); form.addEventListener('change',schedule); schedule();
}

// ---------- Tracking return request ----------
function initReturnRequestEnhancement(){
  const result=document.getElementById('track-result'); const form=document.getElementById('track-order-form'); if(!result||!form) return;
  const observer=new MutationObserver(()=>{
    if(result.hidden || result.querySelector('.v30-return-box')) return;
    const status=(result.querySelector('.track-status')?.textContent||result.textContent||'').toLowerCase();
    if(!status.includes('delivered')) return;
    const box=document.createElement('div'); box.className='v30-return-box';
    box.innerHTML=`<div><span>AFTER-SALES</span><h3>REQUEST A RETURN</h3><p>Submit a return request for this delivered order. DOMARO will review it before any refund is approved.</p></div><select id="v30-return-reason"><option value="">Select reason</option><option>Wrong item received</option><option>Item damaged</option><option>Changed my mind</option><option>Other</option></select><textarea id="v30-return-details" placeholder="Optional details"></textarea><button class="btn dark" id="v30-return-submit" type="button">SUBMIT RETURN REQUEST</button><div class="checkout-error" id="v30-return-message"></div>`;
    result.appendChild(box);
    box.querySelector('#v30-return-submit').onclick=async()=>{
      const reason=box.querySelector('#v30-return-reason').value; const msg=box.querySelector('#v30-return-message');
      if(!reason){msg.textContent='Please select a reason.';return;}
      const btn=box.querySelector('#v30-return-submit'); btn.disabled=true;
      try{
        const r=await fetch(`${V30_SUPABASE_URL}/rest/v1/rpc/request_return`,{method:'POST',headers:{'apikey':V30_SUPABASE_KEY,'Content-Type':'application/json'},body:JSON.stringify({p_order_number:document.getElementById('track-order-number').value.trim(),p_phone:document.getElementById('track-phone').value.trim(),p_reason:reason,p_details:box.querySelector('#v30-return-details').value.trim()||null})});
        const data=await r.json().catch(()=>null); if(!r.ok) throw new Error(data?.message||'Could not submit return request.');
        msg.className='coupon-message coupon-message-success'; msg.textContent='Return request submitted successfully.'; btn.remove();
      }catch(err){ msg.textContent=err.message||'Could not submit return request.'; btn.disabled=false; }
    };
  });
  observer.observe(result,{childList:true,subtree:true,attributes:true});
}

// ---------- Customer account page ----------
async function accountFetchProfile(){
  const session=await v30RefreshSession(); if(!session?.access_token) return null;
  const r=await fetch(`${V30_SUPABASE_URL}/rest/v1/customer_profiles?select=*&user_id=eq.${encodeURIComponent(session.user.id)}&limit=1`,{headers:v30Headers()});
  if(!r.ok) return null; const rows=await r.json().catch(()=>[]); return rows?.[0]||null;
}
async function accountOrders(){
  const r=await fetch(`${V30_SUPABASE_URL}/rest/v1/rpc/my_customer_orders`,{method:'POST',headers:v30Headers({'Content-Type':'application/json'}),body:'{}'}); if(!r.ok) return []; return await r.json().catch(()=>[]);
}
async function accountRemoteWishlist(){
  const r=await fetch(`${V30_SUPABASE_URL}/rest/v1/customer_wishlist?select=product_id&order=created_at.desc`,{headers:v30Headers()}); if(!r.ok) return []; return (await r.json().catch(()=>[])).map(x=>x.product_id);
}
function printCustomerInvoice(order,profile){
  const items=(order.items||[]).map(i=>`<tr><td>${escapeTrackHtml(i.product_name)}</td><td>${escapeTrackHtml(i.variant_label||((i.size_ml||'')+' ML'))}</td><td>${i.quantity}</td><td>${money(i.unit_price)}</td><td>${money(i.line_total)}</td></tr>`).join('');
  const w=window.open('','_blank','width=900,height=700'); if(!w) return;
  w.document.write(`<!doctype html><html><head><title>DOMARO Invoice ${escapeTrackHtml(order.order_number)}</title><style>body{font-family:Arial;padding:35px;color:#111}h1{letter-spacing:5px}table{width:100%;border-collapse:collapse;margin-top:25px}th,td{padding:10px;border-bottom:1px solid #ddd;text-align:left}.totals{margin-top:25px;margin-left:auto;width:320px}.totals div{display:flex;justify-content:space-between;padding:7px 0}.grand{font-size:20px;font-weight:bold;border-top:2px solid #111}.muted{color:#666}</style></head><body><h1>DOMARO</h1><p class="muted">Invoice / Receipt</p><h2>${escapeTrackHtml(order.order_number)}</h2><p>${escapeTrackHtml(profile?.first_name||'')} ${escapeTrackHtml(profile?.last_name||'')}<br>${escapeTrackHtml(profile?.phone||'')}<br>${escapeTrackHtml(order.address||'')}</p><table><thead><tr><th>Product</th><th>Option</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead><tbody>${items}</tbody></table><div class="totals"><div><span>Subtotal</span><b>${money(order.subtotal)}</b></div><div><span>Shipping</span><b>${money(order.shipping)}</b></div><div><span>Discount</span><b>-${money(order.discount)}</b></div><div class="grand"><span>Total</span><b>${money(order.total)}</b></div></div><script>window.onload=()=>window.print()<\/script></body></html>`); w.document.close();
}
async function initAccountPage(){
  const shell=document.getElementById('v30-account-shell'); if(!shell) return;
  const authBox=document.getElementById('v30-account-auth'); const dashboard=document.getElementById('v30-account-dashboard'); const message=document.getElementById('v30-account-message');
  const render=async()=>{
    const session=await v30RefreshSession();
    if(!session?.access_token){ authBox.hidden=false; dashboard.hidden=true; return; }
    authBox.hidden=true; dashboard.hidden=false;
    const [profile,orders,remote]=await Promise.all([accountFetchProfile(),accountOrders(),accountRemoteWishlist()]);
    const localBefore=getWishlist();
    const merged=[...new Set([...localBefore,...remote])]; setWishlist(merged);
    localBefore.filter(id=>!remote.includes(id)).forEach(id=>syncWishlistItem(id,true));
    document.getElementById('v30-account-name').textContent=((profile?.first_name||'')+' '+(profile?.last_name||'')).trim() || session.user?.email || 'DOMARO CUSTOMER';
    document.getElementById('v30-account-profile').innerHTML=profile?`<div><span>EMAIL</span><b>${escapeTrackHtml(profile.email||session.user?.email||'')}</b></div><div><span>MOBILE</span><b>${escapeTrackHtml(profile.phone||'')}</b></div>`:'<p>Complete your profile below to connect your orders.</p>';
    const ordersEl=document.getElementById('v30-account-orders');
    ordersEl.innerHTML=orders.length?orders.map(o=>`<article class="account-order-card"><div><span>${new Date(o.created_at).toLocaleDateString('en-EG')}</span><h3>${escapeTrackHtml(o.order_number)}</h3><p>${escapeTrackHtml(String(o.status||'').toUpperCase())} · ${money(o.total)}</p></div><div class="account-order-actions"><a class="admin-secondary-btn" href="track.html?order=${encodeURIComponent(o.order_number)}">TRACK</a><button class="admin-secondary-btn v30-invoice-btn" data-order-id="${escapeTrackHtml(o.id)}">PRINT / SAVE PDF</button></div></article>`).join(''):'<div class="empty">No orders are connected to this account yet.</div>';
    ordersEl.querySelectorAll('.v30-invoice-btn').forEach(btn=>btn.onclick=()=>{ const o=orders.find(x=>x.id===btn.dataset.orderId); if(o) printCustomerInvoice(o,profile); });
    const wishEl=document.getElementById('v30-account-wishlist');
    const wishProducts=merged.map(id=>typeof products!=='undefined'?products.find(p=>p.id===id):null).filter(Boolean);
    wishEl.innerHTML=wishProducts.length?`<div class="products">${wishProducts.map(productCard).join('')}</div>`:'<div class="empty">Your wishlist is empty.</div>'; decorateProductCards();
    if(profile){ document.getElementById('v30-profile-first').value=profile.first_name||''; document.getElementById('v30-profile-last').value=profile.last_name||''; document.getElementById('v30-profile-phone').value=profile.phone||''; }
  };
  document.getElementById('v30-login-form').onsubmit=async e=>{
    e.preventDefault(); message.textContent=''; const fd=new FormData(e.currentTarget);
    const r=await fetch(`${V30_SUPABASE_URL}/auth/v1/token?grant_type=password`,{method:'POST',headers:{'apikey':V30_SUPABASE_KEY,'Content-Type':'application/json'},body:JSON.stringify({email:fd.get('email'),password:fd.get('password')})});
    const data=await r.json().catch(()=>null); if(!r.ok){message.textContent=data?.error_description||data?.msg||'Could not sign in.';return;}
    v30SaveSession({...data,expires_at:Math.floor(Date.now()/1000)+Number(data.expires_in||3600)}); await render();
  };
  document.getElementById('v30-signup-form').onsubmit=async e=>{
    e.preventDefault(); message.textContent=''; const fd=new FormData(e.currentTarget); const email=fd.get('email'); const password=fd.get('password'); const phone=fd.get('phone');
    if(!/^01[0125][0-9]{8}$/.test(phone)){message.textContent='Enter a valid Egyptian mobile number.';return;}
    const r=await fetch(`${V30_SUPABASE_URL}/auth/v1/signup`,{method:'POST',headers:{'apikey':V30_SUPABASE_KEY,'Content-Type':'application/json'},body:JSON.stringify({email,password})}); const data=await r.json().catch(()=>null);
    if(!r.ok){message.textContent=data?.msg||data?.error_description||'Could not create account.';return;}
    if(!data?.access_token){message.textContent='Account created. Check your email if confirmation is required, then sign in.';return;}
    v30SaveSession({...data,expires_at:Math.floor(Date.now()/1000)+Number(data.expires_in||3600)});
    const pr=await fetch(`${V30_SUPABASE_URL}/rest/v1/rpc/upsert_customer_profile`,{method:'POST',headers:v30Headers({'Content-Type':'application/json'}),body:JSON.stringify({p_email:email,p_first_name:fd.get('first_name'),p_last_name:fd.get('last_name'),p_phone:phone})});
    if(!pr.ok){ const er=await pr.json().catch(()=>null); message.textContent=er?.message||'Account created, but profile could not be saved.'; }
    await render();
  };
  document.getElementById('v30-profile-form').onsubmit=async e=>{
    e.preventDefault(); const session=await v30RefreshSession(); if(!session) return; const fd=new FormData(e.currentTarget);
    const r=await fetch(`${V30_SUPABASE_URL}/rest/v1/rpc/upsert_customer_profile`,{method:'POST',headers:v30Headers({'Content-Type':'application/json'}),body:JSON.stringify({p_email:session.user?.email||'',p_first_name:fd.get('first_name'),p_last_name:fd.get('last_name'),p_phone:fd.get('phone')})});
    const data=await r.json().catch(()=>null); message.textContent=r.ok?'Profile saved.':(data?.message||'Could not save profile.'); if(r.ok) await render();
  };
  document.getElementById('v30-account-logout').onclick=()=>{v30SaveSession(null); render();};
  await render();
}

// ---------- boot ----------
function v30OnCatalogReady(){
  // Product recommendations are initialized by app.js only after renderProductDetail()
  // creates the product DOM. Running them here as well caused duplicate
  // Recently Viewed / You May Also Like sections on product pages.
  injectV30Nav(); decorateProductCards(); applyStoreSettings(window.DOMARO_STORE_SETTINGS||{}); applyLanguage();
}
window.addEventListener('domaro:catalog-ready',v30OnCatalogReady);
window.addEventListener('load',()=>{
  injectV30Nav(); setWishlist(getWishlist()); applyLanguage(); initCheckoutCapture(); initReturnRequestEnhancement(); initAccountPage();
  if(window.DOMARO_STORE_SETTINGS) applyStoreSettings(window.DOMARO_STORE_SETTINGS);
  decorateProductCards();
});
