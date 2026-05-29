import 'ignore-styles';
import 'reflect-metadata';
import express from 'express';
import https from 'https';
import http from 'http';
import fs from 'fs';
import { getPrisma, initPrisma } from './database';
import requestIp from 'request-ip';
import { initLogger, logger } from './services/logger';
import { ApolloServer } from 'apollo-server-express';
import { baseResolvers, baseScalars } from './graphql';
import * as Sentry from '@sentry/node';
import '@sentry/tracing';

import { initLLStates } from '../shared/util/solve/ll_identification';
import { initSocket } from './services/socket';
import 'seedrandom';
import { initMjmlTemplates } from './services/ses';
import { initFirebase } from './services/push';
import GraphQLError from './util/graphql_error';
import colors from 'colors';
import { buildSchema } from 'type-graphql';
import { mergeSchemas } from '@graphql-tools/schema';
import { mapPathToPage } from './router';
import { getMe } from './util/auth';
import * as resolverList from './resolvers/_resolvers';
import * as schemaList from './schemas/_schemas';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import * as models from './api/_index';
import bodyParser from 'body-parser';
import { customAuthChecker } from './middlewares/auth';
import { requireCsrfHeader } from './middlewares/csrf';
import { checkRateLimit } from './services/rate_limit';
import { GraphQLUpload, graphqlUploadExpress } from 'graphql-upload';
import { ErrorCode, ErrorMessage } from './constants/errors';
import { printSchema } from 'graphql';
import depthLimit from 'graphql-depth-limit';
import { getComplexity, simpleEstimator } from 'graphql-query-complexity';
import { initRedisClient } from './services/redis';
import { updateLastSeen } from './services/last_seen';

import { initCronJobs } from './services/cron';
import { initWebhookListeners } from './webhooks';
import { exposeResourcesForSearchEngines } from './middlewares/search_engines';
import { initSearch } from './services/search';
import { getWcaRedirectUri } from '../shared/integration';

initPrisma();

colors.enable();
global.colors = colors;

const port = process.env.PORT || 3000;
const env = process.env.ENV || 'development';
const isDev = env === 'development';

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
BigInt.prototype.toJSON = function () {
	return this.toString();
};

const app = express();
global.app = app;

process.once('SIGUSR2', () => {
	process.kill(process.pid, 'SIGUSR2');
});

process.on('SIGINT', () => {
	process.kill(process.pid, 'SIGINT');
});

// Initialize logging
initSearch();
initLogger();

// IP spoofing korumasi: Cloudflare/Nginx onunde 1 hop guven (cf-connecting-ip kullanilir).
// Bu olmadan saldirgan X-Forwarded-For ile rate limit'i atlatabilir.
app.set('trust proxy', 1);

app.use(compression());

// Body limit: GraphQL + REST icin 5mb yeterli (DoS koruma — onceden 200mb idi).
// IAP webhook payload'lari kucuk, 256kb yeterli. Upload route ayri.
app.use('/api/iap/revenuecat-webhook', bodyParser.json({ limit: '256kb' }));
app.use(bodyParser.json({ limit: '5mb' }));
app.use(cookieParser());

// WebView (mobile app) trafigini organic web trafiginden ayirt et.
// UA suffix capacitor.config.ts'de "ZktTimerApp" olarak ekleniyor.
// CSRF ve cookie sameSite ayrimi bu flag'e bagli — onceden gelmeli.
app.use((req, _res, next) => {
	const ua = req.headers['user-agent'] || '';
	(req as any).isWebView = ua.includes('ZktTimerApp');
	next();
});

