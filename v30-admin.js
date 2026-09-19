// DOMARO V30 — advanced admin modules: variants, gallery, returns,
// abandoned checkout, store manager, profit/goal, audit and backup.

const V30A_URL=window.DOMARO_ADMIN_CONFIG?.SUPABASE_URL;
const V30A_KEY=window.DOMARO_ADMIN_CONFIG?.SUPABASE_KEY;
let v30Profile=null;
let v30CurrentProductId=null;
let v30VariantRows=[];
let v30GalleryRows=[];
let v304DeliveryZones=[];
const V304_GOVERNORATES=['Cairo','Giza','Alexandria','Qalyubia','Sharqia','Dakahlia','Gharbia','Monufia','Beheira','Kafr El Sheikh','Damietta','Port Said','Ismailia','Suez','Fayoum','Beni Suef','Minya','Assiut','Sohag','Qena','Luxor','Aswan','Red Sea','New Valley','Matrouh','North Sinai','South Sinai'];

function v30Token(){ return sessionStorage.getItem('domaro_admin_access_token')||''; }
function v30AH(extra={}){ const t=v30Token(); return {'apikey':V30A_KEY,...(t?{'Authorization':`Bearer ${t}`}:{ }),...extra}; }
function v30Esc(v){ return String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;'); }
function v30Money(n){ return Number(n||0).toLocaleString('en-EG')+' EGP'; }
async function v30Json(url,options={}){ const r=await fetch(url,{...options,headers:v30AH(options.headers||{})}); const data=await r.json().catch(()=>null); if(!r.ok) throw new Error(data?.message||data?.details||data?.error||'Request failed'); return data; }

function createV30Modal(id,title,body){
  let el=document.getElementById(id);
  if(!el){ el=document.createElement('section'); el.id=id; el.className='product-modal v30-admin-modal'; el.hidden=true; document.body.appendChild(el); }
  el.innerHTML=`<div class="product-modal-backdrop" data-v30-close></div><div class="product-modal-card v30-modal-card"><div class="product-modal-head"><div><div class="eyebrow" style="color:#766b5d">DOMARO V30</div><h2>${v30Esc(title)}</h2></div><button class="product-modal-close" data-v30-close type="button">×</button></div>${body}</div>`;
  el.querySelectorAll('[data-v30-close]').forEach(x=>x.onclick=()=>{el.hidden=true;document.body.classList.remove('modal-open')});
  el.hidden=false; document.body.classList.add('modal-open'); return el;
}

// ---------- VARIANTS ----------
async function loadVariantRows(productId){
  v30VariantRows=await v30Json(`${V30A_URL}/rest/v1/product_variants?select=*&product_id=eq.${encodeURIComponent(productId)}&order=sort_order.asc,created_at.asc`);
  return v30VariantRows;
}
function variantEditorHtml(product){
  return `<div class="v30-manager-head"><div><span>PRODUCT</span><b>${v30Esc(product?.name||v30CurrentProductId)}</b></div><button id="v30-add-variant" class="admin-primary-btn" type="button">+ ADD VARIANT</button></div><div id="v30-variant-message" class="admin-error"></div><div id="v30-variant-list" class="v30-variant-list"></div><div id="v30-variant-form-wrap" hidden></div>`;
}
function renderVariantRows(modal){
  const list=modal.querySelector('#v30-variant-list');
  list.innerHTML=v30VariantRows.length?v30VariantRows.map(v=>`<article class="v30-variant-row"><div><span>${v.is_default?'DEFAULT · ':''}${v30Esc(v.sku||'NO SKU')}</span><h3>${v30Esc(v.label)}</h3><p>${v30Esc(v.size_ml)} ML · ${v30Money(v.price)} · Cost ${v.cost_price==null?'—':v30Money(v.cost_price)}</p></div><div><b>${v.stock_quantity==null?'UNTRACKED':`${v.stock_quantity} UNITS`}</b><small>${v.active?'LIVE':'HIDDEN'} · ${v.in_stock?'IN STOCK':'OUT'}</small></div><div class="v30-row-actions"><button class="admin-secondary-btn" data-edit-variant="${v30Esc(v.id)}">EDIT</button>${v30VariantRows.length>1?`<button class="admin-secondary-btn admin-danger-btn" data-delete-variant="${v30Esc(v.id)}">DELETE</button>`:''}</div></article>`).join(''):'<div class="admin-empty">No variants yet.</div>';
  list.querySelectorAll('[data-edit-variant]').forEach(btn=>btn.onclick=()=>showVariantForm(modal,v30VariantRows.find(v=>v.id===btn.dataset.editVariant)));
  list.querySelectorAll('[data-delete-variant]').forEach(btn=>btn.onclick=()=>deleteVariant(modal,btn.dataset.deleteVariant));
}
function showVariantForm(modal,variant=null){
  const wrap=modal.querySelector('#v30-variant-form-wrap'); wrap.hidden=false;
  wrap.innerHTML=`<form id="v30-variant-form" class="v30-inline-form"><h3>${variant?'EDIT':'ADD'} VARIANT</h3><input name="id" type="hidden" value="${v30Esc(variant?.id||'')}"><div class="form-row"><label>Label<input name="label" required value="${v30Esc(variant?.label||'')}" placeholder="100 ML"></label><label>SKU<input name="sku" value="${v30Esc(variant?.sku||'')}" placeholder="DOM-100-BLUE"></label></div><div class="form-row"><label>Size (ML)<input name="size_ml" type="number" min="1" required value="${v30Esc(variant?.size_ml||'')}"></label><label>Price (EGP)<input name="price" type="number" min="0" step="0.01" required value="${v30Esc(variant?.price??'')}"></label></div><div class="form-row"><label>Cost price<input name="cost_price" type="number" min="0" step="0.01" value="${v30Esc(variant?.cost_price??'')}"></label><label>Stock quantity<input name="stock_quantity" type="number" min="0" step="1" value="${v30Esc(variant?.stock_quantity??'')}"></label></div><div class="product-switch-grid"><label class="product-toggle"><input name="active" type="checkbox" ${variant?.active!==false?'checked':''}><span>LIVE</span></label><label class="product-toggle"><input name="in_stock" type="checkbox" ${variant?.in_stock!==false?'checked':''}><span>IN STOCK</span></label><label class="product-toggle"><input name="is_default" type="checkbox" ${variant?.is_default?'checked':''}><span>DEFAULT</span></label></div><div class="v30-row-actions"><button class="admin-primary-btn" type="submit">SAVE VARIANT</button><button id="v30-cancel-variant" class="admin-secondary-btn" type="button">CANCEL</button></div></form>`;
  wrap.querySelector('#v30-cancel-variant').onclick=()=>{wrap.hidden=true;wrap.innerHTML=''};
  wrap.querySelector('#v30-variant-form').onsubmit=async e=>{
    e.preventDefault(); const fd=new FormData(e.currentTarget); const msg=modal.querySelector('#v30-variant-message'); msg.textContent='';
    const stockRaw=String(fd.get('stock_quantity')||'').trim();
    const payload={product_id:v30CurrentProductId,label:String(fd.get('label')).trim(),sku:String(fd.get('sku')||'').trim()||null,size_ml:Number(fd.get('size_ml')),price:Number(fd.get('price')),cost_price:String(fd.get('cost_price')||'').trim()===''?null:Number(fd.get('cost_price')),stock_quantity:stockRaw===''?null:Number(stockRaw),active:fd.get('active')==='on',in_stock:fd.get('in_stock')==='on',is_default:fd.get('is_default')==='on',updated_at:new Date().toISOString()};
    if(payload.stock_quantity!==null) payload.in_stock=payload.stock_quantity>0;
    try{
      const id=String(fd.get('id')||'');
      if(payload.is_default){ await fetch(`${V30A_URL}/rest/v1/product_variants?product_id=eq.${encodeURIComponent(v30CurrentProductId)}&is_default=eq.true`,{method:'PATCH',headers:v30AH({'Content-Type':'application/json'}),body:JSON.stringify({is_default:false,updated_at:new Date().toISOString()})}); }
      if(id) await v30Json(`${V30A_URL}/rest/v1/product_variants?id=eq.${encodeURIComponent(id)}`,{method:'PATCH',headers:{'Content-Type':'application/json','Prefer':'return=representation'},body:JSON.stringify(payload)});
      else await v30Json(`${V30A_URL}/rest/v1/product_variants`,{method:'POST',headers:{'Content-Type':'application/json','Prefer':'return=representation'},body:JSON.stringify(payload)});
      await loadVariantRows(v30CurrentProductId); renderVariantRows(modal); wrap.hidden=true; wrap.innerHTML='';
      if(typeof loadProducts==='function') loadProducts();
    }catch(err){ msg.textContent=err.message; }
  };
}
async function deleteVariant(modal,id){
  const v=v30VariantRows.find(x=>x.id===id);
  if(!v) return;
  if(v.is_default){ modal.querySelector('#v30-variant-message').textContent='Set another variant as DEFAULT before deleting the current default variant.'; return; }
  if(!confirm(`Delete variant ${v.label}?`)) return;
  const msg=modal.querySelector('#v30-variant-message');
  try{ await v30Json(`${V30A_URL}/rest/v1/product_variants?id=eq.${encodeURIComponent(id)}`,{method:'DELETE',headers:{'Prefer':'return=representation'}}); await loadVariantRows(v30CurrentProductId); renderVariantRows(modal); if(typeof loadProducts==='function') loadProducts(); }catch(err){msg.textContent=err.message;}
}
async function openVariants(productId){
  v30CurrentProductId=productId; const product=(typeof allProducts!=='undefined'?allProducts:[]).find(p=>p.id===productId);
  const modal=createV30Modal('v30-variants-modal','PRODUCT VARIANTS',variantEditorHtml(product));
  const msg=modal.querySelector('#v30-variant-message'); try{await loadVariantRows(productId);renderVariantRows(modal);}catch(err){msg.textContent=err.message;}
  modal.querySelector('#v30-add-variant').onclick=()=>showVariantForm(modal,null);
}

// ---------- GALLERY ----------
async function loadGalleryRows(productId){ v30GalleryRows=await v30Json(`${V30A_URL}/rest/v1/product_images?select=*&product_id=eq.${encodeURIComponent(productId)}&order=sort_order.asc,id.asc`); return v30GalleryRows; }
async function uploadGalleryFile(productId,file){
  if(file.size>5*1024*1024) throw new Error(`${file.name} is larger than 5 MB.`);
  const safe=String(file.name||'image.jpg').toLowerCase().replace(/[^a-z0-9.]+/g,'-'); const path=`${productId}/gallery/${Date.now()}-${Math.random().toString(36).slice(2,7)}-${safe}`;
  const r=await fetch(`${V30A_URL}/storage/v1/object/products/${path.split('/').map(encodeURIComponent).join('/')}`,{method:'POST',headers:v30AH({'Content-Type':file.type||'application/octet-stream','x-upsert':'false'}),body:file}); const data=await r.json().catch(()=>null); if(!r.ok) throw new Error(data?.message||'Could not upload gallery image.');
  return `${V30A_URL}/storage/v1/object/public/products/${path.split('/').map(encodeURIComponent).join('/')}`;
}
function galleryStorageObjectPath(publicUrl){
  try{
    const url=new URL(publicUrl);
    const marker='/storage/v1/object/public/products/';
    const i=url.pathname.indexOf(marker);
    if(i<0) return '';
    return decodeURIComponent(url.pathname.slice(i+marker.length));
  }catch(_){ return ''; }
}
async function deleteGalleryStorage(publicUrl){
  const path=galleryStorageObjectPath(publicUrl);
  if(!path) return;
  const r=await fetch(`${V30A_URL}/storage/v1/object/products/${path.split('/').map(encodeURIComponent).join('/')}`,{method:'DELETE',headers:v30AH()});
  if(!r.ok && r.status!==404){
    const data=await r.json().catch(()=>null);
    throw new Error(data?.message||'Could not delete gallery image from storage.');
  }
}
function renderGallery(modal){
  const list=modal.querySelector('#v30-gallery-list'); list.innerHTML=v30GalleryRows.length?v30GalleryRows.map(i=>`<article class="v30-gallery-item"><img src="${v30Esc(i.image_path)}" alt=""><div><b>${v30Esc(i.alt_text||'Gallery image')}</b><small>Order ${i.sort_order||0}</small></div><button class="admin-secondary-btn admin-danger-btn" data-gallery-delete="${i.id}">DELETE</button></article>`).join(''):'<div class="admin-empty">No extra gallery images yet.</div>';
  list.querySelectorAll('[data-gallery-delete]').forEach(btn=>btn.onclick=async()=>{ if(!confirm('Delete this gallery image?'))return; try{const row=v30GalleryRows.find(x=>String(x.id)===String(btn.dataset.galleryDelete));if(row?.image_path)await deleteGalleryStorage(row.image_path);await v30Json(`${V30A_URL}/rest/v1/product_images?id=eq.${btn.dataset.galleryDelete}`,{method:'DELETE',headers:{'Prefer':'return=representation'}});await loadGalleryRows(v30CurrentProductId);renderGallery(modal);}catch(err){modal.querySelector('#v30-gallery-message').textContent=err.message;} });
}
async function openGallery(productId){
  v30CurrentProductId=productId; const product=(typeof allProducts!=='undefined'?allProducts:[]).find(p=>p.id===productId);
  const modal=createV30Modal('v30-gallery-modal','PRODUCT GALLERY',`<div class="v30-manager-head"><div><span>PRODUCT</span><b>${v30Esc(product?.name||productId)}</b></div></div><div class="product-image-editor v30-gallery-uploader"><div><label>Add gallery images</label><input id="v30-gallery-files" type="file" accept="image/jpeg,image/png,image/webp" multiple><small>Up to 5 MB each. Primary product image stays unchanged.</small></div><button id="v30-gallery-upload" class="admin-primary-btn" type="button">UPLOAD IMAGES</button></div><div id="v30-gallery-message" class="admin-error"></div><div id="v30-gallery-list" class="v30-gallery-list"></div>`);
  try{await loadGalleryRows(productId);renderGallery(modal);}catch(err){modal.querySelector('#v30-gallery-message').textContent=err.message;}
  modal.querySelector('#v30-gallery-upload').onclick=async()=>{const files=[...(modal.querySelector('#v30-gallery-files').files||[])];if(!files.length)return;const btn=modal.querySelector('#v30-gallery-upload');btn.disabled=true;try{for(let i=0;i<files.length;i++){const url=await uploadGalleryFile(productId,files[i]);await v30Json(`${V30A_URL}/rest/v1/product_images`,{method:'POST',headers:{'Content-Type':'application/json','Prefer':'return=representation'},body:JSON.stringify({product_id:productId,image_path:url,alt_text:product?.name||'',sort_order:v30GalleryRows.length+i+1})});}await loadGalleryRows(productId);renderGallery(modal);modal.querySelector('#v30-gallery-files').value='';}catch(err){modal.querySelector('#v30-gallery-message').textContent=err.message;}finally{btn.disabled=false;}};
}

function bindProductManagers(){
  document.querySelectorAll('.v30-manage-variants-btn:not([data-v30-bound])').forEach(btn=>{btn.dataset.v30Bound='1';btn.onclick=()=>openVariants(btn.dataset.id)});
  document.querySelectorAll('.v30-manage-gallery-btn:not([data-v30-bound])').forEach(btn=>{btn.dataset.v30Bound='1';btn.onclick=()=>openGallery(btn.dataset.id)});
}

// ---------- CUSTOM TABS ----------
function v30HideCustomPanels(){ document.querySelectorAll('.v30-admin-panel').forEach(p=>p.hidden=true); document.querySelectorAll('.v30-admin-tab').forEach(t=>t.classList.remove('active')); }
function v30OpenCustom(panelId,tab){
  document.querySelectorAll('.admin-panel').forEach(p=>p.hidden=true); v30HideCustomPanels(); const p=document.getElementById(panelId); if(p)p.hidden=false; document.querySelectorAll('.admin-tab').forEach(t=>t.classList.remove('active')); tab.classList.add('active');
}
function addV30Tab(key,label,ownerOnly=false){
  const tabs=document.querySelector('.admin-tabs'); if(!tabs||document.querySelector(`[data-v30-tab="${key}"]`))return null;
  const b=document.createElement('button');b.type='button';b.className='admin-tab v30-admin-tab';b.dataset.v30Tab=key;b.textContent=label;if(ownerOnly&&!v30Profile?.role?.toLowerCase().includes('owner'))b.hidden=true;tabs.appendChild(b);return b;
}
function addV30Panel(id,html){ if(document.getElementById(id))return document.getElementById(id);const p=document.createElement('section');p.id=id;p.className='admin-panel v30-admin-panel';p.hidden=true;p.innerHTML=html;document.getElementById('admin-dashboard').appendChild(p);return p; }

async function loadReturns(){
  const host=document.getElementById('v30-returns-list'); const err=document.getElementById('v30-returns-error'); if(!host)return; err.textContent='';host.innerHTML='<div class="admin-loading">Loading returns…</div>';
  try{const rows=await v30Json(`${V30A_URL}/rest/v1/returns?select=*&order=created_at.desc&limit=100`);host.innerHTML=rows.length?rows.map(r=>`<article class="v30-return-admin-card"><div><span>${v30Esc(new Date(r.created_at).toLocaleString('en-EG'))}</span><h3>${v30Esc(r.order_number)}</h3><p>${v30Esc(r.phone)} · ${v30Esc(r.reason)}</p>${r.details?`<small>${v30Esc(r.details)}</small>`:''}</div><div class="v30-return-controls"><select data-return-status="${r.id}">${['requested','approved','rejected','received','refunded','closed'].map(s=>`<option value="${s}" ${r.status===s?'selected':''}>${s.toUpperCase()}</option>`).join('')}</select><input data-return-refund="${r.id}" type="number" min="0" step="0.01" placeholder="Refund amount" value="${r.refund_amount??''}"><input data-return-note="${r.id}" placeholder="Admin note" value="${v30Esc(r.admin_note||'')}"><button class="admin-primary-btn" data-return-save="${r.id}">SAVE</button></div></article>`).join(''):'<div class="admin-empty">No return requests.</div>';host.querySelectorAll('[data-return-save]').forEach(btn=>btn.onclick=async()=>{try{const id=btn.dataset.returnSave;const status=host.querySelector(`[data-return-status="${id}"]`).value;const raw=host.querySelector(`[data-return-refund="${id}"]`).value;const note=host.querySelector(`[data-return-note="${id}"]`).value;await v30Json(`${V30A_URL}/rest/v1/rpc/update_return_status`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({p_return_id:id,p_status:status,p_refund_amount:raw===''?null:Number(raw),p_admin_note:note||null})});await loadReturns();}catch(e){err.textContent=e.message;}});}catch(e){err.textContent=e.message;host.innerHTML='';}
}

