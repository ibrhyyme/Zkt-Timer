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
import cors from 'cors';
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
import { initRedisClient, createRedisKey, RedisNamespace, setKeyInRedis, getValueFromRedis, deleteKeyInRedis } from './services/redis';
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

// IP spoofing protection: Trust 1 hop in front of Cloudflare/Nginx (cf-connecting-ip is used).
// Without this, an attacker could bypass rate limiting with X-Forwarded-For.
app.set('trust proxy', 1);

app.use(compression());

// Body limit: 5MB is sufficient for GraphQL + REST (DoS protection — previously 200MB).
// IAP webhook payloads are small, 256KB is enough. Upload route is separate.
app.use('/api/iap/revenuecat-webhook', bodyParser.json({ limit: '256kb' }));
app.use(bodyParser.json({ limit: '5mb' }));
app.use(cookieParser());

// Distinguish WebView (mobile app) traffic from organic web traffic.
// UA suffix is added as "ZktTimerApp" in capacitor.config.ts.
// CSRF and cookie sameSite differentiation depend on this flag — should arrive first.
app.use((req, _res, next) => {
	const ua = req.headers['user-agent'] || '';
	(req as any).isWebView = ua.includes('ZktTimerApp');
	next();
});

// CORS: the native local-bundle app (Faz 2) calls the API cross-origin from
// capacitor://localhost (iOS) / https://localhost (Android). Same allowlist as
// Socket.IO (services/socket.ts). Must be mounted BEFORE the origin-fallback shim
// below (which fabricates origin from host) and before CSRF so OPTIONS preflights
// are answered here. Same-origin web requests carry no Origin header cross-check
// and are unaffected.
const ALLOWED_HTTP_ORIGINS = [
	'https://zktimer.app',
	'https://www.zktimer.app',
	'capacitor://localhost',
	'http://localhost',
	'https://localhost',
	'ionic://localhost',
];
app.use(cors({
	origin: (origin, callback) => {
		// No Origin header (same-origin navigations, curl, server-to-server) → allow
		if (!origin) return callback(null, true);
		// Dev: allow any origin (localhost:3000 web dev, device testing over LAN)
		if (isDev) return callback(null, true);
		return callback(null, ALLOWED_HTTP_ORIGINS.includes(origin));
	},
	credentials: true,
	exposedHeaders: ['X-Session-Token'],
	allowedHeaders: [
		'Content-Type',
		'Authorization',
		'Apollo-Require-Preflight',
		'X-Apollo-Operation-Name',
		'X-Requested-With',
	],
	methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
}));

// Helmet: HTTP security headers (X-Frame-Options, HSTS, X-Content-Type-Options, etc.)
// CSP: Layered defense against XSS. SSR inline script (window.__STORE__) requires 'unsafe-inline'.
app.use(helmet({
	contentSecurityPolicy: {
		directives: {
			defaultSrc: ["'self'"],
			scriptSrc: [
				"'self'",
				"'unsafe-inline'", // SSR window.__STORE__ + Apollo inline scripts
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
			// Inline event handlers (onclick, onload) — present in legacy code patterns.
			// Long-term: refactor to addEventListener. For now, allow via 'unsafe-inline'.
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
				"https://www.openstreetmap.org",          // ZKT competition venue map embed
			],
			mediaSrc: ["'self'", "blob:"],
			objectSrc: ["'none'"],
			workerSrc: ["'self'", "blob:"],
			upgradeInsecureRequests: [],
		},
	},
	// Capacitor WebView compatibility: disable COEP (allow cross-origin assets)
	crossOriginEmbedderPolicy: false,
	// Local-bundle native app (Faz 2) loads /public/uploads images cross-origin;
	// helmet's default CORP 'same-origin' would block them in the WebView.
	crossOriginResourcePolicy: {policy: 'cross-origin'},
	// HSTS: production already has it via Cloudflare, defensively added here too
	hsts: {maxAge: 31536000, includeSubDomains: true, preload: true},
}));

// CSRF protection: state-mutating methods require Content-Type/header check
// JSON body or apollo-require-preflight mandatory — prevents form-based attacks
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

