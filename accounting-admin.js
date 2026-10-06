(() => {
  const periodEl=document.getElementById('accounting-period');
  const refreshBtn=document.getElementById('accounting-refresh');
  const exportBtn=document.getElementById('accounting-export');
  const loadingEl=document.getElementById('accounting-loading');
  const errorEl=document.getElementById('accounting-error');
  const monthlyBody=document.getElementById('accounting-monthly-body');
  const expensesBody=document.getElementById('accounting-expenses-body');
  const expensesEmpty=document.getElementById('accounting-expenses-empty');
  const expenseForm=document.getElementById('accounting-expense-form');
  const expenseError=document.getElementById('accounting-expense-error');
  const cancelEditBtn=document.getElementById('accounting-expense-cancel');

  let summary=null;
  let expenses=[];
  let loaded=false;

  function cairoDateString(date){
    return new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Cairo',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
  }
  function periodRange(){
    const mode=String(periodEl?.value||'month');
    const now=new Date();
    const today=cairoDateString(now);
    if(mode==='0') return {from:null,to:null,label:'All time'};
    if(mode==='month'){
      const parts=today.split('-');
      return {from:`${parts[0]}-${parts[1]}-01`,to:today,label:'This month'};
    }
    const days=Number(mode||30);
    const fromDate=new Date(now.getTime()-(Math.max(1,days)-1)*86400000);
    return {from:cairoDateString(fromDate),to:today,label:`Last ${days} days`};
  }
  function qs(obj){
    return Object.entries(obj).filter(([,v])=>v!==null&&v!==undefined&&v!=='').map(([k,v])=>`${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
  }
  function accountingMoney(value){
    return Number(value||0).toLocaleString('en-EG',{maximumFractionDigits:2})+' EGP';
  }
  function setText(id,value){
    const el=document.getElementById(id);
    if(el) el.textContent=value;
  }
  function monthLabel(value){
    try{
      const [y,m]=String(value).split('-').map(Number);
      return new Intl.DateTimeFormat('en-EG',{month:'short',year:'numeric',timeZone:'Africa/Cairo'}).format(new Date(Date.UTC(y,m-1,1)));
    }catch(_){return value||'';}
  }
  async function fetchJson(url,options={}){
    const response=await fetch(url,{...options,headers:authHeaders(options.headers||{})});
    let data=null;
    try{data=await response.json();}catch(_){}
    if(response.status===401){clearSession();showLogin('Your session expired. Please sign in again.');throw new Error('Session expired.');}
    if(response.status===403) throw new Error('This account does not have Accounting permission.');
    if(!response.ok) throw new Error(data?.message||data?.error||'Accounting request failed.');
    return data;
  }
  function renderSummary(){
    const d=summary||{};
    setText('accounting-net-revenue',accountingMoney(d.net_revenue));
    setText('accounting-cogs',accountingMoney(d.known_cogs));
    setText('accounting-gross-profit',accountingMoney(d.gross_profit));
    setText('accounting-expenses-total',accountingMoney(d.expenses));
    setText('accounting-net-profit',accountingMoney(d.net_profit));
    setText('accounting-gross-margin',`${Number(d.gross_margin_pct||0).toLocaleString('en-EG',{maximumFractionDigits:1})}% margin`);
    setText('accounting-net-margin',`${Number(d.net_margin_pct||0).toLocaleString('en-EG',{maximumFractionDigits:1})}% margin`);
    setText('accounting-delivered-revenue',accountingMoney(d.delivered_revenue));
    setText('accounting-product-sales',accountingMoney(d.net_product_sales));
    setText('accounting-shipping',accountingMoney(d.shipping_collected));
    setText('accounting-discounts',accountingMoney(d.discounts));
    setText('accounting-refunds',accountingMoney(d.refunds));
    setText('accounting-orders',Number(d.delivered_orders||0).toLocaleString('en-EG'));
    setText('accounting-aov',accountingMoney(d.average_order_value));

    const coverage=Number(d.cost_coverage_pct??100);
    setText('accounting-cost-coverage',`${coverage.toLocaleString('en-EG',{maximumFractionDigits:1})}%`);
    setText('accounting-cost-note',
      coverage>=100
        ? 'All delivered items in this period have a saved cost price.'
        : `${Number(d.costed_items||0)} of ${Number(d.delivered_items||0)} delivered items have a saved cost price. Profit may be overstated until missing costs are completed.`
    );

    const rows=Array.isArray(d.monthly)?d.monthly:[];
    monthlyBody.innerHTML=rows.length ? rows.map(row=>`<tr>
      <td><b>${esc(monthLabel(row.month))}</b></td>
      <td>${esc(accountingMoney(row.revenue))}</td>
      <td>${esc(accountingMoney(row.cogs))}</td>
      <td>${esc(accountingMoney(row.refunds))}</td>
      <td>${esc(accountingMoney(row.expenses))}</td>
      <td class="${Number(row.net_profit||0)>=0?'accounting-positive':'accounting-negative'}"><b>${esc(accountingMoney(row.net_profit))}</b></td>
    </tr>`).join('') : '<tr><td colspan="6" class="accounting-table-empty">No accounting activity in this period.</td></tr>';
  }
  function expenseDisplayText(row){
    const bits=[row.vendor,row.description].map(v=>String(v||'').trim()).filter(Boolean);
    return bits.join(' · ')||'—';
  }
  function renderExpenses(){
    expensesBody.innerHTML=expenses.map(row=>`<tr>
      <td>${esc(row.expense_date||'')}</td>
      <td><b>${esc(row.category||'')}</b></td>
      <td>${esc(expenseDisplayText(row))}</td>
      <td><b>${esc(accountingMoney(row.amount))}</b></td>
      <td class="accounting-row-actions">
        <button type="button" class="admin-secondary-btn" data-expense-edit="${esc(row.id)}">EDIT</button>
        <button type="button" class="admin-secondary-btn danger-outline" data-expense-delete="${esc(row.id)}">DELETE</button>
      </td>
    </tr>`).join('');
    expensesEmpty.hidden=expenses.length>0;

    expensesBody.querySelectorAll('[data-expense-edit]').forEach(btn=>btn.addEventListener('click',()=>{
      const row=expenses.find(x=>String(x.id)===String(btn.dataset.expenseEdit));
      if(!row) return;
      document.getElementById('accounting-expense-id').value=row.id;
      document.getElementById('accounting-expense-date').value=row.expense_date||'';
      document.getElementById('accounting-expense-category').value=row.category||'Other Operating Expense';
      document.getElementById('accounting-expense-amount').value=row.amount??'';
      document.getElementById('accounting-expense-vendor').value=row.vendor||'';
      document.getElementById('accounting-expense-description').value=row.description||'';
      document.getElementById('accounting-expense-save').textContent='SAVE EXPENSE';
      cancelEditBtn.hidden=false;
      document.getElementById('accounting-expense-amount').focus();
    }));

    expensesBody.querySelectorAll('[data-expense-delete]').forEach(btn=>btn.addEventListener('click',async()=>{
      const row=expenses.find(x=>String(x.id)===String(btn.dataset.expenseDelete));
      if(!row || !confirm(`Delete ${row.category} expense of ${accountingMoney(row.amount)}?`)) return;
      btn.disabled=true;
      try{
        await fetchJson(`${SUPABASE_URL}/rest/v1/accounting_expenses?id=eq.${encodeURIComponent(row.id)}`,{
          method:'DELETE',
          headers:{'Prefer':'return=representation'}
        });
        await load(true);
      }catch(err){ expenseError.textContent=err.message||'Could not delete expense.'; }
      finally{btn.disabled=false;}
    }));
  }
  function resetExpenseForm(){
    expenseForm.reset();
    document.getElementById('accounting-expense-id').value='';
    document.getElementById('accounting-expense-date').value=cairoDateString(new Date());
    document.getElementById('accounting-expense-save').textContent='ADD EXPENSE';
    cancelEditBtn.hidden=true;
    expenseError.textContent='';
  }
  async function load(force=false){
    if(!hasPermission('accounting')) return;
    if(loaded && !force) return;
    errorEl.textContent='';
    loadingEl.hidden=false;
    refreshBtn.disabled=true;
    exportBtn.disabled=true;
    try{
      const range=periodRange();
      summary=await fetchJson(`${SUPABASE_URL}/rest/v1/rpc/accounting_summary`,{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({p_from:range.from,p_to:range.to})
      });
      const filters={select:'*',order:'expense_date.desc,created_at.desc'};
      let url=`${SUPABASE_URL}/rest/v1/accounting_expenses?${qs(filters)}`;
      if(range.from) url+=`&expense_date=gte.${encodeURIComponent(range.from)}`;
      if(range.to) url+=`&expense_date=lte.${encodeURIComponent(range.to)}`;
      expenses=await fetchJson(url);
      renderSummary();
      renderExpenses();
      loaded=true;
    }catch(err){
      errorEl.textContent=err.message||'Could not load accounting.';
    }finally{
      loadingEl.hidden=true;
      refreshBtn.disabled=false;
      exportBtn.disabled=false;
    }
  }
  function csvCell(v){ return '"'+String(v??'').replaceAll('"','""')+'"'; }
  function exportCsv(){
    if(!summary) return;
    const range=periodRange();
    const lines=[
      ['DOMARO ACCOUNTING REPORT',range.label],
      [],
      ['Metric','Amount / Value'],
      ['Delivered Revenue',summary.delivered_revenue],
      ['Refunds',summary.refunds],
      ['Net Revenue',summary.net_revenue],
      ['COGS',summary.known_cogs],
      ['Gross Profit',summary.gross_profit],
      ['Operating Expenses',summary.expenses],
      ['Net Profit',summary.net_profit],
      ['Gross Margin %',summary.gross_margin_pct],
      ['Net Margin %',summary.net_margin_pct],
      ['Delivered Orders',summary.delivered_orders],
      ['Average Order Value',summary.average_order_value],
      ['Cost Coverage %',summary.cost_coverage_pct],
      [],
      ['MONTHLY P&L'],
      ['Month','Revenue','COGS','Refunds','Expenses','Net Profit'],
      ...(Array.isArray(summary.monthly)?summary.monthly:[]).map(r=>[r.month,r.revenue,r.cogs,r.refunds,r.expenses,r.net_profit]),
      [],
      ['EXPENSE REGISTER'],
      ['Date','Category','Vendor','Description','Amount'],
      ...expenses.map(r=>[r.expense_date,r.category,r.vendor||'',r.description||'',r.amount])
    ];
    const blob=new Blob([lines.map(row=>row.map(csvCell).join(',')).join('\n')],{type:'text/csv;charset=utf-8'});
    const a=document.createElement('a');
    a.href=URL.createObjectURL(blob);
    a.download=`domaro-accounting-${cairoDateString(new Date())}.csv`;
    document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(a.href);
  }

  expenseForm?.addEventListener('submit',async e=>{
    e.preventDefault();
    expenseError.textContent='';
    const id=document.getElementById('accounting-expense-id').value.trim();
    const payload={
      expense_date:document.getElementById('accounting-expense-date').value,
      category:document.getElementById('accounting-expense-category').value,
      amount:Number(document.getElementById('accounting-expense-amount').value),
      vendor:document.getElementById('accounting-expense-vendor').value.trim()||null,
      description:document.getElementById('accounting-expense-description').value.trim()||null
    };
    if(!payload.expense_date || !payload.category || !(payload.amount>0)){
      expenseError.textContent='Enter a valid date, category and amount.';
      return;
    }
    const btn=document.getElementById('accounting-expense-save');
    btn.disabled=true;
    try{
      if(id){
        await fetchJson(`${SUPABASE_URL}/rest/v1/accounting_expenses?id=eq.${encodeURIComponent(id)}`,{
          method:'PATCH',
          headers:{'Content-Type':'application/json','Prefer':'return=representation'},
          body:JSON.stringify(payload)
        });
      }else{
        await fetchJson(`${SUPABASE_URL}/rest/v1/accounting_expenses`,{
          method:'POST',
          headers:{'Content-Type':'application/json','Prefer':'return=representation'},
          body:JSON.stringify(payload)
        });
      }
      resetExpenseForm();
      loaded=false;
      await load(true);
    }catch(err){ expenseError.textContent=err.message||'Could not save expense.'; }
    finally{btn.disabled=false;}
  });
  cancelEditBtn?.addEventListener('click',resetExpenseForm);
  refreshBtn?.addEventListener('click',()=>{loaded=false;load(true);});
  periodEl?.addEventListener('change',()=>{loaded=false;load(true);});
  exportBtn?.addEventListener('click',exportCsv);
  resetExpenseForm();

  window.DOMARO_ACCOUNTING={load};
})();