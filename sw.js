// Maneviyat Külliyatı — çevrimdışı açılış yardımcısı
const C="maneviyat-v11";
self.addEventListener("install",e=>{self.skipWaiting();e.waitUntil(caches.open(C).then(c=>c.addAll(["./"])).catch(()=>{}))});
self.addEventListener("activate",e=>{e.waitUntil((async()=>{const ks=await caches.keys();await Promise.all(ks.filter(k=>k.startsWith("maneviyat-")&&k!==C).map(k=>caches.delete(k)));await self.clients.claim()})())});
self.addEventListener("fetch",e=>{
  const r=e.request;if(r.method!=="GET")return;
  if(r.mode==="navigate"){
    e.respondWith((async()=>{
      const cache=await caches.open(C);
      try{
        const res=await Promise.race([fetch(r),new Promise((_,rej)=>setTimeout(()=>rej(new Error("yavaş")),5000))]);
        if(res&&res.ok)cache.put("./",res.clone());
        return res;
      }catch(err){
        const m=await cache.match("./");if(m)return m;
        return fetch(r);
      }
    })());
  }
});
