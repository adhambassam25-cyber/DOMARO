const BASE='https://zuqjxcsjjgotwwmlvxmf.supabase.co';
const KEY='sb_publishable_gaSdKLisgpHYocKX5dYAmw_CZeW6s0c';
module.exports=async(req,res)=>{
 if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
 const auth=String(req.headers.authorization||'');
 if(!auth.startsWith('Bearer '))return res.status(401).json({error:'Login required'});
 const rpc=async(name,args)=>{const x=await fetch(BASE+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:KEY,authorization:auth,'content-type':'application/json'},body:JSON.stringify(args)});const data=await x.json().catch(()=>null);if(!x.ok)throw Error(data?.message||'Request failed');return data};
 let claimed=false,orderNumber='',event='',to='';
 try{
  orderNumber=String(req.body?.orderNumber||'').trim();
  event=String(req.body?.event||'');
  if(!/^DOM-(?:M-)?[0-9]{6}-[A-Z0-9]{6}$/.test(orderNumber)||!['confirmed','shipped','delivered','cancelled','screenshot_uploaded'].includes(event))return res.status(400).json({error:'Invalid notification'});
  const o=await rpc('admin_order_notification_details',{p_order_number:orderNumber});
  if(!o)return res.status(404).json({error:'Order missing'});
  const statusMatches=event==='screenshot_uploaded'?o.payment_status==='pending_verification':o.status===event;
  if(!statusMatches)return res.status(409).json({error:'Order status does not match'});
  to=event==='screenshot_uploaded'?(process.env.ORDER_NOTIFICATION_EMAIL||'domaro.eg@gmail.com'):o.email;
  if(!to)return res.status(200).json({ok:true,emailSent:false,reason:'No email'});
  claimed=await rpc('claim_order_email_event',{p_order_number:orderNumber,p_event_key:event,p_recipient:to});
  if(!claimed)return res.status(200).json({ok:true,duplicate:true});
  if(!process.env.RESEND_API_KEY)throw Error('Resend not configured');
  const labels={confirmed:'Order Confirmed',shipped:'Order Shipped',delivered:'Order Delivered',cancelled:'Order Cancelled',screenshot_uploaded:'New InstaPay Screenshot Uploaded'};
  const title=labels[event],link='https://domaro-eg.com/track.html?order='+encodeURIComponent(orderNumber);
  const message=event==='screenshot_uploaded'?'A customer uploaded a new InstaPay payment screenshot for order '+orderNumber+'. Review it in DOMARO Admin.':'Your DOMARO order '+orderNumber+' status is now '+title+'. Track your order: '+link;
  const send=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+process.env.RESEND_API_KEY,'Content-Type':'application/json','Idempotency-Key':'domaro-'+event+'-'+orderNumber},body:JSON.stringify({from:'DOMARO Orders <orders@domaro-eg.com>',to:[to],subject:'DOMARO — '+title+' — '+orderNumber,text:message})});
  const result=await send.json().catch(()=>null);
  if(!send.ok)throw Error(result?.message||'Email provider rejected request');
  await rpc('finalize_order_email_event',{p_order_number:orderNumber,p_event_key:event,p_recipient:to,p_success:true,p_provider_id:result?.id||null,p_error:null});
  return res.status(200).json({ok:true,emailSent:true});
 }catch(e){
  if(claimed)try{await rpc('finalize_order_email_event',{p_order_number:orderNumber,p_event_key:event,p_recipient:to,p_success:false,p_provider_id:null,p_error:e.message})}catch(_){}
  console.error('DOMARO notification failed',e.message);return res.status(500).json({error:'Notification could not be sent'});
 }
};