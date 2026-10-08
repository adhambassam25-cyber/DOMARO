(() => {
  const money=v=>Number(v||0).toLocaleString('en-EG',{maximumFractionDigits:2})+' EGP';
  const set=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v;};
  const esc2=v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'","&#039;");
  const dateNow=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Cairo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const body=document.getElementById('accounting-order-finance-body');
  const empty=document.getElementById('accounting-order-finance-empty');
  const err=document.getElementById('accounting-order-finance-error');
  const sform=document.getElementById('accounting-settlement-form');
  const sbody=document.getElementById('accounting-settlements-body');
  const sempty=document.getElementById('accounting-settlements-empty');
  const serr=document.getElementById('accounting-settlement-error');
  const scancel=document.getElementById('accounting-settlement-cancel');
  let settlements=[];

  async function api(url,opts={}){
    const r=await fetch(url,{...opts,headers:authHeaders(opts.headers||{})});
    let d=null;try{d=await r.json();}catch(_){}
    if(r.status===401){clearSession();showLogin('Your session expired. Please sign in again.');throw new Error('Session expired.');}
    if(r.status===403)throw new Error('This account does not have Accounting permission.');
    if(!r.ok)throw new Error(d?.message||d?.error||'Accounting request failed.');
    return d;
  }
  function range(){
    const el=document.getElementById('accounting-period'); const mode=String(el?.value||'month'); const today=dateNow();
    if(mode==='0')return{from:null,to:null};
    if(mode==='month')return{from:today.slice(0,7)+'-01',to:today};
    const days=Number(mode||30); return{from:new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Cairo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(Date.now()-(days-1)*86400000)),to:today};
  }
  function resetSettlement(){
    if(!sform)return;sform.reset();document.getElementById('accounting-settlement-id').value='';
    document.getElementById('accounting-settlement-date').value=dateNow();
    document.getElementById('accounting-settlement-expected').value='0';
    document.getElementById('accounting-settlement-received').value='0';
    document.getElementById('accounting-settlement-fees').value='0';
    document.getElementById('accounting-settlement-save').textContent='ADD SETTLEMENT';scancel.hidden=true;serr.textContent='';
  }
  function renderOrders(rec){
    const rows=Array.isArray(rec?.orders)?rec.orders:[];
    body.innerHTML=rows.map(row=>{
      const disabled=row.is_cod?'':'disabled';
      return '<tr><td><b>'+esc2(row.order_number)+'</b><small class="accounting-subtext">'+esc2(row.payment_method||'')+'</small></td>'+
      '<td>'+esc2(money(row.total))+'</td><td>'+esc2(money(row.shipping_collected))+'</td>'+
      '<td><input class="accounting-inline-input" data-fs="'+esc2(row.order_id)+'" type="number" min="0" step="0.01" value="'+Number(row.actual_shipping_cost||0)+'"></td>'+
      '<td><input class="accounting-inline-input" data-fc="'+esc2(row.order_id)+'" type="number" min="0" step="0.01" value="'+Number(row.collected_amount||0)+'" '+disabled+'></td>'+
      '<td><input class="accounting-inline-input" data-fd="'+esc2(row.order_id)+'" type="date" value="'+esc2(row.collected_at||'')+'" '+disabled+'></td>'+
      '<td><input class="accounting-inline-input" data-fr="'+esc2(row.order_id)+'" maxlength="120" value="'+esc2(row.courier_reference||'')+'" placeholder="Reference"></td>'+
      '<td><button class="admin-primary-btn accounting-inline-save" type="button" data-save-fin="'+esc2(row.order_id)+'">SAVE</button></td></tr>';
    }).join('');
    empty.hidden=rows.length>0;
    body.querySelectorAll('[data-save-fin]').forEach(btn=>btn.onclick=async()=>{
      const id=btn.dataset.saveFin;btn.disabled=true;err.textContent='';
      try{
        await api(SUPABASE_URL+'/rest/v1/accounting_order_finance?on_conflict=order_id',{method:'POST',headers:{'Content-Type':'application/json','Prefer':'resolution=merge-duplicates,return=representation'},body:JSON.stringify({
          order_id:id,
          actual_shipping_cost:Number(body.querySelector('[data-fs="'+id+'"]').value||0),
          collected_amount:Number(body.querySelector('[data-fc="'+id+'"]').value||0),
          collected_at:body.querySelector('[data-fd="'+id+'"]').value||null,
          courier_reference:body.querySelector('[data-fr="'+id+'"]').value.trim()||null,
          note:null
        })});
        await loadV2();
        window.DOMARO_ACCOUNTING?.load(true);
      }catch(e){err.textContent=e.message;}finally{btn.disabled=false;}
    });
  }
  function variance(r){return Number(r.received_amount||0)+Number(r.fees||0)-Number(r.expected_amount||0);}
  function renderSettlements(){
    sbody.innerHTML=settlements.map(r=>'<tr><td>'+esc2(r.settlement_date||'')+'</td><td>'+esc2(String(r.settlement_type||'').replaceAll('_',' ').toUpperCase())+'</td><td><b>'+esc2(r.provider||'')+'</b></td><td>'+esc2(money(r.expected_amount))+'</td><td>'+esc2(money(r.received_amount))+'</td><td>'+esc2(money(r.fees))+'</td><td class="'+(Math.abs(variance(r))<0.01?'accounting-positive':'accounting-negative')+'"><b>'+esc2(money(variance(r)))+'</b></td><td class="accounting-row-actions"><button class="admin-secondary-btn" type="button" data-se="'+esc2(r.id)+'">EDIT</button><button class="admin-secondary-btn danger-outline" type="button" data-sd="'+esc2(r.id)+'">DELETE</button></td></tr>').join('');
    sempty.hidden=settlements.length>0;
    sbody.querySelectorAll('[data-se]').forEach(btn=>btn.onclick=()=>{
      const r=settlements.find(x=>String(x.id)===String(btn.dataset.se));if(!r)return;
      document.getElementById('accounting-settlement-id').value=r.id;
      document.getElementById('accounting-settlement-date').value=r.settlement_date||'';
      document.getElementById('accounting-settlement-type').value=r.settlement_type||'courier_cod';
      document.getElementById('accounting-settlement-provider').value=r.provider||'';
      document.getElementById('accounting-settlement-expected').value=r.expected_amount??0;
      document.getElementById('accounting-settlement-received').value=r.received_amount??0;
      document.getElementById('accounting-settlement-fees').value=r.fees??0;
      document.getElementById('accounting-settlement-reference').value=r.reference||'';
      document.getElementById('accounting-settlement-notes').value=r.notes||'';
      document.getElementById('accounting-settlement-save').textContent='SAVE SETTLEMENT';scancel.hidden=false;
    });
    sbody.querySelectorAll('[data-sd]').forEach(btn=>btn.onclick=async()=>{if(!confirm('Delete this settlement record?'))return;btn.disabled=true;try{await api(SUPABASE_URL+'/rest/v1/accounting_settlements?id=eq.'+encodeURIComponent(btn.dataset.sd),{method:'DELETE',headers:{Prefer:'return=representation'}});await loadV2();window.DOMARO_ACCOUNTING?.load(true);}catch(e){serr.textContent=e.message;}finally{btn.disabled=false;}});
  }
  async function loadV2(){
    if(!hasPermission('accounting'))return; const r=range();
    const rec=await api(SUPABASE_URL+'/rest/v1/rpc/accounting_reconciliation',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({p_from:r.from,p_to:r.to})});
    set('accounting-v2-shipping-collected',money(rec.shipping_collected));set('accounting-v2-shipping-cost',money(rec.actual_shipping_cost));set('accounting-v2-shipping-profit',money(rec.shipping_profit));
    set('accounting-v2-cod-expected',money(rec.cod_expected));set('accounting-v2-cod-collected',money(rec.cod_collected));set('accounting-v2-cod-outstanding',money(rec.cod_outstanding));
    set('accounting-v2-settlement-expected',money(rec.settlement_expected));set('accounting-v2-settlement-received',money(rec.settlement_received));set('accounting-v2-settlement-fees',money(rec.settlement_fees));set('accounting-v2-settlement-variance',money(rec.settlement_variance));
    renderOrders(rec);
    let u=SUPABASE_URL+'/rest/v1/accounting_settlements?select=*&order=settlement_date.desc,created_at.desc';if(r.from)u+='&settlement_date=gte.'+encodeURIComponent(r.from);if(r.to)u+='&settlement_date=lte.'+encodeURIComponent(r.to);
    settlements=await api(u);renderSettlements();
  }
  sform?.addEventListener('submit',async e=>{e.preventDefault();serr.textContent='';const id=document.getElementById('accounting-settlement-id').value.trim();const p={settlement_date:document.getElementById('accounting-settlement-date').value,settlement_type:document.getElementById('accounting-settlement-type').value,provider:document.getElementById('accounting-settlement-provider').value.trim(),expected_amount:Number(document.getElementById('accounting-settlement-expected').value||0),received_amount:Number(document.getElementById('accounting-settlement-received').value||0),fees:Number(document.getElementById('accounting-settlement-fees').value||0),reference:document.getElementById('accounting-settlement-reference').value.trim()||null,notes:document.getElementById('accounting-settlement-notes').value.trim()||null};if(!p.settlement_date||!p.provider){serr.textContent='Enter settlement date and provider.';return;}const b=document.getElementById('accounting-settlement-save');b.disabled=true;try{await api(SUPABASE_URL+'/rest/v1/accounting_settlements'+(id?'?id=eq.'+encodeURIComponent(id):''),{method:id?'PATCH':'POST',headers:{'Content-Type':'application/json','Prefer':'return=representation'},body:JSON.stringify(p)});resetSettlement();await loadV2();window.DOMARO_ACCOUNTING?.load(true);}catch(x){serr.textContent=x.message;}finally{b.disabled=false;}});
  scancel?.addEventListener('click',resetSettlement);
  document.getElementById('accounting-refresh')?.addEventListener('click',loadV2);
  document.getElementById('accounting-period')?.addEventListener('change',loadV2);
  resetSettlement();
  const old=window.DOMARO_ACCOUNTING?.load;
  if(window.DOMARO_ACCOUNTING&&old){window.DOMARO_ACCOUNTING.load=async(force=false)=>{await old(force);await loadV2();};}
})();