async function loadAbandoned(){
  const host=document.getElementById('v30-abandoned-list');const err=document.getElementById('v30-abandoned-error');if(!host)return;err.textContent='';
  try{const rows=await v30Json(`${V30A_URL}/rest/v1/checkout_sessions?select=*&status=eq.active&order=last_seen_at.desc&limit=100`);const now=Date.now();const abandoned=rows.filter(r=>now-new Date(r.last_seen_at).getTime()>=30*60*1000);host.innerHTML=abandoned.length?abandoned.map(r=>{const count=Array.isArray(r.cart_items)?r.cart_items.reduce((a,x)=>a+Number(x.qty||0),0):0;return `<article class="v30-abandoned-card"><div><span>LAST ACTIVE ${v30Esc(new Date(r.last_seen_at).toLocaleString('en-EG'))}</span><h3>${v30Esc([r.first_name,r.last_name].filter(Boolean).join(' ')||'UNIDENTIFIED CUSTOMER')}</h3><p>${v30Esc(r.phone||'No phone captured')} · ${count} item${count===1?'':'s'} in cart</p></div>${r.phone?`<a class="admin-primary-btn" href="https://wa.me/20${v30Esc(String(r.phone).replace(/^0/,''))}" target="_blank" rel="noopener">WHATSAPP</a>`:''}</article>`}).join(''):'<div class="admin-empty">No checkout sessions abandoned for 30+ minutes.</div>';}catch(e){err.textContent=e.message;}
}

