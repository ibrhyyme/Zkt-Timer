# SpeedCubeDB algoritma verisi

speedcubedb.com'daki bütün algoritma setleri. 8 bulmaca, 43 set, 6.063 vaka ve 22.377 algoritma var. Trainer formatına çevrildi, cubing.js ile doğrulandı. Sitenin sıralaması korunuyor: setler, alt setler ve vakalar sayfadaki sırayla, alternatifler de oy sırasıyla geliyor.

Bu klasör sadece veriyi içeriyor. Trainer'a entegrasyon ayrı bir iş, aşağıdaki "Entegrasyon notları" bölümüne bakın.

## Dosyalar

| Dosya | İçerik |
|---|---|
| `speedcubedb-algs.json` | `Record<kategori, AlgorithmSubset[]>`, yani `public/trainer/default-algs.json` ile birebir aynı şema (`client/components/trainer/types.ts`). Doğrudan birleştirilebilir. |
| `speedcubedb-manifest.json` | Her kategori için: site seti, URL, bulmaca ve cubing.js tipi, mevcut bir kategorinin yerine geçip geçmediği (`replacesExisting`), sayılar, `setup` kaynağı, notasyon token envanteri (`notationTokens`), boş vakalar ve 1LLL'nin başka kategorilerde kalan sayfaları (`alsoIncludes`). |
| `speedcubedb-validation.json` | Her algoritmanın doğrulama sonucu. Sorunlu olanların listesi `issues` altında. |
| `speedcubedb-raw.json` | Kayıpsız ham dump. Sitedeki yazım olduğu gibi duruyor, ayrıca oy sayısı, movecount (ETM/STM), face moves, YouTube id, altId, vaka görseli verisi (jcube/icube/sqcube/pcube/img), "Standard Alg", setup, filtre sırası ve slot sekmeleri var. Converter'ın attığı ya da normalize ettiği her şeyin aslı burada. |

## Yeniden üretme

```bash
NODE_USE_ENV_PROXY=1 node scripts/scrape-speedcubedb.mjs      # → speedcubedb-raw.json (~6.600 istek)
node scripts/convert-speedcubedb-algs.mjs                      # → speedcubedb-algs.json + manifest
node scripts/validate-speedcubedb-algs.mjs                     # → speedcubedb-validation.json (cubing gerekir)
```

- `NODE_USE_ENV_PROXY=1` sadece HTTPS_PROXY arkasında gerekli. Normal makinede gerekmez.
- Scraper yanıtları `.cache/speedcubedb/` altında gzip olarak tutar. Tekrar çalıştırınca sadece eksik olanları indirir. Taze çekim için klasörü silin.
- `--only 3x3/PLL` ile tek bir set çekilebilir. `--concurrency` ve `--delay` hızı ayarlar, varsayılan 3 paralel istek ve 250 ms aralık.

## Dönüşüm kuralları

- **Ana algoritma (`algorithm`):** Sitenin "Standard Alg" alanı varsa o, yoksa en çok oy alan algoritma. "Standard Alg" sadece PLL ve OLL'de var.
- **Alternatifler (`alternatives`):** Sitedeki bütün alternatifler, oy sırasıyla. Vaka sayfasındaki ilk 4 alternatif ile "More Algorithms" (`category.algs.php`) altındakilerin tamamı alındı. Parantez ve boşluk farkı dışında aynı olan tekrarlar atıldı. Atılanların sayısı manifest'te `duplicatesDropped` alanında.
- **Slot sekmeli vakalar:** F2L, Advanced F2L ve Pyraminx L4E'de her slot ayrı bir giriş oldu, mevcut F2L kategorisindeki gibi `"F2L 1 - Front Right"` biçiminde. Slot sırası sitedeki gibi: Front Right, Front Left, Back Left, Back Right.
- **`setup`:** Site o vaka ve slot için setup veriyorsa sitenin setup'ı, vermiyorsa ana algoritmanın tersi. Site setup'ı sadece her vakanın ilk slotu için veriyor, 2x2, 4x4, 5x5 ve Megaminx için hiç vermiyor. Tersi alınırken Megaminx'te `R2'`'nin tersi `R2` olmadığı gibi, tek katlı bulmacalar ayrıca ele alındı. Kaynak dağılımı manifest'te `setup.fromSite` ve `setup.fromInverse` alanlarında.
- **Notasyon normalizasyonu:** Hepsi anlamı koruyor ve doğrulayıcı aynı küp etkisini kontrol ediyor.
  - `R3` → `R'`, `R3'` → `R`, `R4` silinir. Sebebi trainer'ın `cleanAlgorithmForCubing()` fonksiyonunun 2 dışındaki rakamları silmesi, yoksa `R3` `R` olurdu. Bu toplam 73 algoritmayı etkiledi.
  - 2x2'de iki katmanlı hamleler rotasyona çevrildi: `d2` → `y2`, `d` → `y'`. cubing.js'in 2x2x2'sinde wide hamle yok.
  - `R '` gibi fazladan boşluklu prime kapatıldı.
