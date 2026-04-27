interface IpApiResponse {
	status: 'success' | 'fail';
	countryCode: string;
	country: string;
	regionName: string;
	city: string;
	isp: string;
	org: string;
	proxy: boolean;
	mobile: boolean;
	hosting: boolean;
	timezone: string;
	message?: string;
}

export interface IpDetail {
	ip: string;
	country: string;
	countryCode: string;
	regionName: string;
	city: string;
	isp: string;
	org: string;
	proxy: boolean;
	mobile: boolean;
	hosting: boolean;
	timezone: string;
}

function normalizeIp(ip: string): string {
	// Strip IPv4-mapped IPv6 prefix (::ffff:1.2.3.4 → 1.2.3.4)
	if (ip.startsWith('::ffff:')) {
		return ip.slice(7);
	}
	return ip;
}

const FIELDS = 'status,message,country,countryCode,regionName,city,isp,org,proxy,mobile,hosting,timezone';

export async function getLocationFromIp(ip: string): Promise<{country_iso: string}> {
	const normalized = normalizeIp(ip);
	const url = `http://ip-api.com/json/${encodeURIComponent(normalized)}?fields=${FIELDS}`;

	const response = await fetch(url, {signal: AbortSignal.timeout(5000)});

	if (!response.ok) throw new Error(`ip-api.com status ${response.status}`);

	const data = await response.json() as IpApiResponse;
	if (data.status !== 'success') throw new Error(`ip-api.com: ${data.message || 'unknown'}`);

	return {country_iso: data.countryCode};
}

export async function getIpDetail(ip: string): Promise<IpDetail> {
	const normalized = normalizeIp(ip);
	const url = `http://ip-api.com/json/${encodeURIComponent(normalized)}?fields=${FIELDS}`;

	const response = await fetch(url, {signal: AbortSignal.timeout(5000)});

	if (!response.ok) throw new Error(`ip-api.com status ${response.status}`);

	const data = await response.json() as IpApiResponse;
	if (data.status !== 'success') throw new Error(`ip-api.com: ${data.message || 'unknown'}`);

	return {
		ip: normalized,
		country: data.country,
		countryCode: data.countryCode,
		regionName: data.regionName,
		city: data.city,
		isp: data.isp,
		org: data.org,
		proxy: data.proxy,
		mobile: data.mobile,
		hosting: data.hosting,
		timezone: data.timezone,
	};
}