function v304GovernorateOptions(selected=''){
  return V304_GOVERNORATES.map(g=>`<option value="${v30Esc(g)}" ${g===selected?'selected':''}>${v30Esc(g)}</option>`).join('');
}

async function loadDeliveryZones(){
  const host=document.getElementById('v304-delivery-zones-list');
  const err=document.getElementById('v304-delivery-zones-error');
  if(!host) return;
  if(err) err.textContent='';
  host.innerHTML='<div class="admin-loading">Loading delivery zones…</div>';
  try{
    v304DeliveryZones=await v30Json(`${V30A_URL}/rest/v1/shipping_zones?select=*&order=governorate.asc,area.asc.nullsfirst`);
    renderDeliveryZones();
  }catch(e){
    host.innerHTML='';
    if(err) err.textContent=e.message;
  }
}

function renderDeliveryZones(){
  const host=document.getElementById('v304-delivery-zones-list');
  if(!host) return;
  if(!v304DeliveryZones.length){
    host.innerHTML='<div class="admin-empty">No delivery zones configured.</div>';
    return;
  }
  host.innerHTML=v304DeliveryZones.map(z=>{
    const isDefault=!String(z.area||'').trim();
    return `<article class="v304-zone-row" data-zone-id="${v30Esc(z.id)}">
      <div class="v304-zone-location"><span>${isDefault?'GOVERNORATE DEFAULT':'AREA OVERRIDE'}</span><b>${v30Esc(z.governorate)}</b><small>${isDefault?'All other areas':v30Esc(z.area)}</small></div>
      <label>FEE (EGP)<input data-zone-fee type="number" min="0" step="1" value="${v30Esc(z.fee)}"></label>
      <label class="v304-zone-active"><input data-zone-active type="checkbox" ${z.active?'checked':''}><span>ACTIVE</span></label>
      <div class="v30-row-actions"><button type="button" class="admin-primary-btn" data-zone-save>SAVE</button>${isDefault?'':`<button type="button" class="admin-secondary-btn admin-danger-btn" data-zone-delete>DELETE</button>`}</div>
    </article>`;
  }).join('');
  host.querySelectorAll('[data-zone-save]').forEach(btn=>btn.onclick=async()=>{
    const row=btn.closest('[data-zone-id]');
    const id=row?.dataset.zoneId;
    const fee=Number(row?.querySelector('[data-zone-fee]')?.value);
    const active=Boolean(row?.querySelector('[data-zone-active]')?.checked);
    const err=document.getElementById('v304-delivery-zones-error');
    if(!Number.isFinite(fee)||fee<0){if(err)err.textContent='Enter a valid delivery fee.';return;}
    btn.disabled=true;
    try{
      await v30Json(`${V30A_URL}/rest/v1/shipping_zones?id=eq.${encodeURIComponent(id)}`,{method:'PATCH',headers:{'Content-Type':'application/json','Prefer':'return=representation'},body:JSON.stringify({fee,active,updated_at:new Date().toISOString()})});
      if(err){err.className='coupon-message coupon-message-success';err.textContent='Delivery zone saved.';}
      await loadDeliveryZones();
    }catch(e){if(err){err.className='admin-error';err.textContent=e.message;}}finally{btn.disabled=false;}
  });
  host.querySelectorAll('[data-zone-delete]').forEach(btn=>btn.onclick=async()=>{
    const row=btn.closest('[data-zone-id]');
    const id=row?.dataset.zoneId;
    const z=v304DeliveryZones.find(x=>String(x.id)===String(id));
    if(!z||!confirm(`Delete delivery override for ${z.area}, ${z.governorate}?`)) return;
    const err=document.getElementById('v304-delivery-zones-error');
    try{await v30Json(`${V30A_URL}/rest/v1/shipping_zones?id=eq.${encodeURIComponent(id)}`,{method:'DELETE',headers:{'Prefer':'return=representation'}});await loadDeliveryZones();}
    catch(e){if(err)err.textContent=e.message;}
  });
}

