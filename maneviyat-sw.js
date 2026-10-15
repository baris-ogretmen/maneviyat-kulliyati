// Maneviyat Külliyatı — çevrimdışı açılış yardımcısı (sürüm 12)
// Yalnızca uygulama sayfasını kapsar; bildirimleri sw.js gösterir.
const C="maneviyat-v12";
self.addEventListener("install",e=>{self.skipWaiting()});
self.addEventListener("activate",e=>{e.waitUntil((async()=>{const ks=await caches.keys();await Promise.all(ks.filter(k=>k.startsWith("maneviyat-")&&k!==C).map(k=>caches.delete(k)));await self.clients.claim()})())});
self.addEventListener("fetch",e=>{
  const r=e.request;if(r.method!=="GET"||r.mode!=="navigate")return;
  const u=new URL(r.url);u.search="";u.hash="";const key=u.href;
  e.respondWith((async()=>{
    const cache=await caches.open(C);
    try{
      const res=await Promise.race([fetch(r),new Promise((_,rej)=>setTimeout(()=>rej(new Error("yavaş")),6000))]);
      if(res&&res.ok)cache.put(key,res.clone());
      return res;
    }catch(err){
      const m=await cache.match(key);if(m)return m;
      return fetch(r);
    }
  })());
});
