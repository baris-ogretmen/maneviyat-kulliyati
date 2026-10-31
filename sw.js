/* Değişim Koleji — bildirim servis çalışanı (sw.js)
   Okul sistemi dosyasıyla AYNI klasöre yükleyin. Önbellek tutmaz (güncellemeler hemen gelir).
   Görevi: telefona bildirim göstermek, bildirime dokununca uygulamayı açmak. */
self.addEventListener('install', function(e){ self.skipWaiting(); });
self.addEventListener('activate', function(e){ e.waitUntil(self.clients.claim()); });
self.addEventListener('notificationclick', function(e){
  e.notification.close();
  var url = (e.notification.data && e.notification.data.url) || self.registration.scope;
  e.waitUntil(self.clients.matchAll({type:'window', includeUncontrolled:true}).then(function(list){
    for (var i=0;i<list.length;i++){ var c=list[i]; if (c.url.indexOf(self.registration.scope)===0 && 'focus' in c) return c.focus(); }
    if (self.clients.openWindow) return self.clients.openWindow(url);
  }));
});
/* Sürüm 52: uygulama KAPALIYKEN gelen bildirimler (kasa sunucusundan) */
self.addEventListener('push', function(e){
  var d = {};
  try { d = e.data ? e.data.json() : {}; } catch(x){ d = { baslik:'Değişim Koleji', govde: e.data ? e.data.text() : '' }; }
  var opt = { body: d.govde || d.body || '', icon: d.icon, badge: d.icon, data: { url: d.url || self.registration.scope } };
  if (d.etiket) { opt.tag = d.etiket; opt.renotify = false; }
  e.waitUntil(Promise.all([
    self.registration.showNotification(d.baslik || d.title || 'Değişim Koleji', opt),
    bildirimSakla({ t: Date.now(), b: d.baslik || d.title || '', g: opt.body, u: opt.data.url }),
    (self.navigator && self.navigator.setAppBadge) ? self.registration.getNotifications().then(function(l){ return self.navigator.setAppBadge(l.length||1); }).catch(function(){}) : Promise.resolve()
  ]));
});

/* Sürüm 37: gelen bildirimleri uygulamadaki "Bildirimlerim" listesi için sakla */
function bildirimSakla(x){
  return new Promise(function(res){
    try{
      var q = indexedDB.open('maneviyat-kasa', 1);
      q.onupgradeneeded = function(){ try{ q.result.createObjectStore('kv'); }catch(e){} };
      q.onerror = function(){ res(); };
      q.onsuccess = function(){
        try{
          var db = q.result, st = db.transaction('kv','readwrite').objectStore('kv'), g = st.get('sw_bildirim');
          g.onsuccess = function(){ var a = g.result || []; a.unshift(x); st.put(a.slice(0,200), 'sw_bildirim'); res(); };
          g.onerror = function(){ res(); };
        }catch(e){ res(); }
      };
    }catch(e){ res(); }
  });
}
