(() => {
 const $=id=>document.getElementById(id);
 const money=v=>Number(v||0).toLocaleString('en-EG',{maximumFractionDigits:2})+' EGP';
 const esc=v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'","&#039;");
 const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Cairo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 let rows=[], recoveries=[];
 async function api(url,opts={}){const r=await fetch(url,{...opts,headers:authHeaders(opts.headers||{})});let d=null;try{d=await r.json()}catch(_){}if(r.status===401){clearSession();showLogin('Your session expired. Please sign in again.');throw Error('Session expired.')}if(r.status===403)throw Error('This account does not have Accounting permission.');if(!r.ok)throw Error(d?.message||d?.error||'Receivables request failed.');return d}
 function render(){
  const recoveredById={};recoveries.forEach(x=>recoveredById[x.receivable_id]=(recoveredById[x.receivable_id]||0)+Number(x.amount||0));
  let total=0,recovered=0,outstanding=0;
  $('accounting-receivables-body').innerHTML=rows.map(r=>{
   const rec=recoveredById[r.id]||0, left=Math.max(0,Number(r.amount)-rec-Number(r.written_off_amount||0));
   total+=Number(r.amount);recovered+=rec;outstanding+=left;
   const status=left<=0?'Recovered':rec>0?'Partially recovered':'Open';
   return '<tr><td>'+esc(r.receivable_date)+'</td><td><b>'+esc(r.counterparty)+'</b></td><td>'+esc(r.category||'Other receivable')+'<small class="accounting-subtext">'+esc([r.description,r.reference].filter(Boolean).join(' · '))+'</small></td><td>'+esc(money(r.amount))+'</td><td>'+esc(money(rec))+'</td><td><b>'+esc(money(left))+'</b></td><td>'+esc(status)+'</td><td>'+(left>0?'<button class="admin-secondary-btn" type="button" data-recovery="'+esc(r.id)+'">ADD RECOVERY</button>':'—')+'</td></tr>';
  }).join('');
  $('accounting-receivables-empty').hidden=rows.length>0;
  $('receivables-total').textContent=money(total);$('receivables-recovered').textContent=money(recovered);$('receivables-outstanding').textContent=money(outstanding);
  $('accounting-receivables-body').querySelectorAll('[data-recovery]').forEach(btn=>btn.onclick=async()=>{
   const r=rows.find(x=>x.id===btn.dataset.recovery);if(!r)return;
   const already=recoveredById[r.id]||0, max=Math.max(0,Number(r.amount)-already-Number(r.written_off_amount||0));
   const value=prompt('Enter amount recovered (max '+money(max)+')');if(value===null)return;
   const amount=Number(value);if(!(amount>0)||amount>max){$('accounting-receivables-error').textContent='Enter a positive amount not exceeding the outstanding balance.';return;}
   const method=prompt('Payment method (Cash / InstaPay / Bank transfer / Other):','Cash');if(method===null)return;
   btn.disabled=true;$('accounting-receivables-error').textContent='';
   try{await api(SUPABASE_URL+'/rest/v1/rpc/accounting_add_other_receivable_recovery',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({p_receivable_id:r.id,p_recovery_date:today(),p_amount:amount,p_payment_method:method.trim()||null,p_reference:null,p_notes:null})});await load();window.DOMARO_CAPITAL?.load?.();window.DOMARO_ACCOUNTING?.load?.(true);}
   catch(e){$('accounting-receivables-error').textContent=e.message||'Could not record recovery.';}finally{btn.disabled=false;}
  });
 }
 async function load(){
  if(!hasPermission('accounting'))return;
  $('accounting-receivables-error').textContent='';$('accounting-receivables-refresh').disabled=true;
  try{
   const [a,b]=await Promise.all([
    api(SUPABASE_URL+'/rest/v1/accounting_other_receivables?select=*&order=receivable_date.desc,created_at.desc'),
    api(SUPABASE_URL+'/rest/v1/accounting_other_receivable_recoveries?select=*&order=recovery_date.desc,created_at.desc')
   ]);rows=Array.isArray(a)?a:[];recoveries=Array.isArray(b)?b:[];render();
  }catch(e){$('accounting-receivables-error').textContent=e.message||'Could not load receivables.';}
  finally{$('accounting-receivables-refresh').disabled=false;}
 }
 $('accounting-receivable-form')?.addEventListener('submit',async e=>{
  e.preventDefault();$('receivable-error').textContent='';
  const p={receivable_date:$('receivable-date').value,counterparty:$('receivable-counterparty').value.trim(),category:$('receivable-category').value,amount:Number($('receivable-amount').value),reference:$('receivable-reference').value.trim()||null,description:$('receivable-description').value.trim()||null};
  if(!p.receivable_date||!p.counterparty||!(p.amount>0)){$('receivable-error').textContent='Enter a date, person / supplier and positive amount.';return;}
  const btn=$('receivable-save');btn.disabled=true;
  try{await api(SUPABASE_URL+'/rest/v1/accounting_other_receivables',{method:'POST',headers:{'Content-Type':'application/json','Prefer':'return=representation'},body:JSON.stringify(p)});$('accounting-receivable-form').reset();$('receivable-date').value=today();await load();}
  catch(err){$('receivable-error').textContent=err.message||'Could not save receivable.';}
  finally{btn.disabled=false;}
 });
 $('accounting-receivables-refresh')?.addEventListener('click',load);
 $('receivable-date').value=today();
 document.querySelector('[data-admin-tab="accounting"]')?.addEventListener('click',load);
 window.DOMARO_RECEIVABLES={load};
 const old=window.DOMARO_ACCOUNTING?.load;
 if(window.DOMARO_ACCOUNTING&&old)window.DOMARO_ACCOUNTING.load=async(force=false)=>{await old(force);await load();};
})();
