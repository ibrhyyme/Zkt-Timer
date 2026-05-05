// External URL guvenligi — javascript:, data:, file: gibi tehlikeli protokolleri reddet.
// Sadece http/https URL'lere izin verir. UI'da `<a href={...}>` ile render edilen
// kullanici-saglanan URL'ler (profile bio, social link'leri vs.) bu fonksiyondan gecmeli.

const ALLOWED_PROTOCOLS = ['http:', 'https:'];

export function safeExternalUrl(url: string | null | undefined): string | null {
	if (!url || typeof url !== 'string') return null;
	const trimmed = url.trim();
	if (!trimmed) return null;
	try {
		// URL.parse alfa-numerik degil ise (ornegin "javascript:alert(1)") tehlikeli
		// protokolu tespit eder. Relative URL'leri (//evil.com gibi) base ile parse edip
		// origin kontrolu yapan ayri bir helper'a tasinabilir.
		const parsed = new URL(trimmed);
		if (!ALLOWED_PROTOCOLS.includes(parsed.protocol)) return null;
		return parsed.toString();
	} catch {
		return null;
	}
}