// Helmet: HTTP security header'lari (X-Frame-Options, HSTS, X-Content-Type-Options vs.)
// CSP: XSS'e karsi katmanli savunma. SSR inline script (window.__STORE__) icin 'unsafe-inline' zorunlu.
app.use(helmet({
	contentSecurityPolicy: {
		directives: {
			defaultSrc: ["'self'"],
			scriptSrc: [
				"'self'",
				"'unsafe-inline'", // SSR window.__STORE__ + Apollo inline script'leri
				"'unsafe-eval'",   // Apollo Client dev tools, esbuild dynamic
				"https://challenges.cloudflare.com",
				"https://static.cloudflareinsights.com", // Cloudflare Web Analytics (auto-injected)
				"https://plausible.io",
				"https://cdn.jsdelivr.net",
				"https://www.googletagmanager.com",
				"https://www.google-analytics.com",
				"https://googleads.g.doubleclick.net",   // Google Ads conversion tracking
				"https://www.google.com",                 // Google Ads remarketing
			],
			// Inline event handlers (onclick, onload) — eski kod pattern'lerinde mevcut.
			// Long-term: addEventListener ile refactor. Su an 'unsafe-inline' ile gec.
			scriptSrcAttr: ["'unsafe-inline'"],
			styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
			fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
			imgSrc: ["'self'", "data:", "blob:", "https:"],
			connectSrc: [
				"'self'",
				"https://www.worldcubeassociation.org",
				"https://api.revenuecat.com",
				"https://o637154.ingest.sentry.io",
				"https://plausible.io",
				"https://www.google-analytics.com",
				"https://www.google.com",                // Google Ads collect endpoints
				"https://googleads.g.doubleclick.net",
				"https://static.cloudflareinsights.com", // Cloudflare Insights beacon
				"https://firebaseinstallations.googleapis.com", // FCM web push - installation token
				"https://fcmregistrations.googleapis.com",      // FCM web push - registration
				"https://fcm.googleapis.com",                   // FCM legacy endpoint
				"wss:",
				"ws:",
			],
			frameSrc: [
				"'self'",
				"https://challenges.cloudflare.com",
				"https://googleads.g.doubleclick.net",   // Google Ads iframe
			],
			mediaSrc: ["'self'", "blob:"],
			objectSrc: ["'none'"],
			workerSrc: ["'self'", "blob:"],
			upgradeInsecureRequests: [],
		},
	},
	// Capacitor WebView uyumlulugu icin COEP kapali (cross-origin asset'lere izin)
	crossOriginEmbedderPolicy: false,
	// HSTS: production'da Cloudflare zaten ekliyor, defansif olarak burada da
	hsts: {maxAge: 31536000, includeSubDomains: true, preload: true},
}));

// CSRF korumasi: state-mutating method'lar icin Content-Type/header check
// JSON body veya apollo-require-preflight zorunlu — form-based saldirilari engeller
app.use(requireCsrfHeader);

app.use((req, res, next) => {
	function logIfError() {
		if (res.statusCode >= 400 && res.statusCode < 500) {
			logger.warn('client_error', {
				method: req.method,
				path: req.path,
				status: res.statusCode,
				referer: req.headers.referer || null,
				ua: req.headers['user-agent']?.substring(0, 120),
				isWebView: !!(req as any).isWebView,
				ip: requestIp.getClientIp(req),
			});
		}
	}

	const originalSend = res.send.bind(res);
	res.send = function (body) {
		logIfError();
		return originalSend(body);
	};

	const originalSendFile = res.sendFile.bind(res);
	res.sendFile = function (filePath: string, ...args: any[]) {
		logIfError();
		return (originalSendFile as any)(filePath, ...args);
	};

	next();
});

initWebhookListeners();
exposeResourcesForSearchEngines();

app.use((req, res, next) => {
	req.headers.origin = req.headers.origin || req.headers.host;
	next();
});

app.get('/.well-known/apple-app-site-association', (req, res) => {
	res.setHeader('Content-Type', 'application/json');
	res.sendFile('apple-app-site-association', {root: `${__dirname}/../public/.well-known`});
});

app.get('/.well-known/assetlinks.json', (req, res) => {
	res.setHeader('Content-Type', 'application/json');
	res.setHeader('Cache-Control', 'public, max-age=86400');
	res.sendFile('assetlinks.json', {root: `${__dirname}/../public/.well-known`});
});

app.get(['/favicon.ico', '/apple-touch-icon.png', '/apple-touch-icon-precomposed.png'], (_req, res) => {
	res.setHeader('Cache-Control', 'public, max-age=2592000, immutable');
	res.sendFile('apple-touch-icon.png', {root: `${__dirname}/../public/images`});
});

app.get('/app-ads.txt', (_req, res) => {
	res.setHeader('Cache-Control', 'public, max-age=86400');
	res.type('text/plain').send('');
});

app.get('/.well-known/passkey-endpoints', (_req, res) => {
	res.setHeader('Cache-Control', 'public, max-age=86400');
	res.json({endpoints: []});
});