- **Boş vakalar atıldı.** SQ1 Cube Shape'teki "Square / Square" zaten çözülmüş durum, 1LLL'deki "1LLL 4 63" ve Pyraminx L4E'de 8 ML4E slotunun sitede algoritması yok. Liste manifest'te `emptyCases` alanında.
- **Paylaşılan sayfalar bir kez yazıldı.** Sitede 1LLL; PLL, ZBLL U/L/T/H/Pi/S/AS ve Anti PLL sayfalarını da kendi içinde listeliyor. Bunlar kendi kategorilerinde duruyor, `1LLL` kategorisinde sadece 1LLL'ye ait 48 sayfa var. Tam 1LLL = `1LLL` + `PLL` + `ZBLL` + `Anti PLL`. Bkz. `alsoIncludes`.
- **Kategori anahtarları:** Mevcut `default-algs.json`'da aynı set varsa aynı anahtar kullanıldı (PLL, OLL, F2L, ZBLL, WVLS, `2x2 PBL`, `SQ1 Cube Shape`…), yani birleştirme ekleme değil değiştirme anlamına geliyor. Bulmaca önekleri `getPuzzleType()` ve `getCubeType()` kurallarına uyuyor. Tek istisna Skewb: bkz. entegrasyon notu 4.

## Kategoriler ve doğrulama

Doğrulama sütunu: ok / farklı açıdan başlayan (preAuf + preRotation) / yanlış / parse edilemeyen. "Motorun bozduğu" sütunu, trainer'ın `cleanAlgorithmForCubing()` fonksiyonundan geçince farklı bir algoritmaya ya da parse edilemeyen bir şeye dönüşen algoritma sayısı.

