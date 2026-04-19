const URL_PATTERNS = [
	/https?:\/\//i,
	/www\./i,
	/\b(?:bit\.ly|t\.me|tinyurl|goo\.gl|ow\.ly|is\.gd|buff\.ly|shorte\.st|adf\.ly)\b/i,
	/\.(?:com|net|org|io|co|tr|ru|de|fr|uk|info|biz|xyz|club|online|site|link)\b/i,
];

const SPAM_KEYWORDS = [
	/\btl\b/i,
	/\busd\b/i,
	/\beur\b/i,
	/\bbtc\b/i,
	/acele\s*et/i,
	/hemen\s*tikla/i,
	/kazan[a-z]*/i,
	/odul[a-z]*/i,
	/\b(?:free|bedava|ucretsiz)\b/i,
	/\b(?:click|tikla)\b/i,
	/[0-9]{3,}[.,]?[0-9]*\s*(?:tl|usd|eur|\$|€|₺)/i,
];

const ALLOWED_NAME_PATTERN = /^[\p{L}][\p{L}\s'\-]{0,29}$/u;

export function validateName(value: string, fieldLabel: string): string | null {
	if (!value || typeof value !== 'string') {
		return `${fieldLabel} zorunlu`;
	}

	const trimmed = value.trim();

	if (trimmed.length < 2) {
		return `${fieldLabel} en az 2 karakter olmali`;
	}

	if (trimmed.length > 30) {
		return `${fieldLabel} 30 karakterden uzun olamaz`;
	}

	if (!ALLOWED_NAME_PATTERN.test(trimmed)) {
		return `${fieldLabel} sadece harf, bosluk, tire ve apostrof icerebilir`;
	}

	for (const pattern of URL_PATTERNS) {
		if (pattern.test(trimmed)) {
			return `${fieldLabel} gecerli bir isim olmali`;
		}
	}

	for (const pattern of SPAM_KEYWORDS) {
		if (pattern.test(trimmed)) {
			return `${fieldLabel} gecerli bir isim olmali`;
		}
	}

	return null;
}