async function addDeliveryZone(e){
  e.preventDefault();
  const err=document.getElementById('v304-delivery-zones-error');
  if(err){err.className='admin-error';err.textContent='';}
  const fd=new FormData(e.currentTarget);
  const governorate=String(fd.get('zone_governorate')||'').trim();
  const area=String(fd.get('zone_area')||'').trim();
  const fee=Number(fd.get('zone_fee'));
  if(!governorate||!area){if(err)err.textContent='Choose a governorate and enter the area/district name.';return;}
  if(!Number.isFinite(fee)||fee<0){if(err)err.textContent='Enter a valid delivery fee.';return;}
  const btn=e.currentTarget.querySelector('button[type="submit"]'); if(btn)btn.disabled=true;
  try{
    await v30Json(`${V30A_URL}/rest/v1/shipping_zones`,{method:'POST',headers:{'Content-Type':'application/json','Prefer':'return=representation'},body:JSON.stringify({governorate,area,fee,active:true})});
    e.currentTarget.reset();
    if(err){err.className='coupon-message coupon-message-success';err.textContent='Area override added.';}
    await loadDeliveryZones();
  }catch(ex){if(err){err.className='admin-error';err.textContent=ex.message.includes('duplicate')?'This area override already exists for that governorate.':ex.message;}}
  finally{if(btn)btn.disabled=false;}
}