// JS/CSS files with deployment hash → safe for long-term caching
app.use('/dist', express.static(`${__dirname}/../dist`, { maxAge: '1y', immutable: true }));

// /public — 30-day cache for image/font files (important for LCP), 1-day for others
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
			// Don't send PII / sensitive headers to Sentry
			if (event.request?.headers) {
				delete event.request.headers['cookie'];
				delete event.request.headers['authorization'];
				delete event.request.headers['x-csrf-token'];
				delete event.request.headers['cf-connecting-ip'];
			}
			// Redact password/token in body if present
			if (event.request?.data) {
				const data: any = event.request.data;
				for (const key of Object.keys(data || {})) {
					const lower = key.toLowerCase();
					if (lower.includes('password') || lower.includes('token') || lower.includes('secret')) {
						data[key] = '[REDACTED]';
					}
				}
			}
			// Also redact in extra context
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

	// GraphQL DoS protection: reject queries deeper than 11 levels,
	// reject if query complexity exceeds 1500 points
	const MAX_QUERY_DEPTH = 11;
	const MAX_QUERY_COMPLEXITY = 1500;

	// Start server
	let server: any = new ApolloServer({
		uploads: false,
		schema: mergedSchema,
		playground: isDev,
		introspection: isDev, // Block API schema discovery in production
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
							// Complexity calculation error — silently continue, not validation
						}
					},
				}),
			},
		],
		formatError: (err: any) => {
			if (isDev) return err;
			// Production: don't leak stack traces and internal details, send to Sentry
			const code = err?.extensions?.code;
			if (code === 'INTERNAL_SERVER_ERROR' || !code) {
				try { Sentry.captureException(err); } catch { /* ignore */ }
				return {
					message: 'Internal server error',
					extensions: { code: 'INTERNAL_SERVER_ERROR' },
				};
			}
			// Expected errors (BAD_INPUT, FORBIDDEN, NOT_FOUND, etc.) are delivered to user,
			// stack trace cleaned up
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

	// Support ticket attachments: 30MB / 4 files. Profile picture + other uploads also count toward this limit.
	app.use(graphqlUploadExpress({ maxFileSize: 30 * 1024 * 1024, maxFiles: 4 }));
	// cors: false is load-bearing. Apollo v2 otherwise mounts its OWN cors on /graphql
	// and overwrites our global middleware's header with Allow-Origin: * — which,
	// combined with credentialed requests from the native shell (capacitor://localhost),
	// is an illegal pair that WebKit rejects as "Load failed". Same-origin web traffic
	// needs no ACAO at all; cross-origin is fully handled by the global cors above.
	server.applyMiddleware({ app, path, cors: false });

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

// Admin REST endpoint rate limit helper — against admin token leaks or bot abuse
async function checkAdminEndpointRateLimit(adminId: string, endpoint: string, res: any): Promise<boolean> {
	const rl = await checkRateLimit(`admin:${endpoint}:${adminId}`, 1, 300); // 1 request per 5 min
	if (!rl.allowed) {
		res.status(429).json({error: 'Rate limit: this admin endpoint cannot be triggered again within 5 minutes'});
		return false;
	}
	return true;
}

// Admin: Recalculate Kinch + SoR scores for all WCA-linked users
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

// Admin: Manually regenerate sitemap (cron runs every 2 hours, trigger here if urgent)
// Query param ?force=1 → bypass ENV check and Redis lock (for debugging)
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
			// Don't leak stack trace in production — message only
			res.status(500).json({error: err?.message || 'unknown'});
		}
	} catch (err) {
		console.error('[Sitemap] API error:', err);
		res.status(500).json({error: 'Internal server error'});
	}
});

// Admin: Re-sync world records from Robin WCA REST API
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

// RevenueCat webhook — in-app purchase events
import { revenueCatWebhookHandler } from './api/revenuecat_webhook';
app.post('/api/iap/revenuecat-webhook', revenueCatWebhookHandler);

// IAP sync — instant RevenueCat check after restore/purchase
import { iapSyncHandler } from './api/iap_sync';
app.post('/api/iap/sync', iapSyncHandler);

// Cache-busting: Capacitor and web clients check for updated version
app.get('/api/version', (req, res) => {
	res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
	res.json({ version: process.env.RELEASE_NAME || '1.0' });
});

