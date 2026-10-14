# SpeedCubeDB algoritma verisi

speedcubedb.com'daki bütün algoritma setleri trainer formatına çevrildi ve cubing.js ile doğrulandı:

- **Kapsam:** 8 bulmaca, 43 set, 6.063 vaka.
- **Sitenin gösterdiği algoritmalar:** 22.377. Birebir tekrarlar atıldıktan sonra `speedcubedb-algs.json` dosyasında 22.285 algoritma kaldı.
- **Hiçbir yerde gösterilmeyen alternatifler:** Sitenin sayfalama mantığı yüzünden en az 843 alternatif ne sayfada ne de "More Algorithms" yanıtında görünüyor (bkz. "Erişilemeyen alternatifler").
- **Sıra:** Setler sitedeki sırayla, vakalar sayfadaki sırayla, alternatifler oy sırasıyla.

Bu klasör sadece veriyi içeriyor. Trainer'a entegrasyon ayrı bir iş, aşağıdaki "Entegrasyon notları" bölümüne bakın.

## Dosyalar

| Dosya | İçerik |
|---|---|
| `speedcubedb-algs.json` | `Record<kategori, AlgorithmSubset[]>`, yani `public/trainer/default-algs.json` ile birebir aynı şema (`client/components/trainer/types.ts`). Girişlerde sadece `name`, `algorithm`, `alternatives` ve `setup` alanları var. |
| `speedcubedb-sources.json` | Her girişin raw dump'taki kaynağı. `sources[kategori][altSetIndex][girişIndex] = [sayfa anahtarı, vaka index'i, slot index'i]`. Oy sayısı, hamle sayısı ya da sitenin çizimi gibi bilgiler raw'dan bununla bulunur. |
| `speedcubedb-manifest.json` | Kategori başına: site seti, URL, bulmaca ve cubing.js tipi, `replacesExisting`, `overlapsExisting`, sayılar, setup kaynağı, yapılan notasyon dönüşümleri (`rewrites`), yeniden adlandırılan girişler (`renamedDuplicates`), erişilemeyen alternatif sayısı, boş vakalar, 1LLL'nin başka kategorilerde kalan sayfaları (`alsoIncludes`), notasyon token envanteri. |
| `speedcubedb-validation.json` | Kategori başına sayılar ve sorunlu her algoritma ile girişin listesi (`issues`). `legend` alanı her durumu açıklıyor. |
| `speedcubedb-migration.json` | Değiştirilen 19 kategorideki her eski girişin yeni karşılığı. Kullanıcı istatistiklerini taşımak için gerekli, bkz. entegrasyon notu 1. |
| `speedcubedb-raw.json` | Sitenin gösterdiği her şey, sitenin yazımıyla. Oy sayısı, movecount (ETM/STM), face moves, YouTube id, altId, vaka çizimi verisi, "Standard Alg", setup, filtre sırası, slot sekmeleri ve `unreachableAtLeast` burada. |

## Yeniden üretme

```bash
NODE_USE_ENV_PROXY=1 node scripts/scrape-speedcubedb.mjs      # → speedcubedb-raw.json (~6.650 istek)
node scripts/convert-speedcubedb-algs.mjs                      # → algs + manifest + sources
node scripts/validate-speedcubedb-algs.mjs                     # → validation (cubing paketi gerekir)
node scripts/map-speedcubedb-migration.mjs                     # → migration (cubing paketi gerekir)
```

- `NODE_USE_ENV_PROXY=1` sadece HTTPS_PROXY arkasında gerekli. Normal makinede gerekmez.
- Yanıtlar doğrulanıp `.cache/speedcubedb/` altında gzip olarak tutuluyor. Tekrar çalıştırınca sadece eksik olanlar iniyor. Taze çekim için klasörü silin.
- Tek set çekmek için `--only 3x3/PLL --out <dosya>` kullanın. `--out` olmadan reddedilir, böylece tam dump'ın üzerine yazılmaz. Büyük setlerde üst setin id'si verilir (`3x3/ZBLL`), alt sayfanın id'si (`3x3/ZBLLT`) verilmez.
- Hız ayarı: `--concurrency` ve `--delay`. Varsayılan 3 paralel istek ve 250 ms aralık.

## Dönüşüm kuralları

- **Sıra:**
  - Alt setler, ilk vakalarının sayfada göründüğü sırayla gelir. Vakalar alt set içinde sayfa sırasını korur.
  - Sayfanın alt grupları karışık dizdiği setlerde (OLL, PLL, F2L, Advanced F2L, CLS) gruplama genel sırayı değiştiriyor. Başka hiçbir şey sırayı değiştirmiyor.