async function loadStoreSettings(){
  const err=document.getElementById('v30-store-error');err.textContent='';try{const rows=await v30Json(`${V30A_URL}/rest/v1/store_settings?select=*&id=eq.1&limit=1`);const s=rows?.[0]||{};['hero_eyebrow','hero_title','hero_subtitle','hero_cta_label','hero_cta_href','announcement','promo_title','promo_text','promo_link_label','promo_link_href','monthly_sales_goal','shipping_fee','ga4_id','meta_pixel_id','tiktok_pixel_id'].forEach(k=>{const el=document.querySelector(`[name="${k}"]`);if(el)el.value=s[k]??'';});}catch(e){err.textContent=e.message;}
}
async function saveStoreSettings(e){
  e.preventDefault();const err=document.getElementById('v30-store-error');err.textContent='';const fd=new FormData(e.currentTarget);const payload={};for(const [k,v] of fd.entries())payload[k]=String(v).trim()===''?null:String(v).trim();payload.monthly_sales_goal=Number(payload.monthly_sales_goal||0);payload.shipping_fee=Number(payload.shipping_fee||0);payload.updated_at=new Date().toISOString();try{await v30Json(`${V30A_URL}/rest/v1/store_settings?id=eq.1`,{method:'PATCH',headers:{'Content-Type':'application/json','Prefer':'return=representation'},body:JSON.stringify(payload)});err.className='coupon-message coupon-message-success';err.textContent='Store settings saved.';loadV30Metrics();}catch(e2){err.className='admin-error';err.textContent=e2.message;}
}

