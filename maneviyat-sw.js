// Maneviyat Vakit — Scriptable widget'ı (ana ekran + kilit ekranı)
// Kurulum: Scriptable uygulamasında yeni betik aç, bu dosyanın tamamını yapıştır, adını "Maneviyat Vakit" koy.
// Widget'ı düzenlerken Parameter alanına şehir yazabilirsin (ör. Ankara ya da İstanbul/Kadıköy). Boşsa İstanbul.
// Sürüm 2: Vakitler doğrudan Diyanet İşleri Başkanlığı tablosundan gelir (birebir aynı dakika).
// Sürüm 3: Vakit çıkmaya 20 dakika kala widget kırmızıya döner, kalan süre ve “kılmadıysan şimdi kıl” yazar.

const SEHIR = ((args.widgetParameter || "").trim()) || "Istanbul";
const APP_URL = "https://baris-ogretmen.github.io/maneviyat-kulliyati/";
const fm = FileManager.local();
const CACHE = fm.joinPath(fm.documentsDirectory(), "maneviyat-diyanet-" + SEHIR.toLowerCase().replace(/[^a-z0-9çğıöşü]+/g, "-") + ".json");

const VAKITLER = [
  ["İmsak", "Fajr", "🌙"], ["Güneş", "Sunrise", "🌅"], ["Öğle", "Dhuhr", "☀️"],
  ["İkindi", "Asr", "🌤️"], ["Akşam", "Maghrib", "🌇"], ["Yatsı", "Isha", "🌌"]
];
// Her vaktin rengi (uygulamadaki kartla aynı)
const RENK = {
  "İmsak": ["#2b2a6b", "#6a4c93"], "Güneş": ["#b86e12", "#1f7f73"], "Öğle": ["#1f5f9e", "#3f86c9"],
  "İkindi": ["#a8541a", "#c7832b"], "Akşam": ["#a8302a", "#6d3680"], "Yatsı": ["#152a4a", "#2f4f7f"]
};

function gunAnahtari(d) { return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate(); }
function dKisa(d) { return String(d.getDate()).padStart(2, "0") + "." + String(d.getMonth() + 1).padStart(2, "0") + "." + d.getFullYear(); }
function trAscii(x) {
  return String(x || "").replace(/[İIı]/g, "I").replace(/i/g, "I").replace(/[Şş]/g, "S").replace(/[Ğğ]/g, "G")
    .replace(/[Üü]/g, "U").replace(/[Öö]/g, "O").replace(/[Çç]/g, "C").toUpperCase().replace(/\s+/g, " ").trim();
}
const EV = "https://ezanvakti.emushaf.net";
const DY_ALAN = { "İmsak": "Imsak", "Güneş": "Gunes", "Öğle": "Ogle", "İkindi": "Ikindi", "Akşam": "Aksam", "Yatsı": "Yatsi" };

function onbellekOku() {
  if (fm.fileExists(CACHE)) { try { return JSON.parse(fm.readString(CACHE)); } catch (e) { } }
  return {};
}
function onbellekYaz(o) { try { fm.writeString(CACHE, JSON.stringify(o)); } catch (e) { } }

// Diyanet ilçe numarasını bul (İstanbul hazır; diğer şehirler bir kez sorulup saklanır)
async function ilceNo(ob) {
  if (ob.ilce) return ob.ilce;
  let [il, ilce] = SEHIR.split("/").map(trAscii); if (!ilce) ilce = il;
  if (il === "ISTANBUL" && ilce === "ISTANBUL") return "9541";
  const sehirler = await new Request(EV + "/sehirler/2").loadJSON();
  const s = sehirler.find(x => trAscii(x.SehirAdiEn || x.SehirAdi) === il);
  if (!s) return null;
  const ilceler = await new Request(EV + "/ilceler/" + s.SehirID).loadJSON();
  const z = ilceler.find(x => trAscii(x.IlceAdiEn || x.IlceAdi) === ilce) || ilceler.find(x => trAscii(x.IlceAdiEn || x.IlceAdi) === il) || ilceler[0];
  return z ? String(z.IlceID) : null;
}

// Diyanet'in kendi tablosu: 30 günlük vakitleri bir kerede alır, telefonda saklar (internet yokken de çalışır)
async function diyanetYenile(ob) {
  const id = await ilceNo(ob);
  if (!id) return false;
  const arr = await new Request(EV + "/vakitler/" + id).loadJSON();
  if (!Array.isArray(arr) || !arr.length) return false;
  const g = {};
  arr.forEach(x => { const o = {}; Object.keys(DY_ALAN).forEach(ad => o[ad] = String(x[DY_ALAN[ad]]).slice(0, 5)); g[x.MiladiTarihKisa] = o; });
  ob.ilce = id; ob.dy = g; ob.at = Date.now();
  onbellekYaz(ob);
  return true;
}

