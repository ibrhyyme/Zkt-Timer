# Devir notu (yarım kalan işler)

Durum: scraper, converter, validator ve migration script'leri çalışıyor. Hepsi cache'ten yeniden üretilebilir; ağa gerek yok.

## Yapılanlar (son tur)
- `scripts/map-speedcubedb-migration.mjs` yeniden yazıldı. Eşleme sırası: önce metin, sonra vaka (simülasyon), sonra isim.
  - Square-1 metin ve simülasyonla eşleniyor (144x144 `(a,b)` çevirisi).
  - F2L çerçevesi düzeltildi: merkezler yerinde, cross için D çevirileri.
  - 2x2'de U ve D çevirileri hesaba katılıyor.
  - `"null"` anahtar hatası giderildi.
  - Ana algoritması bozuk girişler ilk çalışan alternatifle eşleniyor.
  - `SQ1 EP`, `SQ1 Parity` kategorisinde de aranıyor.
- Sonuç: F2L 164/164. OLL, PLL, COLL, WVLS, CMLL, OLLCP, ZBLL, 2x2, 4x4 PLL Parity ve SQ1 CP'de eşlenmeyen giriş yok. Nothing Placed #2 → Super Hedge doğru.

## Kalan işler
1. Migration'da elle bakılacaklar:
   - **SQ1 EP:** 18 giriş eşlenmedi. Hepsi parite içeren `X & Y` vakaları. Yeni veride karşılığı olmayabilir; elle kontrol edin.
   - **SQ1 EO:** 3 giriş eşlenmedi (Adj/Adj, Adj/Opp, Opp/Adj).
   - **SQ1 Cube Shape:**
     - 5 giriş eşlenmedi; hepsi 5 Slashes'ta, Crown ve 3-2-1 / 4-2 Left vakaları.
     - 4 yeni girişe iki eski giriş eşlendi. Sol ve sağ ayna vakaları aynı anahtara düşüyor; ayna ayrımı eklenmeli.
   - **Pyraminx L4E:**
     - "Upper Edge Flipped #7" eşlenmedi.
     - "Sexy - Front Slot" girişine iki eski giriş eşlendi (Upper Edge Solved #2 ve #3).
   - **OLLCP:** 11 vaka çakışması isimle çözüldü. Doğru görünüyorlar.
2. Pipeline'ı baştan sona yeniden çalıştırıp sayıları teyit edin:
   1. `node scripts/scrape-speedcubedb.mjs --cache-dir <cache>`
   2. `node scripts/convert-speedcubedb-algs.mjs`
   3. `node scripts/validate-speedcubedb-algs.mjs`
   4. `node scripts/map-speedcubedb-migration.mjs`
3. `README.md` içindeki migration sayıları ve iddiaları eski. Bu nota ve `speedcubedb-migration.json`'a göre güncellenmeli.
4. Bilinen veri hataları (sitede):
   - SV 7: ana algoritma şaka; yerine `R U R'`.
   - CLS RFU23/FRU23: setup kopya.
   - 1LLL 2 28 ve 5 42: setup bozuk.
   - Megaminx OLL 17A-: ana algoritma bozuk. 10A+: setup bozuk.
   - Pyraminx Super Hedge: yerine `U R' L R L2' U' L`.
   - Pyraminx Bad Hedge: setup `L' U' L U' L R' L' R`.
5. Trainer motoru `expandNotation` yüzünden 4x4/5x5/Megaminx notasyonunu bozuyor; 423 algoritma etkileniyor. Implement'ten önce motor düzeltilmeli.

## Merge öncesi dikkat
- `data/speedcubedb/*.json` dosyaları main'e girmemeli (GitHub'a yüklenmeyecek). Veriyi lokalden doğrudan sunucuya yükleyin, merge'e yalnızca script'leri ve gerekirse `default-algs.json` değişikliğini alın.
- İş bitince `zkt-server` dalı silinecek.