| Kategori | Site seti | Durum | Vaka | Giriş | Algoritma | Doğrulama | Motorun bozduğu |
|---|---|---|---:|---:|---:|---|---:|
| `F2L` | F2L | mevcutun yerine | 41 | 164 | 2319 | 2318 / 0 / 1 / 0 | 0 |
| `Advanced F2L` | Advanced F2L | yeni | 54 | 216 | 908 | 908 / 0 / 0 / 0 | 0 |
| `OLL` | OLL | mevcutun yerine | 57 | 57 | 2061 | 2061 / 0 / 0 / 0 | 0 |
| `PLL` | PLL | mevcutun yerine | 21 | 21 | 1521 | 1518 / 1 / 2 / 0 | 0 |
| `COLL` | COLL | mevcutun yerine | 40 | 40 | 443 | 443 / 0 / 0 / 0 | 0 |
| `WVLS` | Winter Variation | mevcutun yerine | 27 | 27 | 185 | 185 / 0 / 0 / 0 | 0 |
| `CMLL` | CMLL | mevcutun yerine | 42 | 42 | 599 | 598 / 0 / 1 / 0 | 0 |
| `SBLS` | Second Block Last Slot | yeni | 65 | 65 | 311 | 311 / 0 / 0 / 0 | 0 |
| `EO4A` | Edge Orientation (4a) | yeni | 9 | 9 | 60 | 60 / 0 / 0 / 0 | 0 |
| `Anti PLL` | Anti PLL | yeni | 22 | 22 | 122 | 122 / 0 / 0 / 0 | 0 |
| `SV` | Summer Variation | yeni | 27 | 27 | 73 | 72 / 0 / 1 / 0 | 0 |
| `ELL` | Edges of the Last Layer | yeni | 25 | 25 | 278 | 278 / 0 / 0 / 0 | 0 |
| `FRUF` | F &lt;R,U&gt; F' | yeni | 42 | 42 | 124 | sadece parse | 0 |
| `CLS` | Corners Last Slot | yeni | 97 | 97 | 194 | 192 / 1 / 1 / 0 | 0 |
| `1LLL` | 1LLL | yeni | 3400 | 3399 | 4403 | 4399 / 0 / 4 / 0 | 0 |
| `OLLCP` | OLLCP | mevcutun yerine | 342 | 342 | 1392 | 1390 / 0 / 2 / 0 | 0 |
| `VLS` | VLS | yeni | 189 | 189 | 685 | 685 / 0 / 0 / 0 | 0 |
| `ZBLL` | ZBLL | mevcutun yerine | 472 | 472 | 3746 | 3746 / 0 / 0 / 0 | 0 |
| `2x2 Ortega OLL` | Ortega OLL | yeni | 7 | 7 | 63 | 52 / 8 / 3 / 0 | 0 |
| `2x2 PBL` | Ortega PBL | mevcutun yerine | 6 | 6 | 157 | 157 / 0 / 0 / 0 | 0 |
| `2x2 CLL` | CLL | mevcutun yerine | 40 | 40 | 426 | 425 / 0 / 1 / 0 | 0 |
| `2x2 EG1` | EG 1 | mevcutun yerine | 40 | 40 | 176 | 176 / 0 / 0 / 0 | 0 |
| `2x2 EG2` | EG 2 | mevcutun yerine | 40 | 40 | 191 | 191 / 0 / 0 / 0 | 0 |
| `4x4 OLL Parity` | OLL Parity | yeni | 3 | 3 | 45 | 39 / 0 / 0 / 4 | 4 |
| `4x4 PLL Parity` | PLL Parity | mevcutun yerine | 22 | 22 | 137 | 116 / 0 / 0 / 19 | 102 |
| `5x5 L2E` | Last Two Edges | yeni | 13 | 13 | 37 | sadece parse | 6 |
| `5x5 L2C` | Last Two Centers | yeni | 18 | 18 | 40 | 39 / 0 / 1 / 0 | 2 |
| `SQ1 Cube Shape` | Cube Shape | mevcutun yerine | 170 | 169 | 173 | sadece parse | 0 |
| `SQ1 CO` | Corner Orientation | yeni | 7 | 7 | 14 | sadece parse | 0 |
| `SQ1 EO` | Edge Orientation | mevcutun yerine | 7 | 7 | 10 | sadece parse | 0 |
| `SQ1 CP` | Corner Permutation | mevcutun yerine | 8 | 8 | 19 | sadece parse | 0 |
| `SQ1 Parity` | SQ1 Parity | yeni | 5 | 5 | 5 | sadece parse | 0 |
| `SQ1 EP` | Edge Permutation | mevcutun yerine | 49 | 49 | 52 | sadece parse | 0 |
| `SQ1 Lin` | Lin (PLL, Parity PLL, PLL+1) | yeni | 115 | 115 | 115 | sadece parse | 0 |
| `Megaminx EO` | Edge Orientation | yeni | 3 | 3 | 3 | 3 / 0 / 0 / 0 | 0 |
| `Megaminx CO` | Corner Orientation | yeni | 16 | 16 | 32 | 27 / 3 / 2 / 0 | 3 |
| `Megaminx EP` | Edge Permutation | yeni | 5 | 5 | 5 | 5 / 0 / 0 / 0 | 0 |
| `Megaminx CP` | Corner Permutation | yeni | 15 | 15 | 15 | 15 / 0 / 0 / 0 | 5 |
| `Megaminx OLL` | MegaminxOLL | yeni | 178 | 178 | 254 | 237 / 6 / 6 / 5 | 37 |
| `Megaminx PLL` | MegaminxPLL | yeni | 151 | 151 | 203 | 193 / 3 / 4 / 2 | 20 |
| `Pyraminx LL` | Last Layer | mevcutun yerine | 5 | 5 | 16 | 16 / 0 / 0 / 0 | 0 |
| `Pyraminx L4E` | Last 4 Edges | mevcutun yerine | 37 | 95 | 187 | 182 / 0 / 5 / 0 | 0 |
| `Skewb Sarah Advanced` | Sarah's Advanced | yeni | 131 | 131 | 493 | sadece parse (492 parse edilemiyor) | 0 |

**Toplam:** 21.159 algoritma simülasyonda doğrulandı. 22'si doğru ama farklı bir AUF ya da açıdan başlıyor, 34'ü yanlış. Bu yanlışlar sitedeki veri hataları, listesi `speedcubedb-validation.json` dosyasında `status: "wrong"` olarak duruyor.

### Doğrulamanın ne kontrol ettiği

`setup` + algoritma, kategorinin hedefine ulaşıyor mu? Sondaki AUF ve tüm bulmaca rotasyonu serbest. Hedefler `scripts/validate-speedcubedb-algs.mjs` içindeki `GOALS` tablosunda:

- **Tam çözüm:** PLL, ZBLL, 1LLL ve diğerleri.
- **OLL:** F2L çözülmüş ve üst katman çıkartmaları yukarı bakıyor.
- **COLL ve OLLCP:** köşeler çözülmüş, kenarlar yönlenmiş.
- **Roux setleri:** cubing.js'in kendi maskeleri, M katmanı serbest.
- **F2L ve Advanced F2L:** cross bozulmuyor ve çözülmüş slot sayısı en az bir artıyor. Advanced F2L'de site, sıkışmış çifti hangi slot boşsa oraya takan algoritmaları aynı sekmede karışık listeliyor.
- **Pyraminx:** uçlar (tips) hariç tam çözüm.

**Sadece parse edilen setler:**
- FRUF: vakalar F … F' parantezinin ortasından başlıyor, sabit bir hedef yok.
- Square-1: şekil adımları maske ile ifade edilemiyor.
- 5x5 L2E.
- Skewb: Sarah notasyonu.

