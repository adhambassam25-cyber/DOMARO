const {brandedEmail,trackLink}=require('./email-template');
const SUPABASE_URL='https://zuqjxcsjjgotwwmlvxmf.supabase.co';
const SUPABASE_KEY='sb_publishable_gaSdKLisgpHYocKX5dYAmw_CZeW6s0c';
module.exports=async(req,res)=>{
 if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
 const token=String(req.headers.authorization||'');
 if(!/^Bearer .+/.test(token))return res.status(401).json({error:'Admin login required'});
 try{
  const orderNumber=String(req.body?.orderNumber||'').trim();
  if(!/^DOM-[0-9]{6}-[A-Z0-9]{6}$/.test(orderNumber))return res.status(400).json({error:'Invalid order'});
  const profile=await fetch(SUPABASE_URL+'/rest/v1/rpc/get_my_admin_profile',{method:'POST',headers:{apikey:SUPABASE_KEY,authorization:token,'content-type':'application/json'},body:'{}'});
  if(!profile.ok)return res.status(403).json({error:'Unauthorized'});
  const admin=await profile.json();
  if(!admin||(admin.role!=='owner'&&!admin.can_orders))return res.status(403).json({error:'Orders permission required'});
  const response=await fetch(SUPABASE_URL+'/rest/v1/rpc/admin_instapay_notification_details',{method:'POST',headers:{apikey:SUPABASE_KEY,authorization:token,'content-type':'application/json'},body:JSON.stringify({p_order_number:orderNumber})});
  if(!response.ok)throw new Error('Could not verify order');
  const order=await response.json();
  if(!order||order.payment_method!=='InstaPay'||order.payment_status!=='approved')return res.status(409).json({error:'Payment is not approved'});
  if(!order.email)return res.status(200).json({ok:true,emailSent:false});
  if(!process.env.RESEND_API_KEY)return res.status(503).json({error:'Email service not configured'});
  const amountResponse=await fetch(SUPABASE_URL+'/rest/v1/orders?select=total&order_number=eq.'+encodeURIComponent(orderNumber)+'&limit=1',{headers:{apikey:SUPABASE_KEY,authorization:token}});
  if(!amountResponse.ok)throw new Error('Cannot verify payment total');
  const amountRows=await amountResponse.json();
  if(!amountRows.length)throw new Error('Order total unavailable');
  const amount=Number(amountRows[0].total).toLocaleString('en-EG')+' EGP';
  const url='https://domaro-eg.com/track.html?order='+encodeURIComponent(orderNumber);
  const message='Your InstaPay payment of '+amount+' for DOMARO order '+orderNumber+' has been verified successfully. Your order is now awaiting processing. Track your order: '+url;
  const legacyHtml='<div style="font-family:Arial,sans-serif;background:#f5f2ee;padding:24px"><div style="max-width:560px;margin:auto;background:white"><div style="background:#090909;color:white;text-align:center;letter-spacing:4px;font-size:23px;padding:25px">DOMARO</div><div style="padding:30px"><h2>Payment Confirmed</h2><p>Your InstaPay payment has been verified successfully.</p><p><b>Order:</b> '+orderNumber+'<br><b>Amount:</b> '+amount+'<br><b>Status:</b> Payment Approved</p><p>We will now continue processing your order.</p><a href="'+url+'" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:13px 22px">TRACK YOUR ORDER</a></div></div></div>';
  const sent=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+process.env.RESEND_API_KEY,'Content-Type':'application/json','Idempotency-Key':'domaro-approved-'+orderNumber+'-'+String(order.proof_path||'unknown').slice(0,90)},body:JSON.stringify({from:'DOMARO Orders <orders@domaro-eg.com>',to:[order.email],subject:'DOMARO — Payment Confirmed — '+orderNumber,text:message,html:brandedEmail({eyebrow:'PAYMENT UPDATE',title:'Payment Confirmed',description:'Your InstaPay payment has been successfully verified. Thank you for shopping with DOMARO.',rows:[['Order Number',orderNumber],['Payment Method','InstaPay'],['Amount Paid',amount],['Payment Status','Confirmed']],buttonUrl:url,note:'Your order is now being processed.'})})});
  if(!sent.ok)throw new Error('Resend rejected the notification');
  return res.status(200).json({ok:true,emailSent:true});
 }catch(e){console.error('DOMARO approval email failed',e.message);return res.status(500).json({error:'Could not send approval email'});}
};