async function exportBackup(){
  const data=await v30Json(`${V30A_URL}/rest/v1/rpc/owner_store_backup`,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`DOMARO-V30-backup-${new Date().toISOString().slice(0,10)}.json`;a.click();URL.revokeObjectURL(a.href);
}
async function restoreBackup(file){
  if(!file)return;const text=await file.text();const data=JSON.parse(text);if(!confirm('Merge this DOMARO V30 backup into the current catalog/settings? Existing matching products may be updated. Orders are never overwritten.'))return;await v30Json(`${V30A_URL}/rest/v1/rpc/owner_restore_store_backup`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({p_backup:data})});alert('Backup merged successfully. Refresh products to see restored values.');
}

async function loadAudit(){
  const host=document.getElementById('v30-audit-list'),err=document.getElementById('v30-audit-error');if(!host)return;err.textContent='';try{const rows=await v30Json(`${V30A_URL}/rest/v1/audit_log?select=id,table_name,record_id,action,actor_email,created_at&order=created_at.desc&limit=150`);host.innerHTML=rows.length?rows.map(r=>`<article class="v30-audit-row"><div><b>${v30Esc(r.action)} · ${v30Esc(r.table_name)}</b><span>${v30Esc(r.record_id||'')}</span></div><div><b>${v30Esc(r.actor_email||'SYSTEM / SERVER')}</b><span>${v30Esc(new Date(r.created_at).toLocaleString('en-EG'))}</span></div></article>`).join(''):'<div class="admin-empty">No audit activity yet.</div>';}catch(e){err.textContent=e.message;}
}

