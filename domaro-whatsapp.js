/* DOMARO WhatsApp customer contact (no external dependencies; no DOM observers). */
(()=>{
  'use strict';
  const BASE='https://wa.me/201105548868';
  const CHAT=BASE+'?text='+encodeURIComponent('Hello DOMARO, I would like to ask about your fragrances.');
  function init(){
    if(!document.body||document.body.classList.contains('admin-body'))return;
    document.querySelectorAll('footer .socials').forEach(socials=>{
      if(socials.querySelector('[data-domaro-whatsapp]'))return;
      const link=document.createElement('a');
      link.href=CHAT;
      link.target='_blank';
      link.rel='noopener noreferrer';
      link.textContent='WhatsApp';
      link.setAttribute('data-domaro-whatsapp','');
      link.setAttribute('aria-label','Chat with DOMARO on WhatsApp');
      socials.appendChild(link);
    });
    if(!document.getElementById('domaro-wa-css')){
      const style=document.createElement('style');
      style.id='domaro-wa-css';
      style.textContent=`
        .domaro-wa-fab{position:fixed;bottom:calc(18px + env(safe-area-inset-bottom, 0px));left:18px;z-index:80;display:inline-flex;align-items:center;justify-content:center;gap:9px;padding:12px 16px;border:1px solid #77736f;border-radius:999px;background:#141414;color:#fff;text-decoration:none;font:600 11px/1.2 Inter,Arial,sans-serif;letter-spacing:.055em;box-shadow:0 8px 26px rgba(0,0,0,.18);transition:background .2s ease,transform .2s ease}
        .domaro-wa-fab:hover{background:#34312e;transform:translateY(-2px);color:#fff}
        .domaro-wa-fab:focus-visible,.domaro-whatsapp-contact-cta:focus-visible{outline:2px solid #aaa19a;outline-offset:3px}
        .domaro-wa-fab svg{width:19px;height:19px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round;flex:none}
        .domaro-whatsapp-contact-cta{display:inline-block;margin-top:12px;padding:11px 15px;border:1px solid #77706a;border-radius:3px;color:#fff!important;font:600 10px/1.25 Inter,Arial,sans-serif;letter-spacing:.11em;text-decoration:none}
        .domaro-whatsapp-contact-cta:hover{border-color:#eee5da;background:#272421}
        @media(max-width:600px){.domaro-wa-fab{left:12px;bottom:calc(12px + env(safe-area-inset-bottom, 0px));padding:11px 13px;font-size:10px}}
      `;
      document.head.appendChild(style);
    }
    // Do not obscure payment or cart controls with floating UI.
    if(/^\/(?:checkout|cart)(?:\.html)?\/?$/.test(location.pathname))return;
    if(document.getElementById('domaro-whatsapp-contact'))return;
    const link=document.createElement('a');
    link.id='domaro-whatsapp-contact';
    link.className='domaro-wa-fab';
    link.href=CHAT;
    link.target='_blank';
    link.rel='noopener noreferrer';
    link.setAttribute('aria-label','Chat with DOMARO on WhatsApp');
    link.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11.5a7.7 7.7 0 0 1-8 7.5 8.6 8.6 0 0 1-3-.5L4 20l1.4-4A7.5 7.5 0 0 1 4 11.5a7.7 7.7 0 0 1 8-7.5 7.7 7.7 0 0 1 8 7.5Z"/></svg><span>CHAT ON WHATSAPP</span>';
    document.body.appendChild(link);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();
