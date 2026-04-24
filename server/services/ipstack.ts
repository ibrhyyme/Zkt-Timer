import {logger} from './logger';

interface IfConfig {
	ip: string;
	ip_decimal: number;
	country: string;
	country_iso: string;
	country_eu: boolean;
	latitude: number;
	longitude: number;
	time_zone: number;
	asn: string;
	asn_org: string;
}

function normalizeIp(ip: string): string {
	// Strip IPv4-mapped IPv6 prefix (::ffff:1.2.3.4 → 1.2.3.4)
	if (ip.startsWith('::ffff:')) {
		return ip.slice(7);
	}
	return ip;
}

export async function getLocationFromIp(ip: string): Promise<IfConfig> {
	const normalized = normalizeIp(ip);
	const url = `https://ifconfig.co/json?ip=${encodeURIComponent(normalized)}`;

	const response = await fetch(url, {
		headers: { 'Accept': 'application/json' },
		signal: AbortSignal.timeout(5000),
	});

	if (!response.ok) {
		logger.warn('ifconfig.co returned non-ok status', { ip: normalized, status: response.status });
		throw new Error(`ifconfig.co status ${response.status}`);
	}

	const data = await response.json() as IfConfig;
	return data;
}