async function loadV30Metrics(){
  if(!document.getElementById('dashboard-total-sales')||!v30Token())return;let days=Number(document.getElementById('dashboard-period')?.value||30);try{const d=await v30Json(`${V30A_URL}/rest/v1/rpc/admin_v30_metrics`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({p_days:days})});let grid=document.querySelector('.dashboard-kpis-v26');if(!grid)return;if(!document.getElementById('v30-profit-kpi'))grid.insertAdjacentHTML('beforeend','<div class="sales-kpi" id="v30-profit-kpi"><span>KNOWN PROFIT</span><b id="v30-known-profit">—</b><small id="v30-profit-coverage">Cost tracking coverage</small></div><div class="sales-kpi" id="v30-goal-kpi"><span>MONTHLY SALES GOAL</span><b id="v30-goal-progress">—</b><small id="v30-goal-label">Set goal in STORE</small><div class="v30-goal-bar"><i id="v30-goal-bar-fill"></i></div></div>');document.getElementById('v30-known-profit').textContent=v30Money(d.known_profit||0);const coverage=Number(d.delivered_items||0)?Math.round(Number(d.costed_items||0)*100/Number(d.delivered_items||1)):0;document.getElementById('v30-profit-coverage').textContent=`${coverage}% of delivered items have cost data`;const goal=Number(d.monthly_sales_goal||0),sales=Number(d.month_delivered_sales||0),pct=goal>0?Math.min(100,Math.round(sales*100/goal)):0;document.getElementById('v30-goal-progress').textContent=goal>0?`${pct}%`:'NOT SET';document.getElementById('v30-goal-label').textContent=goal>0?`${v30Money(sales)} of ${v30Money(goal)}`:'Set goal in STORE';document.getElementById('v30-goal-bar-fill').style.width=`${pct}%`;}catch(_){}
}

