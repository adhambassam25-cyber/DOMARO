import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const SUPABASE_URL = 'https://zuqjxcsjjgotwwmlvxmf.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_gaSdKLisgpHYocKX5dYAmw_CZeW6s0c';
const OUT_DIR = path.resolve('assets/products-optimized');
const MANIFEST = path.join(OUT_DIR, 'manifest.json');
const SITEMAP_PATH = path.resolve('sitemap.xml');

async function fetchJson(url){
  const res=await fetch(url,{headers:{apikey:SUPABASE_PUBLISHABLE_KEY}});
  if(!res.ok) throw new Error(`Request failed ${res.status}: ${url}`);
  return await res.json();
}

async function fetchPublicSettings(){
  const res=await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_public_store_settings`,{
    method:'POST',
    headers:{apikey:SUPABASE_PUBLISHABLE_KEY,'Content-Type':'application/json'},
    body:'{}'
  });
  if(!res.ok) throw new Error(`Settings request failed ${res.status}`);
  return await res.json();
}

async function rawPixels(buf){
  const {data,info}=await sharp(buf).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  return {data,info};
}

function samePixels(a,b){
  if(a.info.width!==b.info.width || a.info.height!==b.info.height || a.info.channels!==b.info.channels) return false;
  return a.data.length===b.data.length && a.data.equals(b.data);
}

const brandSlug=brand=>String(brand||'').replace(/\([^)]*\)/g,'').trim().toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');

function xmlEscape(value){
  return String(value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
}

function safeName(kind,id){
  return `${kind}-${String(id).replace(/[^a-z0-9_-]+/gi,'-').toLowerCase()}.webp`;
}

async function optimizeOne(url,kind,id){
  try{
    const res=await fetch(url);
    if(!res.ok) throw new Error(`image fetch ${res.status}`);
    const original=Buffer.from(await res.arrayBuffer());

    const decodedOriginal=await rawPixels(original);
    const optimized=await sharp(original)
      .webp({lossless:true,effort:6})
      .keepMetadata()
      .toBuffer();
    const decodedOptimized=await rawPixels(optimized);

    const identical=samePixels(decodedOriginal,decodedOptimized);
    if(!identical) return {url,status:'kept-original',reason:'pixel-mismatch',before:original.length,after:optimized.length};
    if(optimized.length>=original.length) return {url,status:'kept-original',reason:'not-smaller',before:original.length,after:optimized.length};

    const file=safeName(kind,id);
    await fs.writeFile(path.join(OUT_DIR,file),optimized);
    return {
      url,
      status:'optimized',
      localPath:`/assets/products-optimized/${file}`,
      before:original.length,
      after:optimized.length,
      savedPercent:Number((((original.length-optimized.length)/original.length)*100).toFixed(2)),
      pixelsIdentical:true
    };
  }catch(err){
    return {url,status:'kept-original',reason:String(err?.message||err)};
  }
}

await fs.mkdir(OUT_DIR,{recursive:true});

const products=await fetchJson(`${SUPABASE_URL}/rest/v1/products?select=id,image_path,updated_at,brand&active=eq.true&order=display_order.asc.nullslast,created_at.asc`);
const gallery=await fetchJson(`${SUPABASE_URL}/rest/v1/product_images?select=id,product_id,image_path`);
const publicSettings=await fetchPublicSettings();

const jobs=[];
for(const p of products){
  if(p?.image_path) jobs.push({url:p.image_path,kind:'product',id:p.id});
}
for(const g of gallery){
  if(g?.image_path) jobs.push({url:g.image_path,kind:'gallery',id:g.id});
}
if(publicSettings?.entry_gate_wallpaper_url){
  jobs.push({url:publicSettings.entry_gate_wallpaper_url,kind:'site',id:'entry-gate'});
}

const manifest={};
const report=[];
for(const job of jobs){
  const result=await optimizeOne(job.url,job.kind,job.id);
  report.push({...job,...result});
  if(result.status==='optimized') manifest[job.url]=result.localPath;
}

await fs.writeFile(MANIFEST,JSON.stringify(manifest,null,2));
await fs.writeFile(path.join(OUT_DIR,'report.json'),JSON.stringify(report,null,2));

const before=report.reduce((n,x)=>n+(x.before||0),0);
const after=report.reduce((n,x)=>n+((x.status==='optimized'?x.after:x.before)||0),0);
console.log(`DOMARO image build: ${report.filter(x=>x.status==='optimized').length}/${report.length} optimized`);
console.log(`Bytes: ${before} -> ${after} (${before?(((before-after)/before)*100).toFixed(1):0}% saved)`);


const staticPages=[
  ['https://domaro-eg.com/', '1.0'],
  ['https://domaro-eg.com/shop', '0.9'],
  ['https://domaro-eg.com/brands', '0.8'],
  ['https://domaro-eg.com/men', '0.9'],
  ['https://domaro-eg.com/women', '0.9'],
  ['https://domaro-eg.com/unisex', '0.9'],
  ['https://domaro-eg.com/boxes', '0.8'],
  ['https://domaro-eg.com/about', '0.6'],
  ['https://domaro-eg.com/faq', '0.6'],
  ['https://domaro-eg.com/shipping', '0.6'],
  ['https://domaro-eg.com/returns', '0.6'],
  ['https://domaro-eg.com/contact', '0.5'],
];

const activeBrands=[...new Set(products.map(p=>String(p.brand||'').trim()).filter(Boolean))];
const sitemapRows=[
  ...staticPages.map(([loc,priority])=>`  <url><loc>${xmlEscape(loc)}</loc><priority>${priority}</priority></url>`),
  ...activeBrands.map(brand=>`  <url><loc>${xmlEscape(`https://domaro-eg.com/brands/${brandSlug(brand)}`)}</loc><priority>0.8</priority></url>`),
  ...products.map(p=>{
    const loc=`https://domaro-eg.com/products/${encodeURIComponent(String(p.id||''))}`;
    const lastmod=p.updated_at ? `<lastmod>${xmlEscape(new Date(p.updated_at).toISOString().slice(0,10))}</lastmod>` : '';
    return `  <url><loc>${xmlEscape(loc)}</loc>${lastmod}<priority>0.8</priority></url>`;
  })
];

const sitemap=`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapRows.join('\n')}
</urlset>
`;
await fs.writeFile(SITEMAP_PATH,sitemap);
console.log(`DOMARO sitemap build: ${staticPages.length + activeBrands.length + products.length} URLs`);
