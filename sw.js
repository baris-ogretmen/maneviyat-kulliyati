/* Maneviyat Külliyatı — bildirim servis çalışanı (sw.js) · sürüm 50
   Okul sistemi dosyasıyla AYNI klasöre yükleyin. Önbellek tutmaz (güncellemeler hemen gelir).
   Görevi: telefona bildirim göstermek, bildirime dokununca uygulamayı açmak. */
self.addEventListener('install', function(e){ self.skipWaiting(); });
self.addEventListener('activate', function(e){ e.waitUntil(self.clients.claim()); });
self.addEventListener('notificationclick', function(e){
  e.notification.close();
  var url = (e.notification.data && e.notification.data.url) || self.registration.scope;
  /* Sürüm 48: dokunulan bildirim uygulamada beğen/paylaş kartıyla açılsın */
  var tik = { t: Date.now(), b: e.notification.title || '', g: e.notification.body || '' };
  e.waitUntil(kvAc().then(function(db){ if(db){ try{ db.transaction('kv','readwrite').objectStore('kv').put(tik,'sw_tiklanan'); }catch(x){} } }).catch(function(){}).then(function(){ return self.clients.matchAll({type:'window', includeUncontrolled:true}).then(function(list){
    for (var i=0;i<list.length;i++){ var c=list[i]; if (c.url.indexOf(self.registration.scope)===0 && 'focus' in c) return c.focus(); }
    if (self.clients.openWindow) return self.clients.openWindow(url);
  }); }));
});
/* Sürüm 52: uygulama KAPALIYKEN gelen bildirimler (kasa sunucusundan) */
self.addEventListener('push', function(e){
  var d = {};
  try { d = e.data ? e.data.json() : {}; } catch(x){ d = { baslik:'Değişim Koleji', govde: e.data ? e.data.text() : '' }; }
  e.waitUntil(dinamikSec(d).then(function(d){
  var opt = { body: d.govde || d.body || '', icon: d.icon, badge: d.icon, data: { url: d.url || self.registration.scope } };
  if (d.etiket) { opt.tag = d.etiket; opt.renotify = false; }
  return Promise.all([
    self.registration.showNotification(d.baslik || d.title || 'Değişim Koleji', opt),
    bildirimSakla({ t: Date.now(), b: d.baslik || d.title || '', g: opt.body, u: opt.data.url }),
    (self.navigator && self.navigator.setAppBadge) ? self.registration.getNotifications().then(function(l){ return self.navigator.setAppBadge(l.length||1); }).catch(function(){}) : Promise.resolve()
  ]);
  }));
});

/* Sürüm 47: dinamik bildirim — uygulama hiç açılmasa bile her Risale/saatlik bildirimde
   telefondaki havuzdan SIRADAKİ içerik seçilir; hepsi bitmeden hiçbiri tekrar etmez. */
function kvAc(){return new Promise(function(res){try{var q=indexedDB.open('maneviyat-kasa',1);q.onupgradeneeded=function(){try{q.result.createObjectStore('kv');}catch(e){}};q.onerror=function(){res(null);};q.onsuccess=function(){res(q.result);};}catch(e){res(null);}});}
function dinamikSec(d){
  var b = String(d.baslik || d.title || '');
  /* Sürüm 50: “Gece duası” kişiseldir; bu telefon sahibin telefonu değilse genel metin gösterilir */
  if (/Gece duası/.test(b)) return kvAc().then(function(db){ if(!db) return d; return new Promise(function(res){ try{ var q=db.transaction('kv','readonly').objectStore('kv').get('sahip'); q.onsuccess=function(){ if(q.result) return res(d); var y={}; for(var k in d) y[k]=d[k]; y.govde='Darlık duasını ve Efendimizin sığınma dualarını oku. Geçmişlerimizin ruhuna bir Fâtiha okumayı unutma.'; res(y); }; q.onerror=function(){ res(d); }; }catch(e){ res(d); } }); }).catch(function(){ return d; });
  var kanal = /Maneviyat · Günün/.test(b) ? 'ri' : (/Maneviyat · Saat \d/.test(b) ? 'hep' : '');
  if (!kanal) return Promise.resolve(d);
  return kvAc().then(function(db){
    if (!db) return d;
    return new Promise(function(res){
      try{
        var st = db.transaction('kv','readwrite').objectStore('kv'), g = st.get('dyn_havuz');
        g.onsuccess = function(){
          var h = g.result; var L = h && h[kanal];
          if (!L || !L.length) return res(d);
          var c = st.get('dyn_i_' + kanal);
          c.onsuccess = function(){
            var i = (c.result || 0) % L.length; st.put(i + 1, 'dyn_i_' + kanal);
            var x = L[i]; var y = {}; for (var k in d) y[k] = d[k];
            y.govde = x[0]; y.url = x[1] || d.url; res(y);
          };
          c.onerror = function(){ res(d); };
        };
        g.onerror = function(){ res(d); };
      }catch(e){ res(d); }
    });
  }).catch(function(){ return d; });
}

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