async function initV30Admin(){
  if(!v30Token()) return;
  try{v30Profile=await v30Json(`${V30A_URL}/rest/v1/rpc/get_my_admin_profile`,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});}catch(_){return;}
  const canOrders=v30Profile?.role==='owner'||v30Profile?.can_orders;const owner=v30Profile?.role==='owner';
  if(canOrders){
    const rt=addV30Tab('returns','RETURNS');const rp=addV30Panel('v30-returns-panel','<div class="admin-dashboard-head"><div><div class="eyebrow" style="color:#766b5d">AFTER-SALES</div><h1>RETURNS & REFUNDS</h1></div><button id="v30-refresh-returns" class="admin-secondary-btn">REFRESH</button></div><div id="v30-returns-error" class="admin-error"></div><div id="v30-returns-list" class="v30-admin-list"></div>');rt.onclick=()=>{v30OpenCustom(rp.id,rt);loadReturns()};rp.querySelector('#v30-refresh-returns').onclick=loadReturns;
    const at=addV30Tab('abandoned','ABANDONED');const ap=addV30Panel('v30-abandoned-panel','<div class="admin-dashboard-head"><div><div class="eyebrow" style="color:#766b5d">CHECKOUT RECOVERY</div><h1>ABANDONED CARTS</h1><p class="admin-panel-intro">Shows active checkout sessions untouched for at least 30 minutes.</p></div><button id="v30-refresh-abandoned" class="admin-secondary-btn">REFRESH</button></div><div id="v30-abandoned-error" class="admin-error"></div><div id="v30-abandoned-list" class="v30-admin-list"></div>');at.onclick=()=>{v30OpenCustom(ap.id,at);loadAbandoned()};ap.querySelector('#v30-refresh-abandoned').onclick=loadAbandoned;
  }
  if(owner){
    const st=addV30Tab('store','STORE',true);const sp=addV30Panel('v30-store-panel',`<div class="admin-dashboard-head"><div><div class="eyebrow" style="color:#766b5d">OWNER CONTROL</div><h1>STORE MANAGER</h1><p class="admin-panel-intro">Homepage, sales goal, analytics IDs and backup tools.</p></div></div><form id="v30-store-form" class="v30-store-form"><div class="v30-form-section"><h3>HOMEPAGE</h3><div class="form-row"><label>Hero eyebrow<input name="hero_eyebrow"></label><label>Hero title<input name="hero_title"></label></div><label>Hero subtitle<textarea name="hero_subtitle" class="small-textarea"></textarea></label><div class="form-row"><label>CTA label<input name="hero_cta_label"></label><label>CTA link<input name="hero_cta_href"></label></div><label>Announcement bar<input name="announcement" placeholder="Optional"></label><div class="form-row"><label>Promo title<input name="promo_title"></label><label>Promo link label<input name="promo_link_label"></label></div><label>Promo text<textarea name="promo_text" class="small-textarea"></textarea></label><label>Promo link<input name="promo_link_href"></label></div><div class="v30-form-section"><h3>BUSINESS</h3><div class="form-row"><label>Monthly delivered sales goal (EGP)<input name="monthly_sales_goal" type="number" min="0" step="1"></label><label>Fallback delivery fee (EGP)<input name="shipping_fee" type="number" min="0" step="1"><span class="field-help">Safety fallback only. Normal checkout rates come from Delivery Zones below.</span></label></div></div><div class="v30-form-section"><h3>ANALYTICS</h3><p class="field-help">Optional. Leave blank to send no analytics traffic.</p><div class="form-row"><label>Google Analytics 4 ID<input name="ga4_id" placeholder="G-XXXXXXXXXX"></label><label>Meta Pixel ID<input name="meta_pixel_id"></label></div><label>TikTok Pixel ID<input name="tiktok_pixel_id"></label></div><div class="v30-integration-status"><h3>EXTERNAL INTEGRATIONS</h3><div><b>ONLINE PAYMENT</b><span>Prepared for future provider connection — COD remains the live payment method until provider credentials are supplied.</span></div><div><b>CUSTOMER EMAILS</b><span>Requires a verified sending domain before emails can be sent safely to all customers.</span></div><div><b>CUSTOM DOMAIN</b><span>Connect through Vercel when you decide to purchase/use a domain.</span></div></div><div id="v30-store-error" class="admin-error"></div><button class="admin-primary-btn" type="submit">SAVE STORE SETTINGS</button></form><section class="v30-form-section v304-delivery-zones"><div class="v304-zone-head"><div><span class="eyebrow" style="color:#766b5d">SMART DELIVERY</span><h3>DELIVERY ZONES</h3><p class="field-help">Each governorate has a default fee. Add optional area overrides when a district needs a different price. Checkout calculates the fee automatically.</p></div><button id="v304-refresh-zones" class="admin-secondary-btn" type="button">REFRESH</button></div><div id="v304-delivery-zones-error" class="admin-error"></div><div id="v304-delivery-zones-list" class="v304-delivery-zones-list"></div><form id="v304-add-zone-form" class="v30-inline-form v304-add-zone-form"><h3>ADD AREA OVERRIDE</h3><div class="form-row"><label>Governorate<select name="zone_governorate" required><option value="">Select governorate</option>${v304GovernorateOptions()}</select></label><label>Area / District<input name="zone_area" required placeholder="e.g. Sheikh Zayed"></label></div><div class="form-row"><label>Delivery fee (EGP)<input name="zone_fee" type="number" min="0" step="1" required></label><div class="v304-zone-add-action"><button class="admin-primary-btn" type="submit">ADD OVERRIDE</button></div></div></form></section><section class="v30-backup-card"><div><span>OWNER TOOLS</span><h3>BACKUP / RESTORE</h3><p>Backup includes catalog, variants, galleries, coupons, store settings and delivery zones. Restore is a safe merge and never overwrites orders.</p></div><div class="v30-row-actions"><button id="v30-export-backup" class="admin-secondary-btn">EXPORT BACKUP</button><label class="admin-secondary-btn v30-file-label">RESTORE BACKUP<input id="v30-restore-backup" type="file" accept="application/json" hidden></label></div></section>`);st.onclick=()=>{v30OpenCustom(sp.id,st);loadStoreSettings();loadDeliveryZones()};sp.querySelector('#v30-store-form').onsubmit=saveStoreSettings;sp.querySelector('#v304-refresh-zones').onclick=loadDeliveryZones;sp.querySelector('#v304-add-zone-form').onsubmit=addDeliveryZone;sp.querySelector('#v30-export-backup').onclick=()=>exportBackup().catch(e=>sp.querySelector('#v30-store-error').textContent=e.message);sp.querySelector('#v30-restore-backup').onchange=e=>restoreBackup(e.target.files?.[0]).catch(er=>sp.querySelector('#v30-store-error').textContent=er.message);
    const audt=addV30Tab('audit','AUDIT',true);const audp=addV30Panel('v30-audit-panel','<div class="admin-dashboard-head"><div><div class="eyebrow" style="color:#766b5d">OWNER SECURITY</div><h1>AUDIT LOG</h1></div><button id="v30-refresh-audit" class="admin-secondary-btn">REFRESH</button></div><div id="v30-audit-error" class="admin-error"></div><div id="v30-audit-list" class="v30-audit-list"></div>');audt.onclick=()=>{v30OpenCustom(audp.id,audt);loadAudit()};audp.querySelector('#v30-refresh-audit').onclick=loadAudit;
  }
  document.querySelectorAll('.admin-tab:not(.v30-admin-tab)').forEach(t=>t.addEventListener('click',v30HideCustomPanels));
  bindProductManagers(); loadV30Metrics(); document.getElementById('dashboard-period')?.addEventListener('change',()=>setTimeout(loadV30Metrics,100));
}

const v30ProductObserver=new MutationObserver(bindProductManagers); const productList=document.getElementById('products-list'); if(productList)v30ProductObserver.observe(productList,{childList:true,subtree:true});
const v30LoginObserver=new MutationObserver(()=>{if(!document.getElementById('admin-dashboard')?.hidden && v30Token()&&!v30Profile)initV30Admin();}); const dash=document.getElementById('admin-dashboard'); if(dash)v30LoginObserver.observe(dash,{attributes:true,attributeFilter:['hidden']});
window.addEventListener('load',()=>{if(v30Token())initV30Admin();});
