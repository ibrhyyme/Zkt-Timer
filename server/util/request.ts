// The client IP that every per-IP rate limit keys on.
//
// Never the first X-Forwarded-For entry: the client writes that one. Cloudflare and
// nginx append to an incoming X-Forwarded-For instead of replacing it, so a caller who
// sends a fresh random value on every request gets a fresh rate-limit bucket every time
// (login, signup, forgot password, OTP checks, userSearch...).
//
// Order:
// 1. cf-connecting-ip: set by Cloudflare, overwritten on every request that passes it.
// 2. req.ip: Express resolves it through `trust proxy` (1 hop, server/app.ts), i.e. the
//    address the nearest proxy saw, which the client cannot forge.
// 3. The socket address, for direct connections and non-Express callers.
export function extractIp(req: any): string {
	const cf = req?.headers?.['cf-connecting-ip'];
	const cfIp = Array.isArray(cf) ? cf[0] : cf;
	if (typeof cfIp === 'string' && cfIp.trim()) {
		return cfIp.trim();
	}

	if (typeof req?.ip === 'string' && req.ip.trim()) {
		return req.ip.trim();
	}

	const socketIp = req?.socket?.remoteAddress || req?.connection?.remoteAddress || '';
	return typeof socketIp === 'string' ? socketIp.trim() : '';
}
