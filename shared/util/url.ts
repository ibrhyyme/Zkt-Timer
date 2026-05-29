// External URL security — reject dangerous protocols like javascript:, data:, file:.
// Only allows http/https URLs. User-provided URLs rendered in the UI with `<a href={...}>`
// (profile bio, social links, etc.) must pass through this function.

const ALLOWED_PROTOCOLS = ['http:', 'https:'];

export function safeExternalUrl(url: string | null | undefined): string | null {
	if (!url || typeof url !== 'string') return null;
	const trimmed = url.trim();
	if (!trimmed) return null;
	try {
		// URL.parse detects dangerous protocols if the input is not alphanumeric
		// (for example "javascript:alert(1)"). Relative URLs (like //evil.com)
		// can be handled by a separate helper that parses with a base and checks origin.
		const parsed = new URL(trimmed);
		if (!ALLOWED_PROTOCOLS.includes(parsed.protocol)) return null;
		return parsed.toString();
	} catch {
		return null;
	}
}
