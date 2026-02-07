# Pro Mod Sistemi - Duzeltme Plani

## 1. Sorun

Su anda projede `isPro()` fonksiyonu her zaman `true` donduruyor. Yani bir kullanici uye oldugu anda otomatik olarak "Pro" sayiliyor. Bu yanlis.

**Hedef:**
- Kimse otomatik Pro olmasin. `isPro()` veritabanindaki gercek `is_pro` degerini okusun.
- Tum ozellikler (istatistikler, ayarlar, vb.) herkese acik kalsin - Pro olsun olmasin farketmez.
- Gelecekte eklenecek gercek Pro ozellikleri icin altyapi hazir olsun.

---

## 2. Degistirilecek Dosyalar

### 2.1 Cekirdek Pro Fonksiyonlari

**`server/lib/pro.ts` ve `client/lib/pro.ts`**

Bu iki dosyada ayni fonksiyonlar var ve hepsi hardcode edilmis:

| Fonksiyon | Simdi | Olmasi Gereken |
|---|---|---|
| `isPro(user)` | `return true` | `return user?.is_pro ?? false` |
| `isNotPro(user)` | `return false` | `return !user?.is_pro` |
| `isLoggedInAndPro(user)` | `return !!user` | `return !!user && !!user.is_pro` |
| `isLoggedInAndNotPro(user)` | `return false` | `return !!user && !user.is_pro` |

> `isProEnabled()` ve `usePro()` degismeyecek, zaten dogru calisiyor.

### 2.2 Pro Engellerinin Kaldirilmasi

Bu dosyalardaki Pro kontrolleri kaldirilacak ki ozellikler herkese acik olsun:

**`server/resolvers/Stats.resolver.ts`**
- `if (isProEnabled() && !user.is_pro)` blogu **kaldirilacak**
- `profile_views`, `match_solve_count`, `match_max_win_streak`, `solve_views` herkes icin gercek degerlerle gelecek

**`server/resolvers/Setting.resolver.ts`**
- `beta_tester` icin Pro kontrolu **kaldirilacak**
- Herkes bu ayari degistirebilecek

**`client/components/stats/common/stats_grid/StatsGrid.tsx`**
- `<ProOnly>` sarmalayicisi **kaldirilacak**

**`client/components/stats/common/stat_module/StatModule.tsx`**
- `<ProOnly>` sarmalayicisi **kaldirilacak**

### 2.3 Dokunulmayacak Dosyalar

- `schema.prisma` - `is_pro` alani oldugu gibi kalacak (gelecek icin lazim)
- `schema.graphql` - Degisiklik gerekmez
- `server/util/pro.ts` - Stripe altyapisi, gelecek icin kalacak
- `server/webhooks/stripe.ts` - Gelecek icin kalacak
- `client/components/common/pro_only/ProOnly.tsx` - Bilesen kalacak, gelecekte kullanilacak
- `client/components/common/pro_only/ProOnlyModal.tsx` - Gelecek icin kalacak

---

## 3. Ozet

```
ONCE (Simdi):
  Kullanici uye olur -> isPro() = true -> Herkes "Pro"
  Ozellikler Pro'ya bagli -> Ama herkes zaten Pro -> Sorun gorunmuyor

SONRA (Hedef):
  Kullanici uye olur -> isPro() = false (is_pro veritabaninda false)
  Ozellikler herkese acik (Pro engelleri kaldirildi)
  Gercek Pro ozellikleri eklendiginde isPro() dogru calisiyor olacak
```

---

## 4. Test

1. `is_pro: false` olan bir kullanici ile giris yap
2. Istatistik sayfasinda tum verilerin geldigini dogrula
3. Ayarlardan "Beta Tester" secenegini degistirebildigini dogrula
4. Konsol loglarinda `isPro(user)` cagrildiginda `false` dondugunu teyit et
