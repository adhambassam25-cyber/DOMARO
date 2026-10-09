// Public Google Merchant Center RSS product feed, read-only from DOMARO catalog.
const SUPABASE_URL='https://zuqjxcsjjgotwwmlvxmf.supabase.co';
const PUBLIC_KEY='sb_publishable_gaSdKLisgpHYocKX5dYAmw_CZeW6s0c';
const SITE='https://domaro-eg.com';
const escapeXml=value=>String(value??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
const fetchRows=async endpoint=>{
  const response=await fetch(SUPABASE_URL+'/rest/v1/'+endpoint,{headers:{apikey:PUBLIC_KEY,accept:'application/json'},signal:AbortSignal.timeout(12000)});
  if(!response.ok)throw new Error('Catalog request failed '+response.status);
  return response.json();
};
module.exports=async function handler(req,res){
  res.setHeader('Content-Type','application/xml; charset=utf-8');
  res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method!=='GET')return res.status(405).send('<error>Method not allowed</error>');
  try{
    const [products,variants]=await Promise.all([
      fetchRows('products?select=id,name,brand,category,description,image_path&active=eq.true&limit=500'),
      fetchRows('product_variants?select=product_id,price,active,is_default,in_stock,stock_quantity,sort_order&active=eq.true&limit=1000')
    ]);
    const byProduct=new Map();
    for(const v of variants){const key=String(v.product_id);const list=byProduct.get(key)||[];list.push(v);byProduct.set(key,list);}
    const items=[];
    for(const p of products){
      if(!p.id||!p.name||!p.image_path)continue;
      const options=byProduct.get(String(p.id))||[];
      options.sort((a,b)=>Number(b.is_default===true)-Number(a.is_default===true)||Number(a.sort_order??9999)-Number(b.sort_order??9999));
      const chosen=options[0];
      if(!chosen||!(Number(chosen.price)>0))continue;
      const image=String(p.image_path).trim();
      const imageUrl=/^https:\/\//i.test(image)?image:SITE+'/'+image.replace(/^\/+/, '');
      if(!imageUrl.startsWith('https://'))continue;
      const link=SITE+'/products/'+encodeURIComponent(p.id);
      const available=chosen.in_stock===true&&(chosen.stock_quantity===null||Number(chosen.stock_quantity)>0);
      const description=String(p.description||'Explore '+p.name+' by '+(p.brand||'DOMARO')+' at DOMARO Egypt. Shop fragrances online with delivery across Egypt.').replace(/\s+/g,' ').trim().slice(0,4500);
      items.push([
        '<item>',
        '<g:id>'+escapeXml(p.id)+'</g:id>',
        '<title>'+escapeXml((p.brand?String(p.brand).replace(/\s*\([^)]*\)/g,'').trim()+' ':'')+p.name)+'</title>',
        '<description>'+escapeXml(description)+'</description>',
        '<link>'+escapeXml(link)+'</link>',
        '<g:image_link>'+escapeXml(imageUrl)+'</g:image_link>',
        '<g:availability>'+(available?'in_stock':'out_of_stock')+'</g:availability>',
        '<g:price>'+Number(chosen.price).toFixed(2)+' EGP</g:price>',
        '<g:condition>new</g:condition>',
        '<g:brand>'+escapeXml(p.brand||'DOMARO')+'</g:brand>',
        '</item>'
      ].join(''));
    }
    const xml='<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0"><channel><title>DOMARO Fragrances</title><link>'+SITE+'</link><description>DOMARO Egypt active perfume catalog</description>'+items.join('')+'</channel></rss>';
    res.setHeader('Cache-Control','public, s-maxage=900, stale-while-revalidate=300');
    return res.status(200).send(xml);
  }catch(error){
    console.error('Merchant feed generation failed:',error?.message);
    res.setHeader('Cache-Control','no-store');
    return res.status(503).send('<?xml version="1.0"?><error>Feed temporarily unavailable</error>');
  }
};