app.get(['/security.txt', '/.well-known/security.txt'], (_req, res) => {
	res.setHeader('Cache-Control', 'public, max-age=86400');
	res.type('text/plain').send(
		`Contact: mailto:contact@zktimer.app\nExpires: 2027-12-31T23:59:59.000Z\nPreferred-Languages: tr, en\nCanonical: https://zktimer.app/.well-known/security.txt\n`
	);
});

// JS/CSS dosyalari deployment hash'li → uzun sureli cache guvenli
app.use('/dist', express.static(`${__dirname}/../dist`, { maxAge: '1y', immutable: true }));

// /public — image/font dosyalarina 30g cache (LCP icin onemli), digerleri 1g
const longLivedAssetRegex = /\.(png|jpg|jpeg|svg|webp|avif|ico|woff2?|ttf|otf)$/i;
const publicStaticOptions = {
	maxAge: '1d',
	setHeaders: (res: any, filePath: string) => {
		if (longLivedAssetRegex.test(filePath)) {
			res.setHeader('Cache-Control', 'public, max-age=2592000, immutable');
		}
	},
};
app.use('/public', express.static(`${__dirname}/../public`, publicStaticOptions));
app.use(express.static(`${__dirname}/../public`, { ...publicStaticOptions, index: false, redirect: false }));
app.use('/public/uploads', express.static(`${__dirname}/../public/uploads`, { maxAge: '1d' }));

mapPathToPage();

const gqlTypes: any[] = [];
const gqlQueries: any[] = [];
const gqlMutations: any[] = [];
let gqlMutationActions = {};
let gqlQueryActions = {};

function parseList(l: { [key: string]: any }) {
	const modelKeys = [...Object.keys(l)];

	for (const key of modelKeys) {
		const model = l[key];

		if (!model.gqlType && !model.gqlQuery && !model.gqlMutation && !model.queryActions && !model.mutateActions) {
			parseList(model);
			continue;
		}

		gqlTypes.push(model.gqlType || '');
		gqlQueries.push(model.gqlQuery || '');
		gqlMutations.push(model.gqlMutation || '');
		gqlMutationActions = {
			...gqlMutationActions,
			...(model.mutateActions || {})
		};
		gqlQueryActions = {
			...gqlQueryActions,
			...(model.queryActions || {})
		};
	}
}

parseList(models);

process.on('SIGINT', () => process.exit(1));
process.on('SIGTERM', () => process.exit());

app.set('port', port);

global.siteUrl = process.env.BASE_URI;

if (!isDev) {
	Sentry.init({
		dsn: 'https://2f30d529a6b242449dc1f86ec18c1ba3@o637154.ingest.sentry.io/5770453',
		release: process.env.RELEASE_NAME,
		tracesSampleRate: 1.0,
		environment: env,
		beforeSend(event) {
			// PII / hassas header'lari Sentry'ye gonderme
			if (event.request?.headers) {
				delete event.request.headers['cookie'];
				delete event.request.headers['authorization'];
				delete event.request.headers['x-csrf-token'];
				delete event.request.headers['cf-connecting-ip'];
			}
			// Body icinde sifre/token varsa redact et
			if (event.request?.data) {
				const data: any = event.request.data;
				for (const key of Object.keys(data || {})) {
					const lower = key.toLowerCase();
					if (lower.includes('password') || lower.includes('token') || lower.includes('secret')) {
						data[key] = '[REDACTED]';
					}
				}
			}
			// Extra context icinde de redact
			if (event.extra) {
				for (const key of Object.keys(event.extra)) {
					const lower = key.toLowerCase();
					if (lower.includes('password') || lower.includes('secret') || lower.includes('token')) {
						event.extra[key] = '[REDACTED]';
					}
				}
			}
			return event;
		},
	});
}

