/**
 * Pasif birakildi — Timer.scss artik `100dvh` kullaniyor (WebView resize ile senkron).
 * Native Android'de adjustResize + MainActivity'deki WebView IME margin listener
 * surface ile UI senkronizasyonunu sagliyor, bu hook'a artik gerek yok.
 *
 * Eski sorun (klavye kapaninca siyah bosluk) geri donerse, hook'un eski mantigi
 * git history'sinden geri eklenebilir.
 */
export function useStableViewportHeight() {
	// no-op
}
