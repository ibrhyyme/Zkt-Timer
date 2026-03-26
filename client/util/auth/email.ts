const KNOWN_DOMAINS: string[] = [
	'gmail.com',
	'yahoo.com',
	'hotmail.com',
	'outlook.com',
	'yandex.com',
	'icloud.com',
	'mail.com',
	'protonmail.com',
	'proton.me',
	'aol.com',
	'zoho.com',
	'gmx.com',
	'live.com',
	'msn.com',
	'yahoo.co.uk',
	'hotmail.co.uk',
	'mail.ru',
	'yandex.ru',
];

function normalizeToAscii(str: string): string {
	return str
		.replace(/ı/g, 'i')
		.replace(/İ/g, 'i')
		.replace(/ş/g, 's')
		.replace(/ğ/g, 'g')
		.replace(/ü/g, 'u')
		.replace(/ö/g, 'o')
		.replace(/ç/g, 'c');
}

function levenshtein(a: string, b: string): number {
	const m = a.length;
	const n = b.length;
	const dp: number[] = Array(n + 1);

	for (let j = 0; j <= n; j++) dp[j] = j;

	for (let i = 1; i <= m; i++) {
		let prev = i - 1;
		dp[0] = i;
		for (let j = 1; j <= n; j++) {
			const temp = dp[j];
			dp[j] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dp[j], dp[j - 1]);
			prev = temp;
		}
	}

	return dp[n];
}

export interface EmailSuggestion {
	fullEmail: string;
	suggestedDomain: string;
	originalDomain: string;
	hasInvalidChars: boolean;
}

function findClosestDomain(domain: string): { match: string; distance: number } | null {
	let bestMatch: string | null = null;
	let bestDistance = Infinity;

	for (const known of KNOWN_DOMAINS) {
		const dist = levenshtein(domain, known);
		if (dist < bestDistance) {
			bestDistance = dist;
			bestMatch = known;
		}
	}

	return bestMatch ? { match: bestMatch, distance: bestDistance } : null;
}

export function suggestEmailDomain(email: string): EmailSuggestion | null {
	if (!email || !email.includes('@')) return null;

	const parts = email.split('@');
	if (parts.length !== 2) return null;

	const [localPart, domain] = parts;
	if (!domain || !localPart) return null;

	const lowerDomain = domain.toLowerCase().trim();

	// Exact match — oneri yok
	if (KNOWN_DOMAINS.includes(lowerDomain)) return null;

	// Non-ASCII karakter kontrolu (ı, ş, ğ, ü, ö, ç vb.)
	// Email domain'lerinde ASLA non-ASCII karakter olmamali
	const hasInvalidChars = /[^\x20-\x7E]/.test(lowerDomain);

	if (hasInvalidChars) {
		const normalized = normalizeToAscii(lowerDomain);

		// Normalize sonrasi exact match
		if (KNOWN_DOMAINS.includes(normalized)) {
			return { fullEmail: `${localPart}@${normalized}`, suggestedDomain: normalized, originalDomain: lowerDomain, hasInvalidChars: true };
		}

		// Normalize sonrasi Levenshtein (daha genis threshold: 3)
		const closest = findClosestDomain(normalized);
		if (closest && closest.distance <= 3 && normalized.length >= 4) {
			return { fullEmail: `${localPart}@${closest.match}`, suggestedDomain: closest.match, originalDomain: lowerDomain, hasInvalidChars: true };
		}

		// Non-ASCII var ama yakin domain bulunamadi — yine de uyar
		return { fullEmail: email, suggestedDomain: '', originalDomain: lowerDomain, hasInvalidChars: true };
	}

	// ASCII domain icin standart Levenshtein (threshold: 2)
	const closest = findClosestDomain(lowerDomain);
	if (closest && closest.distance > 0 && closest.distance <= 2 && lowerDomain.length >= 4) {
		return { fullEmail: `${localPart}@${closest.match}`, suggestedDomain: closest.match, originalDomain: lowerDomain, hasInvalidChars: false };
	}

	return null;
}