(async () => {
	// TODO remove eventually
	const oldTypeDef = `
		${baseScalars}
		${gqlTypes.join('\n')}
		
		type Query { ${gqlQueries.join('\n')} }
		type Mutation { ${gqlMutations.join('\n')} }
	`;

	const oldResolver = {
		...baseResolvers,
		Upload: GraphQLUpload,
		Query: { ...gqlQueryActions },
		Mutation: { ...gqlMutationActions }
	};

	const newSchema = await buildSchema({
		resolvers: Object.values(resolverList) as any,
		orphanedTypes: Object.values(schemaList) as any,
		authChecker: customAuthChecker,
		nullableByDefault: true,
		validate: {
			forbidUnknownValues: false
		}
	});

	const mergedSchema = mergeSchemas({
		schemas: [newSchema],
		typeDefs: oldTypeDef,
		resolvers: oldResolver
	});

	// GraphQL DoS korumasi: 11 derinlikten daha derin query'leri reddet,
	// query complexity 1500 puanin uzerine ciktiginda reddet
	const MAX_QUERY_DEPTH = 11;
	const MAX_QUERY_COMPLEXITY = 1500;

	// Start server
	let server: any = new ApolloServer({
		uploads: false,
		schema: mergedSchema,
		playground: isDev,
		introspection: isDev, // Production'da API harita cikarmayi engelle
		validationRules: [depthLimit(MAX_QUERY_DEPTH)],
		plugins: [
			{
				requestDidStart: () => ({
					didResolveOperation({request, document}: any) {
						try {
							const complexity = getComplexity({
								schema: mergedSchema,
								operationName: request.operationName,
								query: document,
								variables: request.variables,
								estimators: [simpleEstimator({defaultComplexity: 1})],
							});
							if (complexity > MAX_QUERY_COMPLEXITY) {
								throw new GraphQLError(
									ErrorCode.BAD_INPUT,
									`Query too complex: ${complexity} (max ${MAX_QUERY_COMPLEXITY})`
								);
							}
						} catch (err) {
							if (err instanceof GraphQLError) throw err;
							// Complexity hesaplama hatasi — sessizce gec, validation degil
						}
					},
				}),
			},
		],
		formatError: (err: any) => {
			if (isDev) return err;
			// Production: stack trace ve internal detay sizdirmasin, Sentry'ye gonder
			const code = err?.extensions?.code;
			if (code === 'INTERNAL_SERVER_ERROR' || !code) {
				try { Sentry.captureException(err); } catch { /* ignore */ }
				return {
					message: 'Internal server error',
					extensions: { code: 'INTERNAL_SERVER_ERROR' },
				};
			}
			// Beklenen hatalar (BAD_INPUT, FORBIDDEN, NOT_FOUND vs.) kullaniciya iletilir,
			// stack trace temizlenir
			return {
				message: err.message,
				extensions: { code },
				path: err.path,
			};
		},
		context: async ({ req, res }) => {
			const user = await getMe(req);
			const ipAddress = requestIp.getClientIp(req);

			if (user && (user.banned_until || user.banned_forever)) {
				throw new GraphQLError(ErrorCode.FORBIDDEN, ErrorMessage.BANNED);
			}

			if (user?.id) {
				updateLastSeen(user.id);
			}

			return { user, ipAddress, req, res, prisma: getPrisma() };
		}
	});

	const path = '/graphql';

	// Destek talebi ekleri icin: 30MB / 4 dosya. Profil resmi + diger upload'lar da bu sinirlara dahil.
	app.use(graphqlUploadExpress({ maxFileSize: 30 * 1024 * 1024, maxFiles: 4 }));
	server.applyMiddleware({ app, path });

	// Setup code
	initLLStates();
	initMjmlTemplates();
	initFirebase();

	// Log WCA environment variables presence for debugging
	console.log('WCA env present:', {
		id: !!process.env.WCA_CLIENT_ID,
		secret: !!process.env.WCA_CLIENT_SECRET,
		redirect: getWcaRedirectUri(),
	});

	if (isDev) {
		const schemaStr = printSchema(mergedSchema);
		fs.writeFile('schema.graphql', schemaStr, (err) => {
			if (err) {
				logger.error('Error writing GraphQL schema to file', {
					error: err
				});
			}
		});
	}

	if (isDev && process.env.HTTPS === 'true') {
		const options = {
			key: fs.readFileSync('./certs/server.key'),
			cert: fs.readFileSync('./certs/server.cert')
		};

		server = https.createServer(options, app);
		server.listen(port, () => console.info(`Listening on port ${port}!`.magenta));
	} else {
		// eslint-disable-next-line @typescript-eslint/ban-ts-comment
		// @ts-ignore
		server = http.Server(app);
		server.listen(port, () => console.info(`Listening on port ${port}!`.magenta));
	}

	// Initiate services
	try {
		await initRedisClient();
		initCronJobs();
		initSocket(server);
	} catch (e) {
		logger.error('Could not initiate critical service', {
			error: e
		});
	}
})();

