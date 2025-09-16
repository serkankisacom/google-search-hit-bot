# 🔥 Google Search Click Bot

Bu proje, **Node.js + Puppeteer-real-browser** kullanarak çoklu thread desteğiyle tarayıcı otomasyonu yapmayı öğretmek için hazırlanmıştır.
İki ana dosyadan oluşur:

* **app.js** → Thread yöneticisi. Belirtilen sayıda botu zamana yayarak çalıştırır.
* **runbrowser.js** → Tek botun davranışlarını yönetir (proxy, cookie, User-Agent seçimi, gezinme, tıklama vb.).

⚠️ **Not:** Proje yalnızca **eğitim ve test** amaçlıdır.
Arama motoru sonuçlarını manipüle etme veya hizmet koşullarını ihlal eden amaçlarla kullanılamaz.

---

## ✨ Özellikler

* 🌍 **Proxy desteği** → `hostname:port:user:pass` formatında (`proxies.txt`)
* 🍪 **Cookie desteği** → `cookies/` klasöründeki `.json` veya `.txt` dosyaları kullanılabilir
* 📱 **User-Agent randomizasyonu** → mobil, tablet, desktop cihaz simülasyonu
* 💻 **Viewport ayarı** → mobil (390x844), tablet (820x1180), desktop (1366x768)
* 🎯 **Domain eşleştirme** → sadece `config.json` içinde belirtilen domainlere tıklar
* 🤖 **İnsansı davranışlar**:

  * Scroll hareketleri
  * Random link tıklamaları
  * Belirlenen süre boyunca sayfa içinde gezinme
* 🔀 **Thread sistemi**:

  * Çoklu bot paralel çalıştırma
  * Thread’leri zamana yayma (ör: 6 saatte 200 thread)
* 📊 **İstatistikler** → başarılı & hatalı thread sayısı anlık konsola yazdırılır

---

## ⚙️ Kurulum

### 1. Repository’i klonla

```bash
git clone https://github.com/serkankisacom/browser-automation-edu.git
cd browser-automation-edu
```

### 2. Bağımlılıkları yükle

```bash
npm install puppeteer-real-browser chalk
```

### 3. Chrome yolunu config’e ekle

`config.json` dosyasına kendi Chrome path’ini yaz:

```json
{
  "domains": ["r10.net"],                 // Hedef domain(ler)
  "maxPages": 5,                          // Google’da taranacak max sayfa
  "keywordsFile": "keywords.txt",         // Anahtar kelimeler listesi
  "cookiesFolder": "cookies",             // Cookie dosyaları
  "proxiesFile": "proxies.txt",           // Proxy listesi
  "headless": false,                      // true → arka planda çalışır
  "threads": 10,                          // Toplam thread
  "browseTime": 60000,                    // Site içinde gezinme süresi (ms)
  "maxClicks": 3,                         // Site içinde yapılacak max tıklama
  "spreadThreads": true,                  // Zamana yayma aktif/pasif
  "timeFrameHours": 6,                    // Thread’ler kaç saate yayılacak
  "executablePath": "C:/Program Files/Google/Chrome/Application/chrome.exe"
}
```

---

## 📑 Kullanım

### 1. Anahtar kelimeler ekle

`keywords.txt` içine her satıra bir arama kelimesi yaz:

```
elithesap
valorant vp satın al
ucuz epin
```

### 2. Cookie ekle

`cookies/` klasörüne `.json` veya `.txt` formatında Google cookie’lerini at.
Bot her çalıştırmada **random cookie** seçer ve bir kez kullanır.

### 3. Proxy ekle (opsiyonel)

`proxies.txt` dosyasına şu formatta ekle:

```
host:port:user:pass
host:port
```

### 4. Çalıştır

```bash
node app.js
```

---

## 🤖 Bot Özellikleri

✅ Google’da verilen `keywords.txt` üzerinden arama yapar
✅ `config.domains` içinde geçen linkleri bulur ve tıklar
✅ Sayfa içinde scroll hareketleri ve random link tıklamaları yapar
✅ `maxPages` kadar Google sonuç sayfasını dolaşır (mobil + desktop buton desteği)
✅ Proxy desteği (hostname\:port\:user\:pass)
✅ Cookie yönetimi → her cookie random seçilir, tekrar kullanılmaz
✅ Thread sistemi → çoklu bot paralel çalışır
✅ `spreadThreads` → thread’leri belirlenen saat aralığına yayar
✅ Başarı/başarısız sayaçları → console’da anlık ilerleme raporu

---

## 📊 Örnek Konsol Çıktısı

```bash
========== THREAD-1 ==========

[THREAD-1] Searching: elithesap
[THREAD-1] Scanning page 1
[THREAD-1] FOUND! Clicking: https://xxx.net
[THREAD-1] Cookie yüklendi: cookie1.txt
[THREAD-1] Finished browsing, closing.

=== Progress: 1 success / 0 fail / 1 launched ===
```

---

## ⚠️ Uyarı

Bu proje **eğitim ve test amaçlıdır**.
Google TOS (Terms of Service) kurallarına aykırı kullanımlardan doğacak sorumluluk **tamamen kullanıcıya aittir**.