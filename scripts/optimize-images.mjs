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

const products=await fetchJson(`${SUPABASE_URL}/rest/v1/products?select=id,name,brand,category,description,image_path,updated_at&active=eq.true&order=display_order.asc.nullslast,created_at.asc`);
const variants=await fetchJson(`${SUPABASE_URL}/rest/v1/product_variants?select=product_id,price,active,in_stock,stock_quantity&active=eq.true`);
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



const SITE_ORIGIN='https://domaro-eg.com';
const SEO_DIR=path.resolve('seo-generated');

function htmlEscape(value){
  return String(value ?? '')
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#039;');
}

function absoluteSiteUrl(value){
  const raw=String(value||'').trim();
  if(!raw) return SITE_ORIGIN+'/assets/hook-blue.png';
  if(/^https?:\/\//i.test(raw)) return raw;
  return SITE_ORIGIN+'/'+raw.replace(/^\/+/, '');
}

function setHeadSeo(html,{title,description,canonical,image,ogType='website'}){
  const safeTitle=htmlEscape(title);
  const safeDescription=htmlEscape(description);
  const safeCanonical=htmlEscape(canonical);
  const safeImage=htmlEscape(image||SITE_ORIGIN+'/assets/hook-blue.png');
  html=html.replace(/<title>[\s\S]*?<\/title>/i,`<title>${safeTitle}</title>`);
  html=html.replace(/<meta name="description" content="[^"]*">/i,`<meta name="description" content="${safeDescription}">`);
  html=html.replace(/<link rel="canonical" href="[^"]*">/i,`<link rel="canonical" href="${safeCanonical}">`);
  html=html.replace(/<meta property="og:type" content="[^"]*">/i,`<meta property="og:type" content="${htmlEscape(ogType)}">`);
  html=html.replace(/<meta property="og:title" content="[^"]*">/i,`<meta property="og:title" content="${safeTitle}">`);
  html=html.replace(/<meta property="og:description" content="[^"]*">/i,`<meta property="og:description" content="${safeDescription}">`);
  html=html.replace(/<meta property="og:url" content="[^"]*">/i,`<meta property="og:url" content="${safeCanonical}">`);
  html=html.replace(/<meta property="og:image" content="[^"]*">/i,`<meta property="og:image" content="${safeImage}">`);
  html=html.replace(/<meta name="twitter:title" content="[^"]*">/i,`<meta name="twitter:title" content="${safeTitle}">`);
  html=html.replace(/<meta name="twitter:description" content="[^"]*">/i,`<meta name="twitter:description" content="${safeDescription}">`);
  html=html.replace(/<meta name="twitter:image" content="[^"]*">/i,`<meta name="twitter:image" content="${safeImage}">`);
  return html;
}

function injectJsonLd(html,id,data){
  const safeJson=JSON.stringify(data).replace(/</g,'\\u003c');
  const script=`<script type="application/ld+json" id="${id}">${safeJson}</script>`;
  const re=new RegExp(`<script[^>]+id=["']${id}["'][^>]*>[\\s\\S]*?<\\/script>`,'i');
  return re.test(html) ? html.replace(re,script) : html.replace('</head>',script+'\n</head>');
}

function trimDescription(value,fallback){
  const clean=String(value||fallback||'').replace(/\s+/g,' ').trim();
  return clean.length>155 ? clean.slice(0,152).trimEnd()+'...' : clean;
}

async function buildSeoPages(){
  const shopTemplate=await fs.readFile(path.resolve('shop.html'),'utf8');
  const productTemplate=await fs.readFile(path.resolve('product.html'),'utf8');
  await fs.rm(SEO_DIR,{recursive:true,force:true});
  await fs.mkdir(path.join(SEO_DIR,'categories'),{recursive:true});
  await fs.mkdir(path.join(SEO_DIR,'brands'),{recursive:true});
  await fs.mkdir(path.join(SEO_DIR,'products'),{recursive:true});

  const categories={
    men:{
      title:'Men’s Perfumes & Fragrances in Egypt | DOMARO',
      description:'Shop premium men’s perfumes and fragrances at DOMARO Egypt. Discover woody, fresh, aromatic and warm scents with delivery across Egypt.',
      h1:'MEN’S FRAGRANCES',
      sub:'Explore premium fragrances for men, from fresh everyday scents to bold evening profiles.'
    },
    women:{
      title:'Women’s Perfumes & Fragrances in Egypt | DOMARO',
      description:'Shop premium women’s perfumes and fragrances at DOMARO Egypt. Discover floral, fruity, musky and elegant scents with delivery across Egypt.',
      h1:'WOMEN’S FRAGRANCES',
      sub:'Explore elegant fragrances for women, from soft floral profiles to rich signature scents.'
    },
    unisex:{
      title:'Unisex Perfumes & Fragrances in Egypt | DOMARO',
      description:'Shop premium unisex perfumes and fragrances at DOMARO Egypt. Discover oud, musk, amber and modern oriental scents with delivery across Egypt.',
      h1:'UNISEX FRAGRANCES',
      sub:'Explore versatile unisex fragrances with modern, oriental and Arabic-inspired character.'
    },
    boxes:{
      title:'Perfume Gift Boxes & Sets in Egypt | DOMARO',
      description:'Shop perfume gift boxes and fragrance sets at DOMARO Egypt. Discover premium presentation sets for gifting with delivery across Egypt.',
      h1:'PERFUME GIFT BOXES',
      sub:'Explore fragrance gift boxes and premium sets selected for memorable gifting.'
    }
  };

  for(const [slug,seo] of Object.entries(categories)){
    const canonical=SITE_ORIGIN+'/'+slug;
    let html=setHeadSeo(shopTemplate,{...seo,canonical,image:SITE_ORIGIN+'/assets/hook-blue.png'});
    html=html.replace(/<h1 id="shop-context-title">[\s\S]*?<\/h1>/i,`<h1 id="shop-context-title">${htmlEscape(seo.h1)}</h1>`);
    html=html.replace(/<p id="shop-context-sub">[\s\S]*?<\/p>/i,`<p id="shop-context-sub">${htmlEscape(seo.sub)}</p>`);
    await fs.writeFile(path.join(SEO_DIR,'categories',slug+'.html'),html);
  }

  const activeBrands=[...new Set(products.map(p=>String(p.brand||'').trim()).filter(Boolean))];
  for(const brand of activeBrands){
    const slug=brandSlug(brand);
    const canonical=SITE_ORIGIN+'/brands/'+slug;
    const description=trimDescription('',`Shop ${brand} perfumes at DOMARO Egypt. Explore available fragrances, prices, sizes and delivery across Egypt.`);
    let html=setHeadSeo(shopTemplate,{
      title:`${brand} Perfumes in Egypt | DOMARO`,
      description,
      canonical,
      image:SITE_ORIGIN+'/assets/hook-blue.png'
    });
    html=html.replace(/<h1 id="shop-context-title">[\s\S]*?<\/h1>/i,`<h1 id="shop-context-title">${htmlEscape(brand)}</h1>`);
    html=html.replace(/<p id="shop-context-sub">[\s\S]*?<\/p>/i,`<p id="shop-context-sub">Explore every ${htmlEscape(brand)} fragrance currently available at DOMARO.</p>`);
    await fs.writeFile(path.join(SEO_DIR,'brands',slug+'.html'),html);
  }

  const variantsByProduct=new Map();
  for(const variant of variants){
    const list=variantsByProduct.get(String(variant.product_id))||[];
    list.push(variant);
    variantsByProduct.set(String(variant.product_id),list);
  }

  for(const product of products){
    const id=String(product.id||'').trim();
    if(!id) continue;
    const canonical=SITE_ORIGIN+'/products/'+encodeURIComponent(id);
    const image=absoluteSiteUrl(product.image_path);
    const description=trimDescription(
      product.description,
      `Shop ${product.name} perfume in Egypt at DOMARO. View fragrance notes, availability, current price and delivery information.`
    );
    const title=`${product.name} Perfume in Egypt | ${product.brand||'DOMARO'} | DOMARO`;
    let html=setHeadSeo(productTemplate,{title,description,canonical,image,ogType:'product'});

    const productVariants=variantsByProduct.get(id)||[];
    const prices=productVariants.map(v=>Number(v.price)).filter(Number.isFinite);
    const inStock=productVariants.length
      ? productVariants.some(v=>v.in_stock===true && (v.stock_quantity===null || Number(v.stock_quantity)>0))
      : true;
    const lowPrice=prices.length ? Math.min(...prices) : null;
    const schema={
      '@context':'https://schema.org',
      '@type':'Product',
      '@id':canonical+'#product',
      name:product.name,
      url:canonical,
      image:[image],
      description,
      brand:{'@type':'Brand',name:product.brand||'DOMARO'},
      category:String(product.category||'Fragrance'),
      seller:{'@id':SITE_ORIGIN+'/#organization'}
    };
    if(lowPrice!==null){
      schema.offers={
        '@type':'Offer',
        url:canonical,
        priceCurrency:'EGP',
        price:lowPrice,
        availability:inStock?'https://schema.org/InStock':'https://schema.org/OutOfStock',
        seller:{'@id':SITE_ORIGIN+'/#organization'}
      };
    }
    html=injectJsonLd(html,'domaro-product-schema',schema);
    html=injectJsonLd(html,'domaro-breadcrumb-schema',{
      '@context':'https://schema.org',
      '@type':'BreadcrumbList',
      itemListElement:[
        {'@type':'ListItem',position:1,name:'Home',item:SITE_ORIGIN+'/'},
        {'@type':'ListItem',position:2,name:'Shop',item:SITE_ORIGIN+'/shop'},
        {'@type':'ListItem',position:3,name:product.name,item:canonical}
      ]
    });
    await fs.writeFile(path.join(SEO_DIR,'products',id+'.html'),html);
  }

  console.log(`DOMARO prerender SEO build: ${Object.keys(categories).length} categories, ${activeBrands.length} brands, ${products.length} products`);
}

await buildSeoPages();

const staticPages=[
  ['https://domaro-eg.com/', '1.0'],
  ['https://domaro-eg.com/shop', '0.9'],
  ['https://domaro-eg.com/brands', '0.8'],
  ['https://domaro-eg.com/fragrance-guide', '0.7'],
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