- **Ana algoritma (`algorithm`):** Sitenin "Standard Alg" alanı varsa o, yoksa en çok oy alan algoritma. "Standard Alg" sadece PLL ve OLL'de var. 5 girişte "Standard Alg" sitenin listesinde birebir yer almıyor.
- **Alternatifler (`alternatives`):** Sitenin gösterdiği diğer bütün algoritmalar, oy sırasıyla. Parantez ve boşluk farkı dışında aynı olan 96 tekrar atıldı (manifest'te `duplicatesDropped`).
- **Slot sekmeli vakalar:** F2L, Advanced F2L ve Pyraminx L4E'de her slot ayrı giriş oldu, mevcut F2L kategorisindeki gibi `"F2L 1 - Front Right"` biçiminde. Slot sırası sitedeki gibi: Front Right, Front Left, Back Left, Back Right.
- **İsimler kategori içinde benzersiz.** Site bazı farklı vakalara aynı ismi veriyor: SQ1 Lin PLL+1'de 17 isim, SQ1 Cube Shape'te 1, Megaminx PLL'de `N2-`. Tekrarlar sayfa sırasıyla `" (2)"`, `" (3)"` ekini aldı, toplam 21 yeniden adlandırma oldu (`renamedDuplicates`). İsim ve alt set adlarındaki fazla boşluklar temizlendi.
- **`setup`:**
  - Site o vaka ve slot için setup veriyorsa sitenin setup'ı kullanıldı. Bu 5.373 girişte geçerli.
  - Vermiyorsa ana algoritmanın tersi kullanıldı. Bu 1.031 girişte geçerli.
  - Site setup'ı sadece her vakanın ilk slotu için veriyor. 2x2, 4x4, 5x5, Megaminx ve Skewb için hiç vermiyor.
  - Tersi alınırken tur sayısı 4 olmayan bulmacalar ayrıca ele alındı: Megaminx'te ve Pyraminx/Skewb'de `R2` kendi tersi değil, tersi `R2'`.
- **Notasyon dönüşümleri:** Hepsi anlamı koruyor ve hepsi cubing.js ile aynı küp etkisini veriyor. Toplam 331 algoritmayı etkiledi. Raw dump sitenin yazımını koruyor.

  | Dönüşüm | Örnek | Sayı | Neden |
  |---|---|---:|---|
  | Tur sayısı | `R3` → `R'`, `R3'` → `R`, `R4` silinir | 73 | Trainer 2 dışındaki rakamları siliyor, `R3`'ü `R` okurdu |
  | 3x3 geniş hamle | `Rw` → `r` | 36 | `expandNotation()` `w`'yi siliyor, `Rw`'yi `R` okurdu |
  | 2x2 iki katman | `d2` → `y2`, `Rw` → `x` | 5 | cubing.js 2x2x2'de geniş hamle yok |
  | Square-1 boşluğu | `/3,0/-1,1` → `/ 3,0 / -1,1` | 216 | Desen üreticisi boşluğa göre bölüyor, bitişik yazımı çözülmüş durum sanıyordu |
  | Prime boşluğu | `R '` → `R'` | 1 | Sitede yazım hatası |
  | Grup tekrarı | `(R U R')3` → üç kopya | 0 | Şu an veride yok, ileride tekrar çekim için |
- **Boş vakalar atıldı:**
  - SQ1 Cube Shape'teki "Square / Square" zaten çözülmüş durum.
  - 1LLL'deki "1LLL 4 63" için sitede algoritma yok.
  - Pyraminx L4E'de 8 ML4E slotunun sitede algoritması yok.
  - Liste manifest'te `emptyCases` alanında.
- **Paylaşılan sayfalar bir kez yazıldı.** Sitede 1LLL; PLL, ZBLL U/L/T/H/Pi/S/AS ve Anti PLL sayfalarını da kendi içinde listeliyor. Bunlar kendi kategorilerinde duruyor, `1LLL` kategorisinde sadece 1LLL'ye ait 49 sayfa var. Tam 1LLL = `1LLL` + `PLL` + `ZBLL` + `Anti PLL` (bkz. `alsoIncludes`).
- **Kategori anahtarları:** Mevcut `default-algs.json`'da aynı set varsa aynı anahtar kullanıldı. 19 kategori bu durumda: PLL, OLL, F2L, ZBLL, WVLS, `2x2 PBL`, `SQ1 Cube Shape` ve diğerleri. Bunlarda birleştirme ekleme değil değiştirme anlamına geliyor. İki istisna var:
  - **`EO4A`:** mevcut `L6E-EO` ile aynı Roux adımı, ama vakaları farklı bölüyor (9'a karşı 11).
  - **`Skewb Sarah Advanced`:** mevcut `Sarah Advanced` ile aynı set ama farklı notasyonda (bkz. not 5). Mevcut kategorinin üzerine yazmasın diye ayrı tutuldu.

## Erişilemeyen alternatifler

Site bir vakanın ilk 4 algoritmasını sayfada gösteriyor. "More Algorithms" butonunun çağırdığı `category.algs.php` ise geri kalan her şeyi değil, kendi sıralamasındaki ilk 4 dışındaki her şeyi döndürüyor. Bu sıralama oy sayısı azalan, eşitlikte altId azalan şekilde.

Sayfa oy eşitliğini farklı bozduğunda, uç noktanın ilk 4'üne girip sayfada görünmeyen algoritmalar ne sayfada ne de "More" yanıtında çıkıyor. Bu 684 vakada (slot bazında) en az 843 algoritmayı etkiliyor.

- **Hangi algoritmalar:** Hepsi o vakada sayfanın gösterdiği 4. algoritmayla aynı oy sayısına sahip. 629'u 0 oylu, 152'si 1 oylu, 35'i 2 oylu, sadece 9'u 5 ve üzeri oylu. Bu yüzden yüksek oylu algoritmaların hepsi elimizde.
- **Bunları neden alamıyoruz:** Sitenin başka bir uç noktası tam listeyi vermiyor. Practice (`timerdata.ajax.php`) vaka başına sadece 5 algoritma veriyor. Arama tamamen tarayıcı tarafında çalışıyor.
- **Nerede kayıtlı:** Etkilenen her slot raw'da `unreachableAtLeast` taşıyor. Kategori toplamı manifest'te `unreachableAlternatives` alanında. En çok etkilenenler: ZBLL 202, OLLCP 126, Advanced F2L 72, VLS 72, Skewb 71, F2L 61.

## Doğrulama

`scripts/validate-speedcubedb-algs.mjs` her giriş ve her algoritma için cubing.js simülasyonu çalıştırıyor.

**Giriş kontrolleri (setup gerçekten o vaka mı?):**
- **Başlangıç kontrolü:** Setup durumu kategorinin geçerli bir başlangıcı mı? Örneğin PLL için yönlenmiş bir son katman, OLL için çözülmüş F2L, ZBLL için yönlenmiş kenarlar, F2L için sağlam cross. Kontrol renkten bağımsız (son katman herhangi bir yüz olabilir) ve son katmanın AUF'una izin veriyor. Sonuç: 5.401 girişin 5.397'si geçti.
- **Çizim kontrolü:** Setup durumu sitenin kendi çizimiyle (raw'daki jcube sticker verisi) birebir aynı mı? Ana algoritmanın sonda yazmadığı AUF'a, küpün nasıl tutulduğuna ve üst katman çevirisine izin var. Bu kontrol 3x3, 2x2, 4x4 ve 5x5'te yapılıyor. Sonuç: 4.815 girişin 4.810'u geçti.
- **"Doğrulanamadı":** Setup ana algoritmanın tersiyse ve bu iki kontrolün hiçbiri uygulanamıyorsa, ana algoritma kendi tersini çözdüğü için bu hiçbir şey kanıtlamaz. Bu yüzden sonuç "doğrulanamadı" olarak sayılıyor, toplam 105 ana algoritma. Kalan sayılar: Pyraminx L4E 72, 5x5 L2C 18, 2x2 PBL 6, Pyraminx LL 4, 2x2 EG 3, Megaminx OLL 2.

**Algoritma kontrolleri:**
- **Parse:** Algoritma cubing.js ile o bulmacada parse ediliyor mu?
- **Çözüm:** Setup + algoritma kategorinin hedefine ulaşıyor mu? Hedefler `GOALS` tablosunda; örneğin PLL için tam çözüm, OLL için F2L + üst yüz yönlenmesi. Sondaki AUF'a ve rotasyona izin var. Çözmüyorsa öne AUF, rotasyon ya da ikisi birden eklenerek denenir. Böyle çözen algoritma doğru ama farklı açıdan başlıyor demektir ("farklı açıdan"). Yine çözmüyorsa sonuç "yanlış".
- **Motor kontrolü:** Trainer her algoritmayı önce `expandNotation()`, sonra `cleanAlgorithmForCubing()` fonksiyonundan geçiriyor. Bu iki adımdan sonra algoritma farklı bir şey yapıyorsa ya da parse edilemiyorsa "motorun bozduğu" sayılıyor.

**Sadece parse edilen setler:**
- FRUF: vakalar F … F' parantezinin ortasından başlıyor, sabit bir hedef yok.
- Square-1.
- 5x5 L2E.
- Skewb: Sarah notasyonu.

| Kategori | Site seti | Durum | Vaka | Giriş | Algoritma | Doğru | Doğrulanamadı | Farklı açıdan | Yanlış | Parse edilemiyor | Sadece parse | Başlangıç | Çizim | Motorun bozduğu |
|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| `F2L` | F2L | mevcutun yerine | 41 | 164 | 2319 | 2318 | 0 | 0 | 1 | 0 | 0 | 164/164 | – | 0 |
| `Advanced F2L` | Advanced F2L | yeni | 54 | 216 | 907 | 907 | 0 | 0 | 0 | 0 | 0 | 216/216 | – | 0 |
| `OLL` | OLL | mevcutun yerine | 57 | 57 | 2060 | 2060 | 0 | 0 | 0 | 0 | 0 | 57/57 | 57/57 | 0 |
| `PLL` | PLL | mevcutun yerine | 21 | 21 | 1517 | 1515 | 0 | 1 | 1 | 0 | 0 | 21/21 | 21/21 | 0 |
| `COLL` | COLL | mevcutun yerine | 40 | 40 | 443 | 443 | 0 | 0 | 0 | 0 | 0 | 40/40 | 40/40 | 0 |
| `WVLS` | Winter Variation | mevcutun yerine | 27 | 27 | 184 | 184 | 0 | 0 | 0 | 0 | 0 | – | 27/27 | 0 |
| `CMLL` | CMLL | mevcutun yerine | 42 | 42 | 599 | 598 | 0 | 1 | 0 | 0 | 0 | 42/42 | 42/42 | 0 |
| `SBLS` | Second Block Last Slot | yeni | 65 | 65 | 311 | 311 | 0 | 0 | 0 | 0 | 0 | 65/65 | – | 0 |
| `EO4A` | Edge Orientation (4a) | yeni (`L6E-EO` ile örtüşür) | 9 | 9 | 60 | 60 | 0 | 0 | 0 | 0 | 0 | 9/9 | – | 0 |
| `Anti PLL` | Anti PLL | yeni | 22 | 22 | 122 | 122 | 0 | 0 | 0 | 0 | 0 | 22/22 | 22/22 | 0 |
| `SV` | Summer Variation | yeni | 27 | 27 | 73 | 72 | 0 | 0 | 1 | 0 | 0 | – | 27/27 | 0 |
| `ELL` | Edges of the Last Layer (ELL) | yeni | 25 | 25 | 278 | 278 | 0 | 0 | 0 | 0 | 0 | 25/25 | 25/25 | 0 |
| `FRUF` | F &lt;R,U&gt; F' | yeni | 42 | 42 | 124 | 0 | 0 | 0 | 0 | 0 | 124 | – | – | 0 |
| `CLS` | Corners Last Slot (CLS) | yeni | 97 | 97 | 194 | 192 | 0 | 1 | 1 | 0 | 0 | 97/97 | – | 0 |
| `1LLL` | 1LLL | yeni | 3400 | 3399 | 4403 | 4403 | 0 | 0 | 0 | 0 | 0 | 3397/3399 | 3399/3399 | 0 |
| `OLLCP` | OLLCP | mevcutun yerine | 342 | 342 | 1392 | 1392 | 0 | 0 | 0 | 0 | 0 | 342/342 | 342/342 | 0 |
| `VLS` | VLS | yeni | 189 | 189 | 685 | 685 | 0 | 0 | 0 | 0 | 0 | – | 189/189 | 0 |
| `ZBLL` | ZBLL | mevcutun yerine | 472 | 472 | 3746 | 3746 | 0 | 0 | 0 | 0 | 0 | 472/472 | 472/472 | 0 |
| `2x2 Ortega OLL` | Ortega OLL | yeni | 7 | 7 | 63 | 52 | 0 | 8 | 3 | 0 | 0 | – | 7/7 | 0 |
| `2x2 PBL` | Ortega PBL | mevcutun yerine | 6 | 6 | 157 | 142 | 6 | 9 | 0 | 0 | 0 | – | – | 0 |
| `2x2 CLL` | CLL | mevcutun yerine | 40 | 40 | 426 | 424 | 0 | 1 | 1 | 0 | 0 | 40/40 | 40/40 | 0 |
| `2x2 EG1` | EG 1 | mevcutun yerine | 40 | 40 | 176 | 171 | 1 | 0 | 4 | 0 | 0 | – | 39/40 | 0 |
| `2x2 EG2` | EG 2 | mevcutun yerine | 40 | 40 | 191 | 188 | 2 | 1 | 0 | 0 | 0 | – | 38/40 | 0 |
| `4x4 OLL Parity` | OLL Parity | yeni | 3 | 3 | 45 | 41 | 0 | 0 | 0 | 4 | 0 | 3/3 | 1/3 | 33 |
| `4x4 PLL Parity` | PLL Parity | mevcutun yerine | 22 | 22 | 137 | 117 | 0 | 1 | 0 | 19 | 0 | 22/22 | 22/22 | 127 |
| `5x5 L2E` | Last Two Edges | yeni | 13 | 13 | 37 | 0 | 0 | 0 | 0 | 0 | 37 | – | – | 29 |
| `5x5 L2C` | Last Two Centers | yeni | 18 | 18 | 40 | 21 | 18 | 0 | 1 | 0 | 0 | – | – | 32 |
| `SQ1 Cube Shape` | Cube Shape | mevcutun yerine | 170 | 169 | 173 | 0 | 0 | 0 | 0 | 0 | 173 | – | – | 0 |
| `SQ1 CO` | Corner Orientation (CO) | yeni | 7 | 7 | 14 | 0 | 0 | 0 | 0 | 0 | 14 | – | – | 0 |
| `SQ1 EO` | Edge Orientation (EO) | mevcutun yerine | 7 | 7 | 10 | 0 | 0 | 0 | 0 | 0 | 10 | – | – | 0 |
| `SQ1 CP` | Corner Permutation (CP) | mevcutun yerine | 8 | 8 | 19 | 0 | 0 | 0 | 0 | 0 | 19 | – | – | 0 |
| `SQ1 Parity` | SQ1 Parity | yeni | 5 | 5 | 5 | 0 | 0 | 0 | 0 | 0 | 5 | – | – | 0 |
| `SQ1 EP` | Edge Permutation (EP) | mevcutun yerine | 49 | 49 | 52 | 0 | 0 | 0 | 0 | 0 | 52 | – | – | 0 |
| `SQ1 Lin` | Lin | yeni | 115 | 115 | 115 | 0 | 0 | 0 | 0 | 0 | 115 | – | – | 0 |
| `Megaminx EO` | Megaminx Edge Orientation | yeni | 3 | 3 | 3 | 3 | 0 | 0 | 0 | 0 | 0 | 3/3 | – | 0 |
| `Megaminx CO` | Megaminx Corner Orientation | yeni | 16 | 16 | 32 | 28 | 0 | 3 | 1 | 0 | 0 | 16/16 | – | 3 |
| `Megaminx EP` | Megaminx Edge Permutation | yeni | 5 | 5 | 5 | 5 | 0 | 0 | 0 | 0 | 0 | 5/5 | – | 0 |
| `Megaminx CP` | Megaminx Corner Permutation | yeni | 15 | 15 | 15 | 15 | 0 | 0 | 0 | 0 | 0 | 15/15 | – | 5 |
| `Megaminx OLL` | MegaminxOLL | yeni | 178 | 178 | 254 | 236 | 2 | 6 | 5 | 5 | 0 | 173/175 | – | 38 |
| `Megaminx PLL` | MegaminxPLL | yeni | 151 | 151 | 203 | 198 | 0 | 3 | 0 | 2 | 0 | 151/151 | – | 22 |
| `Pyraminx LL` | Last Layer | mevcutun yerine | 5 | 5 | 16 | 12 | 4 | 0 | 0 | 0 | 0 | – | – | 0 |
| `Pyraminx L4E` | Last 4 Edges | mevcutun yerine | 37 | 95 | 187 | 110 | 72 | 0 | 5 | 0 | 0 | – | – | 0 |
| `Skewb Sarah Advanced` | Sarah's Advanced | yeni (`Sarah Advanced` ile örtüşür) | 131 | 131 | 493 | 0 | 0 | 0 | 0 | 492 | 1 | – | – | 134 |

**Toplam:**
- 21.049 algoritma doğru.
- 105 ana algoritma doğrulanamadı.
- 35 algoritma doğru ama farklı açıdan başlıyor.
- 24 algoritma yanlış.
- 522 algoritma parse edilemiyor: Skewb 492, 4x4 `M` hamlesi 23, Megaminx `x`/`y` rotasyonu ve yazım hataları 7.
- 550 algoritma sadece parse edildi.

Her tekil bulgu `speedcubedb-validation.json` dosyasındaki `issues` listesinde.

### Elle bakılması gereken girişler

| Kategori | Giriş | Sorun | Öneri (validation dosyasında da var) |
|---|---|---|---|
| `SV` | SV 7 | Sitenin en çok oy alan algoritması 40 hamlelik bir şaka | Ana algoritma yerine ilk doğru alternatif: `R U R'` |
| `CLS` | CLS RFU23 | Site bu vakaya CLS FRU23'ün setup'ını kopyalamış, ana algoritma çözmüyor | `setup` olarak algoritmanın tersini kullanın |
| `CLS` | CLS FRU23 | Aynı kopya setup. Algoritma doğru ama küpü başka açıdan tutunca çözüyor | `setup` olarak algoritmanın tersini kullanın |
| `1LLL` | 1LLL 2 28, 1LLL 5 42 | Setup'ları (ve sitenin çizimi) F2L'i bozuyor. Bu vakalar sitede bozuk | Kategoriden çıkarın ya da elle düzeltin |
| `Megaminx OLL` | 17A- | Ana algoritma bozuk, iki alternatif kendi aralarında tutarlı | Önerilen setup: `F R U' R' U2' R U2 R' U' F'` |
| `Megaminx OLL` | 10A+ | Setup F2L'i bozuyor, başka algoritması yok | Elle düzeltin |
| `Pyraminx L4E` | Super Hedge - Front Slot | Ana algoritma sitenin setup'ıyla çözmüyor | İlk doğru alternatif: `U R' L R L2' U' L` |
| `Pyraminx L4E` | Bad Hedge - Front Slot | Sitenin setup'ı 4 algoritmanın sadece 1'iyle uyuşuyor | Ana algoritmayı koruyup setup'ı değiştirin: `L' U' L U' L R' L' R` |
| `2x2 EG1`, `2x2 EG2`, `4x4 OLL Parity` | EG1 AS 1, EG2 T 1, EG2 U 2, Pure, M | Setup algoritmalarla uyumlu ama sitenin çizimi başka bir açıyı ya da varyantı gösteriyor | Çizimle eşleşen setup validation dosyasında (`suggestedSetup`) |

## Migration (eski girişler → yeni girişler)

`speedcubedb-migration.json`, değiştirilen her kategoride her eski girişi yeni karşılığına bağlıyor.

**Eşleme yöntemi:**
- Eşleme isimle değil vakanın kendisiyle yapılıyor. İki girişin ana algoritmalarının tersi alınıyor ve ortaya çıkan vakalar kategorinin hedefinin baktığı yerlerden karşılaştırılıyor: PLL için bütün sticker'lar, OLL için hangi sticker'ın yukarı baktığı ve köşelerin hangi yöne döndüğü, F2L için slotun iki parçasının yeri. Karşılaştırmada önceki ve sonraki AUF ile küpün nasıl tutulduğu fark etmiyor.
- **Çakışmalar:** Simetrik OLLCP vakalarında site aynı vakayı farklı açılardan ayrı giriş olarak listeliyor. Eski F2L verisinde ise `d` farklı anlamda yazılmış. Bu ikisinde bir yeni giriş birden fazla eskiye eşleşiyor. Böyle durumlarda isimle eşleme tercih edildi ve giriş `caseConflict` ile işaretlendi.
- **Square-1** sadece isimle eşlenebildi.

**Her eşleşmede:**
- Eski ve yeni girişin `statsId` değeri: trainer'ın kişisel istatistikleri sakladığı `algToId(expandNotation(ana algoritma))` id'si.
- `customAltKey`: `kategori::altset::isim`.
- `sameName` ve `sameStatsId` alanları.

| Kategori | Eski giriş | Durumla eşleşen | İsimle eşleşen | Eşleşmeyen | İsmi değişen | İstatistik id'si değişen |
|---|---:|---:|---:|---:|---:|---:|
| `F2L` | 164 | 149 | 15 | 0 | 0 | 31 |
| `OLL` | 57 | 57 | 0 | 0 | 0 | 54 |
| `PLL` | 21 | 21 | 0 | 0 | 21 | 20 |
| `COLL` | 40 | 40 | 0 | 0 | 0 | 23 |
| `WVLS` | 27 | 26 | 1 | 0 | 0 | 5 |
| `CMLL` | 42 | 42 | 0 | 0 | 16 | 8 |
| `OLLCP` | 342 | 318 | 24 | 0 | 0 | 242 |
| `ZBLL` | 472 | 472 | 0 | 0 | 472 | 389 |
| `2x2 PBL` | 6 | 5 | 1 | 0 | 4 | 4 |
| `2x2 CLL` | 40 | 40 | 0 | 0 | 0 | 26 |
| `2x2 EG1` | 40 | 39 | 1 | 0 | 0 | 23 |
| `2x2 EG2` | 40 | 40 | 0 | 0 | 0 | 18 |
| `4x4 PLL Parity` | 22 | 20 | 2 | 0 | 0 | 8 |
| `SQ1 Cube Shape` | 169 | 0 | 77 | 92 | 28 | 0 |
| `SQ1 EO` | 7 | 0 | 0 | 7 | 0 | 0 |
| `SQ1 CP` | 8 | 0 | 8 | 0 | 0 | 5 |
| `SQ1 EP` | 40 | 0 | 0 | 40 | 0 | 0 |
| `Pyraminx LL` | 5 | 5 | 0 | 0 | 4 | 5 |
| `Pyraminx L4E` | 35 | 34 | 0 | 1 | 33 | 26 |

**Toplam:**
- 1.577 eski girişin 1.437'si eşleşti: 1.308'i durumla, 129'u isimle.
- 578 girişin ismi değişiyor.
- 887 girişin istatistik id'si değişiyor.
- 140 giriş eşleşmedi: 139'u Square-1, 1'i eski Pyraminx L4E verisindeki bir kopya.

## Entegrasyon notları

1. **Değiştirilen kategoriler kullanıcı verisini kopartıyor.** Trainer kullanıcı verisini isimle ve algoritma metniyle saklıyor:
   - Kişisel istatistikler (en iyi süre, son süreler, öğrenme durumu, hata sayısı): `trainer_Best-` / `LastTimes-` / `Learned-` / `FailCount-` + `algToId(expandNotation(alg))` (`useAlgorithmData.ts:72-188`).
   - Özel alternatifler: `kategori::altset::isim` (`useAlgorithmData.ts:338`).
   - Sunucudaki alternatifler: `(kategori, case_name)` (`server/resolvers/TrainerAlternative.resolver.ts:25`).
   - OLLCP doğruluk ve süreleri: varyant algoritmasının id'si (`OllTrainView.tsx:113,127,204`).

   Setup, alternatif, sıfırlama ve PDF aramaları da kullanıcının kayıtlı verisine değil, yeni gelen `default-algs.json` dosyasına isimle bakıyor (`TrainingArea.tsx:88`, `AlternativesPicker.tsx:40`, `AlgorithmDetailModal.tsx`). Migration olmadan eski kullanıcılarda 718 girişin setup'ı ve alternatifleri kaybolur (eski isim yeni dosyada yok), 1.360 girişin sıfırlama ve PDF alternatifleri kaybolur (eski alt set + isim çifti yeni dosyada yok). Bu yüzden migration veriyle aynı sürümde çıkmalı ve `speedcubedb-migration.json` kullanılarak localStorage anahtarları ve sunucu kayıtları yeniden adlandırılmalı. `generate-ollcp-trainer-data.mjs` yeniden çalışırsa OLLCP varyant id'leri de değişir.
2. **Boyut ve yükleme.**
   - Bütün kategoriler minified halde 1,38 MB. Mevcut `default-algs.json` minified halde 334 KB. Hepsi localStorage'a yazılıyor ve limit yaklaşık 5 MB.
   - 1LLL tek başına 3.399 giriş tutuyor.
   - `initializeDefaultAlgorithms()` (`useAlgorithmData.ts:38-63`) eksik kategorileri ekliyor ve `default-algs.json`'da olmayan kayıtlı kategorileri siliyor. Setup ve alternatif aramaları da sadece o dosyaya bakıyor. Bir kategoriyi varsayılan setin dışında tutup lazy yüklemek istiyorsanız, bu temizlik adımı ve bu aramalar için de ayrı bir kaynak gerekir.
3. **Bulmaca tipi eşlemesi eksik.**
   - `getPuzzleType()` (`algorithm_engine.ts:262`) ve `getCubeType()` (`AlgorithmSelector.tsx:23`) sadece `2x2`, `4x4`, `Pyraminx` ve `SQ1` öneklerini tanıyor. `Megaminx …` (6 kategori), `5x5 …` (2) ve `Skewb Sarah Advanced` bugün 3x3x3 olarak işlenir.
   - Roux setleri `SBLS` ve `EO4A` için `CATEGORY_CUBE_TYPE` içinde `'3x3 Roux'` eşlemesi gerekiyor. Site bunları Roux olarak etiketliyor.
4. **Trainer motoru 4x4/5x5 ve Megaminx notasyonunu bozuyor.** Trainer önce `expandNotation()` (`useAlgorithmData.ts:416,439`), sonra `cleanAlgorithmForCubing()` (`TrainingArea.tsx:58`) çalıştırıyor. `expandNotation()` `RLFBUDMESrlfbudxyz2()'` dışındaki her karakteri siliyor. Örnekler:

   | Girdi | Trainer'ın okuduğu |
   |---|---|
   | `2R2 U2 2R2 Uw2 2R2 Uw2` | `2 R2 U22 R2 U22 R2 U2` |
   | `Rw U Rw'` (4x4/5x5) | `R U R'` |
   | `R' F R BR'` (Megaminx) | `R' F R B R'` |

   Etkilenen sayılar tabloda: 4x4 160, 5x5 61, Megaminx 68. Bu veriye özgü bir sorun değil, mevcut `4x4 PLL Parity` de aynı şekilde bozuluyor ve mevcut 4x4 PLL Parity setup'ları zaten bozuk (`u2 R2 u22 R2 U22 R2 2`). 3x3 setlerinde etkilenen algoritma kalmadı, `Rw` → `r` dönüşümü bunu çözdü. cubing.js 4x4'te `M` hamlesini de tanımıyor, site bu hamleyi 23 algoritmada kullanıyor.
5. **Skewb notasyonu uyumsuz.** Site Sarah notasyonu kullanıyor:
   - `H`, `S` makroları ve küçük harfli `r`, `b`, `l` hamleleri cubing.js skewb'inde parse edilemiyor. 493 algoritmadan 492'si bu durumda. `x`/`y`/`z` rotasyonları ise parse ediliyor.
   - Trainer'ın metin temizliği 134 algoritmayı değiştiriyor. Örneğin `H z H z H` → `z z`.
   - Mevcut `Sarah Advanced` kategorisi cubing.js uyumlu yazılmış. Bu set kullanılacaksa ya notasyon çevrilmeli ya da çizim ve eşleştirme için ayrı bir yol gerekir.
6. **Megaminx yüz isimleri.**
   - Site `DR` (bazen `dR`) diye F ve R'ye değen alt yüzü kastediyor, cubing.js buna `FR` diyor. `bL` ve `Br`, `BL` ve `BR`'nin yazım varyantları. Doğrulayıcı bu eşlemeyi uyguluyor (`toCubingMegaminx()`), veride site yazımı korunuyor. Trainer'a Megaminx eklenirse aynı eşleme gerekir.
   - cubing.js megaminx'te `x`/`y` rotasyonu yok.
   - Sitede iki yazım hatası var: `is` ve `y2'R`.
7. **Square-1.** Site `1,0 / 3,0` yazıyor, parantez yok. `expandNotation()` `/` içeren dizgileri olduğu gibi bırakıyor, mevcut SQ1 verisi de aynı yazımı kullanıyor. Converter her `/` etrafına boşluk koydu. cubing.js'e verirken `(1,0) / (3,0)` biçimine çevirmek gerekiyor (`toCubingSquare1()`).
8. **Script'ler ve hard-coded listeler.**
   - `generate-setup-algorithms.mjs` iki listedeki her kategorinin setup'ını değiştiriyor: `CATEGORIES_3X3` (satır 41, Kociemba) ve `CATEGORIES_NON_3X3` (satır 48, `cleanAlgorithm()` sonrası düz ters). Bu listeler yeni veride 2x2 CLL/EG1/EG2/PBL, 4x4 PLL Parity, Pyraminx LL/L4E ve SQ1 Cube Shape/CP/EO/EP'yi kapsıyor. Script 4x4 notasyonunu bozuyor ve 22 4x4 PLL Parity setup'ının 19'unu kırıyor. Pyraminx'te `X2`'yi kendi tersi sayıyor, bu yanlış. Sitenin setup'larını da üzerine yazıyor. SpeedCubeDB kategorileri bu listelerden çıkarılmalı ya da script zaten setup'ı olan girişleri atlamalı.
   - Desen üreticileri sadece hard-coded listelerdeki kategorileri işliyor: `LL_CATEGORIES` (`generate-ll-patterns.mjs:75`), `CATEGORY_CONFIG` (`generate-puzzle-patterns.mjs:513`), `ISOMETRIC_CATEGORIES` (`generate-isometric-patterns.mjs:314`). Anti PLL, ELL, 1LLL, VLS, Megaminx, 2x2 Ortega OLL, 4x4 OLL Parity, SQ1 CO/Parity/Lin gibi yeni kategoriler bu listelere eklenmezse kartlar 3D görünüme düşer.
