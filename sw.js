/* Dentosmile — service worker
   بيخلّي المنصة تفتح فوراً من نسخة محفوظة على الجهاز، وبيجيب أحدث نسخة في الخلفية.
   لو فيه نسخة أحدث بيبعت للصفحة رسالة وبيظهر شريط "فيه نسخة جديدة — اضغط للتحديث". */
const SW_VERSION = '1';
const CACHE = 'dentosmile-shell-v' + SW_VERSION;
const SCOPE_URL = self.registration.scope;                // مثال: https://user.github.io/Dentosmile/
const SCOPE_PATH = new URL(SCOPE_URL).pathname;

self.addEventListener('install', (event)=>{
  self.skipWaiting();
  // نحفظ صفحة المنصة لحظة التثبيت نفسها، فالفتح التاني يبقى فوري
  event.waitUntil((async()=>{
    try{
      const net = await fetch(SCOPE_URL, {cache:'no-cache'});
      if(net && net.ok && !net.redirected){ const cache = await caches.open(CACHE); await cache.put(SCOPE_URL, net); }
    }catch(e){ /* لو فشل بنحفظها في أول فتح */ }
  })());
});
self.addEventListener('activate', (event)=>{
  event.waitUntil((async()=>{
    const keys = await caches.keys();
    await Promise.all(keys.filter(k=>k.indexOf('dentosmile-shell-')===0 && k!==CACHE).map(k=>caches.delete(k)));
    await self.clients.claim();
  })());
});

async function refreshInBackground(cache, cachedText){
  try{
    const net = await fetch(SCOPE_URL, {cache:'no-cache'});
    if(!net || !net.ok || net.redirected) return;
    const text = await net.clone().text();
    if(cachedText!==null && text===cachedText) return;     // مفيش جديد
    await cache.put(SCOPE_URL, net);
    if(cachedText!==null){
      const clients = await self.clients.matchAll({type:'window'});
      clients.forEach(c=>c.postMessage({type:'update-ready'}));
    }
  }catch(e){ /* أوفلاين: نكمّل بالنسخة المحفوظة */ }
}

self.addEventListener('fetch', (event)=>{
  const req = event.request;
  if(req.method!=='GET' || req.mode!=='navigate') return;
  const url = new URL(req.url);
  if(url.origin!==self.location.origin) return;
  if(/[?&]nosw\b/.test(url.search)) return;                              // مخرج طوارئ: ?nosw
  if(url.pathname!==SCOPE_PATH && url.pathname!==SCOPE_PATH + 'index.html') return;   // صفحة المنصة بس
  event.respondWith((async()=>{
    const cache = await caches.open(CACHE);
    const cached = await cache.match(SCOPE_URL);
    if(cached){
      const forCompare = cached.clone();
      event.waitUntil((async()=>{ const t = await forCompare.text(); await refreshInBackground(cache, t); })());
      return cached;
    }
    try{
      const net = await fetch(SCOPE_URL, {cache:'no-cache'});
      if(net && net.ok && !net.redirected) cache.put(SCOPE_URL, net.clone());
      return net;
    }catch(e){
      return Response.error();
    }
  })());
});
