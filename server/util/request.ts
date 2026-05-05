export function extractIp(req: any): string {
	let ip = req?.headers?.['x-forwarded-for'] || req?.connection?.remoteAddress || '';
	if (Array.isArray(ip)) {
		ip = ip[0];
	} else if (typeof ip === 'string' && ip.indexOf(',') > -1) {
		ip = ip.split(',')[0];
	}
	return (ip || '').trim();
}