async function vakitleriAl(gun) {
  const ob = onbellekOku();
  const k = dKisa(gun);
  const taze = ob.at && (Date.now() - ob.at < 7 * 864e5);
  if (ob.dy && ob.dy[k] && taze) return ob.dy[k];
  try { if (await diyanetYenile(ob) && ob.dy[k]) return ob.dy[k]; } catch (e) { }
  if (ob.dy && ob.dy[k]) return ob.dy[k];
  // Yedek: aladhan (Diyanet'e ulaşılamazsa; ±1 dk fark olabilir)
  try {
    const tarih = gun.getDate() + "-" + (gun.getMonth() + 1) + "-" + gun.getFullYear();
    const url = "https://api.aladhan.com/v1/timingsByCity/" + tarih + "?city=" + encodeURIComponent(SEHIR.split("/")[0]) + "&country=Turkey&method=13";
    const j = await new Request(url).loadJSON();
    const t = j.data.timings, o = {};
    VAKITLER.forEach(([ad, anahtar]) => { o[ad] = String(t[anahtar]).slice(0, 5); });
    return o;
  } catch (e) {
    if (ob.dy) { const son = Object.keys(ob.dy).pop(); return ob.dy[son]; }
    return null;
  }
}

function saatTarih(gun, hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date(gun); d.setHours(h, m, 0, 0); return d;
}

const CIKIS_DK = 20; // vakit çıkmadan kaç dakika önce kırmızıya dönsün
async function durum() {
  const simdi = new Date();
  const bugun = new Date(); bugun.setHours(0, 0, 0, 0);
  const yarin = new Date(bugun); yarin.setDate(yarin.getDate() + 1);
  const v = await vakitleriAl(bugun);
  if (!v) return null;
  const liste = VAKITLER.map(([ad, , ikon]) => ({ ad, ikon, saat: v[ad], tarih: saatTarih(bugun, v[ad]) }));
  let sonraki = liste.find(x => x.tarih > simdi);
  let simdiki = [...liste].reverse().find(x => x.tarih <= simdi) || liste[5];
  if (!sonraki) {
    const vy = (await vakitleriAl(yarin)) || v;
    sonraki = { ad: "İmsak", ikon: "🌙", saat: vy["İmsak"], tarih: saatTarih(yarin, vy["İmsak"]) };
  }
  // Sürüm 3: vakit çıkmaya CIKIS_DK dakika kala kırmızı uyarı
  const CIKAN = { "Güneş": "Sabah", "İkindi": "Öğle", "Akşam": "İkindi", "Yatsı": "Akşam" };
  const kalanDk = (sonraki.tarih - simdi) / 60000;
  const cikan = CIKAN[sonraki.ad] && kalanDk <= CIKIS_DK ? CIKAN[sonraki.ad] : null;
  return { liste, sonraki, simdiki, simdi, cikan };
}

function gradyan(ad) {
  const g = new LinearGradient();
  const r = RENK[ad] || RENK["Yatsı"];
  g.colors = [new Color(r[0]), new Color(r[1])]; g.locations = [0, 1];
  g.startPoint = new Point(0, 0); g.endPoint = new Point(1, 1);
  return g;
}

function geriSayim(stack, tarih, boy, renk) {
  const t = stack.addDate(tarih);
  t.applyTimerStyle();
  t.font = Font.boldRoundedSystemFont(boy);
  t.textColor = renk || Color.white();
  return t;
}