### Ana algoritması doğrudan çalışmayan 5 giriş

| Kategori | Giriş | Sorun | Öneri |
|---|---|---|---|
| `SV` | SV 7 | Sitenin en çok oy alan algoritması 40 hamlelik bir şaka | İlk geçerli alternatif `R U R'` |
| `CLS` | CLS RFU23 | Site bu vakaya CLS FRU23'ün setup'ını kopyalamış | `setup` olarak algoritmanın tersini kullanın |
| `CLS` | CLS FRU23 | Aynı setup. Algoritma doğru ama küpü başka açıdan tutunca çözüyor | `setup` olarak algoritmanın tersini kullanın |
| `Pyraminx L4E` | Bad Hedge - Front Slot | Sitenin setup'ı ile çözmüyor | `U' L' U' L R U' R' L' U' L` |
| `Pyraminx L4E` | Super Hedge - Front Slot | Sitenin setup'ı ile çözmüyor | `U R' L R L2' U' L` |

## Entegrasyon notları

1. **Mevcut kullanıcılar değiştirilen kategorileri görmez.** `initializeDefaultAlgorithms()` (`client/components/trainer/hooks/useAlgorithmData.ts`) localStorage'a sadece eksik kategorileri ekliyor, var olanları güncellemiyor. Bu yüzden PLL, OLL, ZBLL gibi "mevcutun yerine" geçen 19 kategori, sadece yeni kullanıcılarda yeni veriyle gelir. Bir sürüm ya da migration mekanizması gerekiyor.
2. **Boyut.** Bütün kategoriler minified halde yaklaşık 1,4 MB, mevcut `default-algs.json` ise 430 KB. Hepsi localStorage'a yazılıyor ve localStorage limiti yaklaşık 5 MB. 1LLL tek başına 3.399 giriş tutuyor. Bu set lazy yüklenmeli ya da varsayılan sete hiç girmemeli.
3. **Bulmaca tipi eşlemesi eksik.** `getPuzzleType()` ve `getCubeType()` `Megaminx …`, `5x5 …` ve `Skewb …` öneklerini tanımıyor. Bu kategoriler bugün 3x3x3 olarak işlenir. cubing.js'te `megaminx` ve `5x5x5` var.
4. **Skewb notasyonu uyumsuz.** Site Sarah notasyonu kullanıyor: `H`, `S` makroları, `r`/`b` gibi küçük harfli hamleler, `z` rotasyonları. cubing.js'in skewb'i bunları parse edemiyor (493 algoritmadan 492'si). Mevcut `Sarah Advanced` kategorisi ise cubing.js uyumlu yazılmış. Bu yüzden site seti `Skewb Sarah Advanced` adıyla ayrı tutuldu. Kullanmak için ya notasyonun çevrilmesi ya da çizim ve eşleştirme için ayrı bir yol gerekiyor.
5. **Trainer motoru 4x4/5x5 ve Megaminx notasyonunu bozuyor.** `cleanAlgorithmForCubing()` ve `expandNotation()` `+`, `-`, katman önekleri ve `w` içeren yazımları değiştiriyor. Örnekler: `2R2 U2 2R2 Uw2 2R2 Uw2` → `2 R2 U22 R2 u22 R2 u2`, `3Rw U2` → `r U2`, `R++ D-- U'` → `R D U'`. Etkilenen algoritma sayıları yukarıdaki tabloda. Bu veriyle ilgili değil: mevcut `default-algs.json`'daki `4x4 PLL Parity`'nin 22 ana algoritmasından 18'i de aynı şekilde bozuluyor. Ayrıca mevcut 4x4 PLL Parity setup'ları zaten bozuk, örneğin `u2 R2 u22 R2 U22 R2 2`. cubing.js 4x4'te `M` hamlesini de tanımıyor. Site bu hamleyi 23 algoritmada kullanıyor.
6. **Square-1 yazımı.** Site `1,0 / 3,0` yazıyor, parantez yok. `expandNotation()` `/` içeren dizgileri olduğu gibi bırakıyor, mevcut SQ1 verisi de aynı yazımı kullanıyor. cubing.js'e verirken `(1,0) / (3,0)` biçimine çevirmek gerekiyor, bkz. `toCubingSquare1()`.
7. **Pattern ve setup script'leri.** Birleştirmeden sonra `scripts/generate-*.mjs` (ll-patterns, puzzle-patterns, isometric, ollcp) yeniden çalıştırılmalı. `generate-setup-algorithms.mjs` 3x3 setup'larını Kociemba ile en kısa olanla değiştiriyor. Sitenin kendi setup'ları korunacaksa bu script'in o kategorileri atlaması gerekir.
