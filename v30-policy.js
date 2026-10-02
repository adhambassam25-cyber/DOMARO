(()=>{
  const url=window.DOMARO_ADMIN_CONFIG?.SUPABASE_URL || "https://zuqjxcsjjgotwwmlvxmf.supabase.co";
  const key=window.DOMARO_ADMIN_CONFIG?.SUPABASE_KEY || "sb_publishable_gaSdKLisgpHYocKX5dYAmw_CZeW6s0c";
  const set=(id,value)=>{const el=document.getElementById(id);if(el && value)el.textContent=String(value);};
  fetch(url+"/rest/v1/rpc/get_public_store_settings",{
    method:"POST",
    headers:{"apikey":key,"Content-Type":"application/json"},
    body:"{}"
  }).then(r=>r.ok?r.json():null).then(s=>{
    if(!s) return;
    set("returns-intro",s.returns_intro);
    set("returns-eligible",s.returns_eligible);
    set("returns-opened",s.returns_opened);
    set("returns-condition",s.returns_condition);
    set("returns-shipping-refunds",s.returns_shipping_refunds);
    set("returns-how-to",s.returns_how_to);
    set("returns-note",s.returns_note);
  }).catch(()=>{});
})();