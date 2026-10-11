# DockTabs

DockTabs, normal Chrome web sayfalarının kenarında çalışan kalıcı ve ayarlanabilir bir Manifest V3 Web Dock eklentisidir. İlk Side Panel tasarımı paketlenmez; kullanıcı arayüzü yalnızca tek sıralı Web Dock ve ayarlar sayfasından oluşur.

## Kurulum

Gereksinimler: Chrome 114 veya üstü, Node.js 24.14.1 veya üstü ve npm 11.11.0 veya üstü.

```bash
npm install
npm run build
```

Chrome'da `chrome://extensions` sayfasını açın, **Developer mode** seçeneğini etkinleştirin, **Load unpacked** düğmesine basın ve bu projenin `dist/` klasörünü seçin. Araç çubuğundaki DockTabs simgesi ayarlar sayfasını açar. Varsayılan komut macOS'ta `Command+Shift+D`, diğer platformlarda `Ctrl+Shift+D` şeklindedir; `chrome://extensions/shortcuts` üzerinden değiştirilebilir.

## Kullanım

1. DockTabs ayarlarında **Compact Web Dock** seçeneğini açın ve istenen web sitesi erişimini onaylayın.
2. Dock'un yönünü sol, sağ, üst veya alt olarak seçin; ikon boyutunu 28–56 px arasında ayarlayın.
3. Dock'taki `+` düğmesiyle açık sayfayı ekleyin. Site favicon'u bir görüntü verisi olarak kısayolla birlikte `chrome.storage.local` içinde saklanır; sekme, servis çalışanı veya Chrome yeniden başlatıldığında kaybolmaz.
4. İkonları Dock üzerinde sürükleyerek sıralayın. Klavye alternatifi olarak odaktaki ikonu `Option/Alt + ok tuşları` ile taşıyın.
5. `✎` düzenleme modunu açar; kırmızı `−` düğmesi seçilen kısayolu kaldırır. `⚙` ayarlar sayfasını açar.

Bir kısayola tıklamak varsayılan olarak eşleşen açık sekmeyi bulup öne getirir; eşleşme yoksa yeni sekme açar. Bu davranış ve diğer pencerelerde arama ayarlardan değiştirilebilir.

## İçe aktarma ve yedekleme

Vivaldi yer imleri HTML olarak içe aktarılabilir. Klasörler gruplara dönüştürülür, yalnızca güvenli `http/https` kayıtları kabul edilir ve dosya tamamen yerelde işlenir.

**Export JSON backup** tüm sürümlü veriyi indirir. **Import JSON backup** önce özet gösterir ve onaydan sonra mevcut verinin yerini alır. İçe aktarma dosyaları 5 MB ile sınırlıdır.

## İzinler ve güvenlik

- `tabs`: eşleşen sekmeyi bulmak ve etkinleştirmek için.
- `storage`: kısayolları, kalıcı favicon verilerini, grupları ve tercihleri yerel Chrome profilinde saklamak için.
- `favicon`: Chrome'un yerel `_favicon` kaynağından site ikonunu almak için.
- `scripting`: paket içindeki Web Dock kodunu izin verilen normal web sayfalarına yerleştirmek için.

`http://*/*` ve `https://*/*` erişimi yalnızca Web Dock açılırken isteğe bağlı olarak talep edilir; kurulumda verilmez ve Dock kapatıldığında kaldırılır. `sidePanel`, `cookies`, `history`, `webRequest` veya zorunlu host izni yoktur. Telemetri, reklam, uzak kod ya da uygulama sunucusu kullanılmaz. Ayrıntı için [güvenlik notları](docs/SECURITY.md) belgesine bakın.

## Test ve build

```bash
npm run validate
npm run typecheck
npm run lint
npm test
npm run build
```

Build doğrulaması `dist/` paketinde yalnızca gerekli Manifest V3 girişlerinin bulunduğunu, Side Panel tanımı olmadığını, Web Dock scriptinin kendi kendine yeterli olduğunu ve servis çalışanında dinamik kod çalıştırma bulunmadığını kontrol eder.

## Chrome sınırları

- Dock normal `http/https` belgelerinde `document_start` aşamasında, sayfa kaynakları yüklenmeden önce başlatılır. Sunucunun HTML olarak döndürdüğü HTTP 404/500 sayfalarında da çalışır.
- Chrome yeni sekme sayfasına içerik scripti yerleştirmeye izin vermez. Bu yüzden DockTabs yeni sekme sayfasını kendi sayfasıyla (`newtab.html`) değiştirir: her zaman görünen Web Dock, bir arama kutusu ve favorilerin gruplarıyla gösterildiği Launchpad benzeri bir ızgara. Izgaradan ya da yeni sekmedeki Dock'tan bir site açıldığında boş kalan yeni sekme kapanır; penceredeki son sekmeyse açık kalır. Adrese benzeyen girdiler doğrudan açılır, diğerleri Chrome'da seçili varsayılan arama motoruyla aranır (`search` izni, kurulum uyarısı göstermez). Google'ın yeni sekme sayfası bu değişiklik manifest'te sabit olduğu için ayarlardan geri açılamaz; Chrome ilk seferde değişikliği geri alma seçeneği sunar.
- Diğer `chrome://` sayfaları, Chrome Web Store ve Chrome'un ağ/sertifika hata ekranları korumalıdır; içerik scripti yerleştirilemediği için Web Dock bu ekranlarda gösterilemez.
- Tam sayfa gezinmesinde eski belgeyle birlikte Dock kaldırılır ve yeni web belgesi başlarken yeniden kurulur. Bu aralık Web Dock mimarisinde tamamen yok edilemez; sekmeler arasında kesintisiz kalan Chrome yüzeyi Side Panel'dir.
- Bir eklenti Chrome'un yerleşik sekme çubuğunu gizleyemez veya değiştiremez.
- Bu yüzden Ayarlar → Opening → "Dock opens sites as" seçimi Dock'un siteleri nasıl açacağını belirler: **Pinned tab** (varsayılan), **App window** veya **Tab**.
- **App window** modunda Dock kısayolları sekme yerine sekme çubuğu olmayan kendi uygulama penceresinde açılır. Dock'a tekrar tıklamak yeni pencere açmaz, mevcut pencereyi öne getirir veya küçültülmüşse geri açar. Pencere siz kapatana kadar açık kalır. Kısayol–pencere eşlemesi yalnızca `chrome.storage.session` içinde tutulur ve Chrome kapanınca silinir. Chrome'un geri yüklediği uygulama pencereleri ilk tıklamada URL eşleşmesiyle yeniden sahiplenilir.
- **Pinned tab** modunda Dock'tan açılan siteler sabitlenmiş sekme olur; normal pencerelerdeki eşleşen sekme yeniden kullanılırken o da sabitlenir. Uygulama pencereleri sekme modlarında yeniden kullanılmaz, çünkü sabitlenemez ve sekme çubuğu yoktur. Dock bir uygulama penceresinin içinden kullanılsa da yeni sekmeler son kullanılan normal Chrome penceresinde açılır.
- Uygulama penceresinden `target=_blank` ile açılan bağlantılar Chrome'un davranışı gereği normal bir tarayıcı penceresinde sekme olarak açılır.
