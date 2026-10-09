const SUPABASE_URL='https://zuqjxcsjjgotwwmlvxmf.supabase.co';
const SUPABASE_KEY='sb_publishable_gaSdKLisgpHYocKX5dYAmw_CZeW6s0c';
module.exports=async(req,res)=>{
 if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
 const token=String(req.headers.authorization||'');
 if(!/^Bearer .+/.test(token))return res.status(401).json({error:'Admin login required'});
 try{
  const orderNumber=String(req.body?.orderNumber||'').trim();
  const reason=String(req.body?.reason||'').trim();
  if(!/^DOM-[0-9]{6}-[A-Z0-9]{6}$/.test(orderNumber))return res.status(400).json({error:'Invalid order'});
  const profile=await fetch(SUPABASE_URL+'/rest/v1/rpc/get_my_admin_profile',{method:'POST',headers:{apikey:SUPABASE_KEY,authorization:token,'content-type':'application/json'},body:'{}'});
  if(!profile.ok)return res.status(403).json({error:'Unauthorized'});
  const admin=await profile.json();
  if(!admin || !(admin.role==='owner'||admin.can_orders))return res.status(403).json({error:'Orders permission required'});
  const resendKey=process.env.RESEND_API_KEY;
  if(!resendKey)return res.status(503).json({error:'Notification service not configured'});
  const response=await fetch(SUPABASE_URL+'/rest/v1/rpc/admin_instapay_notification_details',{method:'POST',headers:{apikey:SUPABASE_KEY,authorization:token,'content-type':'application/json'},body:JSON.stringify({p_order_number:orderNumber})});
  if(!response.ok)throw new Error('Could not fetch order');
  const order=await response.json();
  if(!order||order.payment_method!=='InstaPay'||order.payment_status!=='rejected')return res.status(409).json({error:'Payment has not been rejected'});
  if(!order.email)return res.status(200).json({ok:true,emailSent:false,reason:'Customer email not provided'});
  const safeReason=String(order.reason||reason||'Payment screenshot could not be verified.').slice(0,500);
  const text='Your DOMARO order '+orderNumber+' has been received, but the InstaPay payment screenshot was rejected. Reason: '+safeReason+' Your order is still open. Please open https://domaro-eg.com/track.html?order='+orderNumber+' and enter your mobile number to upload a new screenshot. Check your original transfer before making another payment.';
  const sent=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+resendKey,'Content-Type':'application/json','Idempotency-Key':'domaro-rejected-'+orderNumber+'-'+Buffer.from(safeReason).toString('hex').slice(0,80)},body:JSON.stringify({from:'DOMARO Orders <orders@domaro-eg.com>',to:[order.email],subject:'DOMARO payment needs attention — '+orderNumber,text})});
  if(!sent.ok)throw new Error('Resend failed');
  return res.status(200).json({ok:true,emailSent:true});
 }catch(e){console.error('payment notice failed',e.message);return res.status(500).json({error:'Could not send payment notification'});}
};