// Admin REST endpoint rate limit helper — admin token sizmasi veya bot abuse'a karsi
async function checkAdminEndpointRateLimit(adminId: string, endpoint: string, res: any): Promise<boolean> {
	const rl = await checkRateLimit(`admin:${endpoint}:${adminId}`, 1, 300); // 5 dk'da 1 istek
	if (!rl.allowed) {
		res.status(429).json({error: 'Rate limit: bu admin endpoint 5 dk icinde tekrar tetiklenemez'});
		return false;
	}
	return true;
}

// Admin: Tum WCA bagli kullanicilarin Kinch + SoR skorlarini yeniden hesapla
app.post('/api/admin/recalculate-rankings', async (req, res) => {
	const {getMe} = require('./util/auth');
	const {recalculateAllRankings} = require('./models/ranking');

	try {
		const me = await getMe(req);
		if (!me || !me.admin) {
			res.status(403).json({error: 'Forbidden'});
			return;
		}

		if (!(await checkAdminEndpointRateLimit(me.id, 'recalc-rankings', res))) return;

		recalculateAllRankings().then(() => {
			console.log('[Rankings] All rankings recalculated via API');
		}).catch((err: any) => {
			console.error('[Rankings] Recalculation failed:', err);
		});

		res.json({success: true, message: 'Ranking recalculation started'});
	} catch (err) {
		console.error('[Rankings] API error:', err);
		res.status(500).json({error: 'Internal server error'});
	}
});

// Admin: Sitemap'i manuel yeniden olustur (cron 2 saatte bir, acelen varsa buradan tetikle)
// Query param ?force=1 → ENV check'i ve Redis lock'u bypass et (debug icin)
app.post('/api/admin/regenerate-sitemap', async (req, res) => {
	const {getMe} = require('./util/auth');
	const {initSiteMapGeneration} = require('./services/sitemap');
	const force = req.query.force === '1';

	try {
		const me = await getMe(req);
		if (!me || !me.admin) {
			res.status(403).json({error: 'Forbidden'});
			return;
		}

		if (!(await checkAdminEndpointRateLimit(me.id, 'regen-sitemap', res))) return;

		try {
			const result = await initSiteMapGeneration({force});
			console.log('[Sitemap] Manual regeneration result:', result);
			res.json({success: true, result});
		} catch (err: any) {
			console.error('[Sitemap] Manual regeneration failed:', err);
			// Stack trace prod'da sizdirma — sadece message
			res.status(500).json({error: err?.message || 'unknown'});
		}
	} catch (err) {
		console.error('[Sitemap] API error:', err);
		res.status(500).json({error: 'Internal server error'});
	}
});

// Admin: Dunya rekorlarini Robin WCA REST API'dan yeniden senkronize et
app.post('/api/admin/sync-world-records', async (req, res) => {
	const {getMe} = require('./util/auth');
	const {syncAllWorldRecords} = require('./services/WorldRecordSyncService');

	try {
		const me = await getMe(req);
		if (!me || !me.admin) {
			res.status(403).json({error: 'Forbidden'});
			return;
		}

		if (!(await checkAdminEndpointRateLimit(me.id, 'sync-wr', res))) return;

		syncAllWorldRecords().then((result: any) => {
			console.log(`[WRSync] Manual sync done. Updated: ${result.updated}, Failed: ${result.failed}`);
		}).catch((err: any) => {
			console.error('[WRSync] Manual sync failed:', err);
		});

		res.json({success: true, message: 'World record sync started'});
	} catch (err) {
		console.error('[WRSync] API error:', err);
		res.status(500).json({error: 'Internal server error'});
	}
});

// RevenueCat webhook — in-app purchase eventleri
import { revenueCatWebhookHandler } from './api/revenuecat_webhook';
app.post('/api/iap/revenuecat-webhook', revenueCatWebhookHandler);

// IAP sync — restore/satin alma sonrasi anlık RevenueCat sorgulama
import { iapSyncHandler } from './api/iap_sync';
app.post('/api/iap/sync', iapSyncHandler);

// Cache-busting: Capacitor ve web istemciler güncel versiyonu kontrol eder
app.get('/api/version', (req, res) => {
	res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
	res.json({ version: process.env.RELEASE_NAME || '1.0' });
});

app.use((req, res, next) => {
	if (req.path.startsWith('/graphql')) {
		return next();
	}

	res.status(404).sendFile(`${__dirname}/resources/not_found.html`);
});