// OTA update check (Faz 2 local bundle): the @capgo/capacitor-updater plugin POSTs
// device info here and expects {version, url} (semver!) or {message} for no-update.
// Artifacts are produced by `yarn bundle:ota` into dist/ota/ (latest.json + zip) and
// served via the existing /dist static mount. min_native gates incompatible bundles
// away from binaries whose native plugin set is too old.
app.post('/api/ota/latest', (req, res) => {
	res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

	let manifest: { version: string; file: string; min_native?: string } | null = null;
	try {
		manifest = JSON.parse(fs.readFileSync(`${__dirname}/../dist/ota/latest.json`, 'utf8'));
	} catch (e) {
		res.json({ message: 'no bundle available', version: '' });
		return;
	}

	const nativeVersion = String(req.body?.version_name || '');
	if (manifest.min_native && nativeVersion && compareAppVersions(nativeVersion, manifest.min_native) < 0) {
		res.json({ message: 'native app too old for this bundle', version: '' });
		return;
	}

	// The plugin itself skips the download when the offered version matches the one
	// it is already running, so we always answer with the latest.
	res.json({
		version: manifest.version,
		url: `https://zktimer.app/dist/ota/${manifest.file}`,
	});
});

// Numeric dotted version compare ("1.5.14" vs "1.6.0") — returns -1/0/1
function compareAppVersions(a: string, b: string): number {
	const pa = a.split('.').map((n) => parseInt(n, 10) || 0);
	const pb = b.split('.').map((n) => parseInt(n, 10) || 0);
	const len = Math.max(pa.length, pb.length);
	for (let i = 0; i < len; i++) {
		const diff = (pa[i] || 0) - (pb[i] || 0);
		if (diff !== 0) return diff < 0 ? -1 : 1;
	}
	return 0;
}

// One-time anonymous data bridge for the Faz 2 origin switch (see
// client/util/native-migrate.ts). The OLD-origin page stashes the exported data
// under a client-generated 128-bit id; the local shell consumes it once. Short TTL,
// size-capped by the JSON body limit, WebView-only, rate limited per IP.
const NATIVE_MIGRATE_TTL_SECONDS = 10 * 60;
const MIGRATE_MID_REGEX = /^[a-f0-9]{32}$/;

app.post('/api/native-migrate/stash', async (req, res) => {
	if (!(req as any).isWebView) {
		res.status(403).json({ error: 'forbidden' });
		return;
	}

	const ip = requestIp.getClientIp(req) || 'unknown';
	const rate = await checkRateLimit(`native_migrate:${ip}`, 10, 3600);
	if (!rate.allowed) {
		res.status(429).json({ error: 'rate limited' });
		return;
	}

	const { mid, payload } = req.body || {};
	if (typeof mid !== 'string' || !MIGRATE_MID_REGEX.test(mid) || !payload || typeof payload !== 'object') {
		res.status(400).json({ error: 'bad request' });
		return;
	}

	await setKeyInRedis(
		createRedisKey(RedisNamespace.NATIVE_MIGRATE_STASH, mid),
		JSON.stringify(payload),
		NATIVE_MIGRATE_TTL_SECONDS
	);
	res.json({ ok: true });
});

app.get('/api/native-migrate/stash/:mid', async (req, res) => {
	res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

	if (!(req as any).isWebView) {
		res.status(403).json({ error: 'forbidden' });
		return;
	}

	const mid = String(req.params.mid || '');
	if (!MIGRATE_MID_REGEX.test(mid)) {
		res.status(400).json({ error: 'bad request' });
		return;
	}

	const redisKey = createRedisKey(RedisNamespace.NATIVE_MIGRATE_STASH, mid);
	const value = await getValueFromRedis(redisKey);
	if (!value) {
		res.status(404).json({ error: 'not found' });
		return;
	}

	// One-time read: consume immediately so the stash can't be replayed.
	await deleteKeyInRedis(redisKey);
	res.setHeader('Content-Type', 'application/json');
	res.send(value);
});

app.use((req, res, next) => {
	if (req.path.startsWith('/graphql')) {
		return next();
	}

	res.status(404).sendFile(`${__dirname}/resources/not_found.html`);
});
