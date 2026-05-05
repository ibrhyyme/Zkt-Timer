import {Request, Response, NextFunction} from 'express';
import {logger} from '../services/logger';

// Cross-Site Request Forgery koruma middleware'i.
//
// Mantigi: Tarayicilar form-encoded (text/plain, application/x-www-form-urlencoded,
// multipart/form-data) cross-origin POST'lar icin preflight tetiklemez. Bu yuzden
// klasik CSRF saldirisi bu Content-Type'lardan birini kullanir.
//
// `application/json` ile POST cross-origin tarayicida her zaman preflight gerektirir.
// Preflight'ta `Origin` kontrolu Cloudflare/CORS katmaninda yapilirsa CSRF zaten
// engellenir. Defansif olarak burada da kontrol ediyoruz.
//
// Apollo Client default'ta Content-Type: application/json gonderir.
// graphql-upload (multipart) icin Apollo Upload Client `apollo-require-preflight` header'i ekler.
//
// Native Capacitor app cross-origin sayilir (WKWebView origin'i farkli) ama
// `User-Agent: ZktTimerApp` ile isaretli — `req.isWebView` kontrolu ile gec.
function isCsrfSafe(req: Request): boolean {
	// Capacitor mobile app icin User-Agent suffix kontrolu
	if ((req as any).isWebView) return true;

	const contentType = String(req.headers['content-type'] || '').toLowerCase();

	// JSON body — cross-origin POST'larda preflight zorunlu, CSRF mumkun degil
	if (contentType.includes('application/json')) return true;

	// Apollo Upload Client preflight header
	if (req.headers['apollo-require-preflight']) return true;

	// Eski Apollo upload — operation-name header'i preflight tetikler
	if (req.headers['x-apollo-operation-name']) return true;

	// XMLHttpRequest standard header — form'larla setlenemez
	if (req.headers['x-requested-with']) return true;

	return false;
}

export function requireCsrfHeader(req: Request, res: Response, next: NextFunction) {
	// Sadece state-mutating method'lar
	const method = req.method.toUpperCase();
	if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
		return next();
	}

	if (isCsrfSafe(req)) {
		return next();
	}

	logger.warn('CSRF: blocked request', {
		path: req.path,
		method,
		contentType: req.headers['content-type'] || null,
		origin: req.headers.origin || null,
		referer: req.headers.referer || null,
	});

	res.status(403).json({error: 'CSRF: missing required header or content-type'});
}