async function widgetYap() {
  const d = await durum();
  const w = new ListWidget();
  w.url = APP_URL;
  const aile = config.widgetFamily || "medium";

  if (!d) {
    const t = w.addText("Vakitler alınamadı\nİnternete bağlanınca yenilenir");
    t.font = Font.mediumSystemFont(12);
    w.refreshAfterDate = new Date(Date.now() + 15 * 60000);
    return w;
  }
  // Sıradaki vakitte widget kendini yeniler
  const kirmiziAn = d.sonraki.tarih.getTime() - CIKIS_DK * 60000;
  const adaylar = [d.sonraki.tarih.getTime() + 30000, Date.now() + 30 * 60000];
  if (kirmiziAn > Date.now() + 30000) adaylar.push(kirmiziAn + 15000);
  w.refreshAfterDate = new Date(Math.min(...adaylar));

  // ---- Kilit ekranı ----
  if (aile === "accessoryInline") {
    const t = w.addText(d.cikan ? "⏰ " + d.cikan + " çıkıyor · " + d.sonraki.saat : d.sonraki.ikon + " " + d.sonraki.ad + " " + d.sonraki.saat);
    t.font = Font.mediumSystemFont(12);
    return w;
  }
  if (aile === "accessoryCircular") {
    w.addAccessoryWidgetBackground = true;
    const s = w.addStack(); s.layoutVertically(); s.centerAlignContent();
    const a = s.addText(d.sonraki.ad); a.font = Font.boldSystemFont(11); a.centerAlignText();
    const b = s.addText(d.sonraki.saat); b.font = Font.boldRoundedSystemFont(13); b.centerAlignText();
    return w;
  }
  if (aile === "accessoryRectangular") {
    const a = w.addText(d.cikan ? "⏰ " + d.cikan + " vakti çıkıyor" : d.sonraki.ikon + " " + d.sonraki.ad + " · " + d.sonraki.saat);
    a.font = Font.boldSystemFont(13);
    const s = w.addStack(); s.addText("kalan ").font = Font.systemFont(12);
    geriSayim(s, d.sonraki.tarih, 13);
    const c = w.addText("Şu an: " + d.simdiki.ad); c.font = Font.systemFont(11); c.textOpacity = 0.8;
    return w;
  }

  // ---- Ana ekran ----
  w.backgroundGradient = gradyan(d.simdiki.ad);
  if (d.cikan) { const g = new LinearGradient(); g.colors = [new Color("#8f0e17"), new Color("#e0303a")]; g.locations = [0, 1]; g.startPoint = new Point(0, 0); g.endPoint = new Point(1, 1); w.backgroundGradient = g; }
  w.setPadding(14, 14, 12, 14);
  const ust = w.addStack(); ust.centerAlignContent();
  const baslik = ust.addText(d.cikan ? "⏰ " + d.cikan.toLocaleUpperCase("tr-TR") + " VAKTİ ÇIKIYOR" : "ŞU AN · " + d.simdiki.ad.toLocaleUpperCase("tr-TR"));
  baslik.font = Font.boldSystemFont(10); baslik.textColor = new Color("#ffffff", 0.85);
  ust.addSpacer();
  const sh = ust.addText(SEHIR === "Istanbul" ? "İstanbul" : SEHIR.split("/").pop());
  sh.font = Font.mediumSystemFont(10); sh.textColor = new Color("#ffffff", 0.75);

  w.addSpacer(4);
  const ad = w.addText(d.sonraki.ikon + " " + d.sonraki.ad + " " + d.sonraki.saat);
  ad.font = Font.boldSystemFont(aile === "small" ? 17 : 20); ad.textColor = Color.white(); ad.minimumScaleFactor = 0.7;
  const kalan = w.addStack(); kalan.centerAlignContent();
  if (d.cikan) { kalan.backgroundColor = new Color("#ffffff", 0.22); kalan.cornerRadius = 8; kalan.setPadding(3, 8, 3, 8); }
  const k1 = kalan.addText("kalan "); k1.font = Font.mediumSystemFont(13); k1.textColor = new Color("#ffffff", 0.85);
  geriSayim(kalan, d.sonraki.tarih, aile === "small" ? 15 : 17);
  if (d.cikan) { const n = w.addText(d.cikan.toLocaleLowerCase("tr-TR") + " namazını kılmadıysan şimdi kıl"); n.font = Font.semiboldSystemFont(aile === "small" ? 10 : 11); n.textColor = Color.white(); n.minimumScaleFactor = 0.7; }

  if (aile !== "small") {
    w.addSpacer(8);
    const satir = w.addStack(); satir.spacing = 4;
    d.liste.forEach(x => {
      const kutu = satir.addStack(); kutu.layoutVertically(); kutu.centerAlignContent();
      kutu.setPadding(5, 4, 5, 4); kutu.cornerRadius = 8; kutu.size = new Size(0, 0);
      const simdiMi = x.ad === d.simdiki.ad, sonrakiMi = x.ad === d.sonraki.ad;
      kutu.backgroundColor = simdiMi ? Color.white() : new Color("#ffffff", sonrakiMi ? 0.28 : 0.14);
      const renk = simdiMi ? new Color((RENK[x.ad] || RENK["Yatsı"])[0]) : Color.white();
      const a = kutu.addText(x.ad); a.font = Font.mediumSystemFont(9); a.textColor = renk; a.centerAlignText();
      const b = kutu.addText(x.saat); b.font = Font.boldRoundedSystemFont(11); b.textColor = renk; b.centerAlignText();
    });
  } else {
    w.addSpacer();
    const alt = w.addText("Şu an " + d.simdiki.ad + " vakti");
    alt.font = Font.mediumSystemFont(10); alt.textColor = new Color("#ffffff", 0.8);
  }
  return w;
}

const widget = await widgetYap();
if (config.runsInWidget || config.runsInAccessoryWidget) {
  Script.setWidget(widget);
} else {
  await widget.presentMedium();
}
Script.complete();
