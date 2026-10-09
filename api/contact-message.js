const {brandedEmail}=require('./email-template');
const recent=new Map();
function clean(s,max){return String(s??'').trim().slice(0,max)}
function escape(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
module.exports=async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
 const body=req.body||{};
 if(typeof body!== 'object'||Array.isArray(body))return res.status(400).json({error:'Invalid message'});
 if(body.website)return res.status(200).json({ok:true});
 const first=clean(body.firstName,60),last=clean(body.lastName,60),email=clean(body.email,160),phone=clean(body.phone,40),topic=clean(body.topic,50),message=clean(body.message,3000);
 if(!first||!last||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||message.length<10||message.length>3000||!['General inquiry','Order support','Wholesale / collaboration'].includes(topic))return res.status(400).json({error:'Please complete all required fields and enter a message of at least 10 characters.'});
 if(phone&&!/^[+\d ()-]{7,24}$/.test(phone))return res.status(400).json({error:'Please enter a valid phone number.'});
 const key=String(req.headers['x-forwarded-for']||req.socket?.remoteAddress||'unknown').split(',')[0].trim().slice(0,100);
 const now=Date.now();for(const [k,v] of recent)if(now-v>60000)recent.delete(k);
 if(recent.has(key))return res.status(429).json({error:'Please wait a minute before sending another message.'});
 recent.set(key,now);
 const apiKey=process.env.RESEND_API_KEY;
 if(!apiKey)return res.status(503).json({error:'Contact service is temporarily unavailable.'});
 try{
  const html=brandedEmail({eyebrow:'CUSTOMER INQUIRY',title:'New Contact Message',description:'A customer sent an inquiry through the DOMARO website.',rows:[['Customer',first+' '+last],['Email',email],['Phone',phone||'Not provided'],['Subject',topic]],rawContent:'<p style="white-space:pre-wrap;line-height:1.7">'+escape(message)+'</p>',buttonLabel:'OPEN ADMIN DASHBOARD',buttonUrl:'https://domaro-eg.com/admin.html'});
  const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+apiKey,'Content-Type':'application/json'},body:JSON.stringify({from:'DOMARO Orders <orders@domaro-eg.com>',to:['domaro.eg@gmail.com'],reply_to:email,subject:'DOMARO Contact — '+topic,html,text:'Name: '+first+' '+last+'\nEmail: '+email+'\nPhone: '+phone+'\nSubject: '+topic+'\n\n'+message})});
  if(!response.ok){console.error('Contact Resend failure',response.status,await response.text());recent.delete(key);return res.status(502).json({error:'Could not send your message right now. Please try again.'})}
  return res.status(200).json({ok:true});
 }catch(err){recent.delete(key);console.error('Contact send error',err);return res.status(502).json({error:'Could not send your message right now. Please try again.'})}
};
