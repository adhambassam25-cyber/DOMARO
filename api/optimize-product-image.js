const sharp = require('sharp');
const SUPABASE_URL='https://zuqjxcsjjgotwwmlvxmf.supabase.co';
const SUPABASE_KEY='sb_publishable_gaSdKLisgpHYocKX5dYAmw_CZeW6s0c';
module.exports=async function(req,res){
 if(req.method!=='POST')return res.status(405).end();
 const token=String(req.headers.authorization||'');
 if(!/^Bearer .+/.test(token))return res.status(401).json({error:'Login required'});
 try{
  const p=await fetch(SUPABASE_URL+'/rest/v1/rpc/get_my_admin_profile',{method:'POST',headers:{apikey:SUPABASE_KEY,authorization:token,'content-type':'application/json'},body:'{}'});
  if(!p.ok)return res.status(403).json({error:'Admin authorization failed'});
  const admin=await p.json();
  if(!admin||admin.active===false||!(admin.role==='owner'||admin.can_products))return res.status(403).json({error:'Product edit permission required'});
  const chunks=[];let bytes=0;
  for await(const chunk of req){
    bytes+=chunk.length;
    if(bytes>4*1024*1024)return res.status(413).json({error:'Image too large for inline optimization'});
    chunks.push(chunk);
  }
  if(!bytes)return res.status(400).json({error:'Empty image'});
  const original=Buffer.concat(chunks);
  const meta=await sharp(original,{limitInputPixels:25000000}).metadata();
  if(!['png','jpeg','webp'].includes(meta.format))return res.status(415).json({error:'Unsupported image format'});
  const result=await sharp(original,{limitInputPixels:25000000}).webp({lossless:true,effort:6}).keepMetadata().toBuffer();
  if(result.length>=original.length)return res.status(204).end();
  const [a,b]=await Promise.all([sharp(original).ensureAlpha().raw().toBuffer({resolveWithObject:true}),sharp(result).ensureAlpha().raw().toBuffer({resolveWithObject:true})]);
  if(a.info.width!==b.info.width||a.info.height!==b.info.height||!a.data.equals(b.data))return res.status(204).end();
  res.setHeader('Content-Type','image/webp');
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Domaro-Optimized','lossless');
  res.setHeader('X-Original-Bytes',String(original.length));
  res.setHeader('X-Optimized-Bytes',String(result.length));
  return res.status(200).send(result);
 }catch(err){console.error('Product image optimize:',err.message);return res.status(422).json({error:'Image optimization unavailable'});}
};

module.exports.config={api:{bodyParser:false}};
