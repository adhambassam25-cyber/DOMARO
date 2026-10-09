const {brandedEmail,trackLink}=require('./email-template');
const URL='https://zuqjxcsjjgotwwmlvxmf.supabase.co';
const KEY='sb_publishable_gaSdKLisgpHYocKX5dYAmw_CZeW6s0c';
module.exports=async function(req,res){
 if(req.method!=='POST')return res.status(405).end();
 const {orderNumber,phone,path}=req.body||{};
 if(!/^DOM-[0-9]{6}-[A-Z0-9]{6}$/.test(orderNumber||'')||!/^01[0125][0-9]{8}$/.test(phone||'')||!/^[a-f0-9]{48}\.(png|jpg|jpeg|webp)$/.test(path||''))return res.status(400).end();
 const verified=await fetch(URL+'/rest/v1/rpc/verify_instapay_resubmission',{method:'POST',headers:{apikey:KEY,'content-type':'application/json'},body:JSON.stringify({p_order_number:orderNumber,p_phone:phone,p_path:path})});
 if(!verified.ok||await verified.json()!==true)return res.status(403).end();
 const key=process.env.RESEND_API_KEY;
 if(!key)return res.status(503).end();
 const sent=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json','Idempotency-Key':'domaro-proof-'+path},body:JSON.stringify({from:'DOMARO Orders <orders@domaro-eg.com>',to:[process.env.ORDER_NOTIFICATION_EMAIL||'domaro.eg@gmail.com'],subject:'DOMARO new payment proof — '+orderNumber,text:'A new InstaPay proof was submitted for '+orderNumber+'. Please review it in the DOMARO admin dashboard.',html:brandedEmail({eyebrow:'ADMIN NOTIFICATION',title:'New InstaPay Screenshot Uploaded',description:'A customer has submitted a new payment screenshot for review.',rows:[['Order Number',orderNumber],['Payment Method','InstaPay']],buttonLabel:'OPEN ADMIN DASHBOARD',buttonUrl:'https://domaro-eg.com/admin.html'})})});
 return res.status(sent.ok?200:502).json({ok:sent.ok});
};