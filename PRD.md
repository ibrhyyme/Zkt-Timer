# 📱 Zkt-Timer Mobil Dönüşüm Raporu (Capacitor Entegrasyonu)

Bu belge, **Zkt-Timer** projesinin mevcut React altyapısını koruyarak **Capacitor** ile native mobil uygulamaya (Android/iOS) dönüştürülmesi sürecinde yapılan işlemleri, yüklenen paketleri ve kod değişikliklerini içerir.

## 📦 1. Yüklenen Paketler (Dependencies)

Projeye mobil yetenekleri kazandırmak için aşağıdaki npm paketleri eklendi:

| Paket | Amaç |
| :--- | :--- |
| `@capacitor/core` | Native köprü (Bridge) çekirdeği. React ile cihaz donanımı arasındaki iletişim. |
| `@capacitor/cli` | Capacitor komut satırı araçları (`cap sync`, `cap open` vb.). |
| `@capacitor/android` | Android platformu için gerekli native kütüphaneler. |
| `@capacitor/ios` | iOS platformu için gerekli native kütüphaneler. |

**Kurulum Komutu:**
```bash
yarn add @capacitor/core @capacitor/cli @capacitor/android @capacitor/ios
```

## ⚙️ 2. Yapılandırma Dosyaları (Configuration)

### `capacitor.config.ts`
Projenin mobil ayarlarının yapıldığı ana dosyadır.
- **App ID:** `com.zkttimer.app` (Tahmini)
- **App Name:** `Zkt-Timer`
- **Web Dir:** `dist` (React build çıktısının hedefi)
- **Plugins:**
    - `CapacitorHttp`: `{ enabled: true }` (CORS sorunlarını aşmak, native ağ trafiği kullanmak için).
- **Server:**
    - `allowNavigation`: `['zktimer.app', '*.zktimer.app']` (Uygulamanın prodüksiyon sunucusuna erişimine izin verildi).
    - `androidScheme`: `https`

### `android/app/src/main/AndroidManifest.xml`
Android özel izinleri ve ayarları:
- **İzinler:** `<uses-permission android:name="android.permission.INTERNET" />`
- **Trafik İzni:** `android:usesCleartextTraffic="true"` (Bazı ağ kısıtlamalarını esnetmek için eklendi).

## 🛠️ 3. Kod Değişiklikleri (Critical Fixes)

Mevcut web projesinin mobilde "Login Loop" (Giriş Döngüsü) ve "Failed to Fetch" hataları vermemesi için şu dosyalar güncellendi:

### `client/components/api.ts`
- **Native Algılama:** `Capacitor.isNativePlatform()` kontrolü eklendi.
- **Hostname:** Native ortamda `localhost` yerine direkt **`https://zktimer.app`** adresine yönlendirildi.
- **Cookie Injection:** `fetch` fonksiyonu, native ortamda `CapacitorCookies` kullanarak `session` çerezini manuel olarak header'a ekleyecek şekilde sarmalandı (Monkey Patch).

### `client/components/login/login/Login.tsx`
- **Navigasyon:** `window.location.href` (sayfayı sıfırlayan yönlendirme) yerine React Router'ın `history.push()` yöntemi kullanıldı. Bu sayede giriş yaptıktan sonra uygulamanın belleği (state) silinmiyor.

## 🔄 4. İş Akışı ve Senkronizasyon

Projeyi geliştirdikten sonra telefona aktarmak için standart prosedür şudur:

1.  **Web Build Al:**
    React kodlarını (`.tsx`) derleyip `dist` klasörüne çıkarır.
    ```bash
    yarn build
    ```

2.  **Native Sync Yap:**
    `dist` klasöründeki güncel web sitesini Android/iOS projelerinin içine kopyalar ve yeni pluginleri tanıtır.
    ```bash
    npx cap sync
    ```

3.  **Çalıştır:**
    Android Studio'yu açar.
    ```bash
    npx cap open android
    ```

---
*Hazırlayan: Antigravity AI*
