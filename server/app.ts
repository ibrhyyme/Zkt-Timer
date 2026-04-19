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

import { initLLStates } from './util/solve/ll_states';
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
import * as models from './api/_index';
import bodyParser from 'body-parser';
import { customAuthChecker } from './middlewares/auth';
import { GraphQLUpload, graphqlUploadExpress } from 'graphql-upload';
import { ErrorCode, ErrorMessage } from './constants/errors';
import { printSchema } from 'graphql';
import { initRedisClient } from './services/redis';

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

app.use(compression());
app.use(bodyParser.json({ limit: '200mb' }));
app.use(cookieParser());

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
		environment: env
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

	// Start server
	let server: any = new ApolloServer({
		uploads: false,
		schema: mergedSchema,
		playground: isDev,
		context: async ({ req, res }) => {
			const user = await getMe(req);
			const ipAddress = requestIp.getClientIp(req);

			if (user && (user.banned_until || user.banned_forever)) {
				throw new GraphQLError(ErrorCode.FORBIDDEN, ErrorMessage.BANNED);
			}

			return { user, ipAddress, req, res, prisma: getPrisma() };
		}
	});

	const path = '/graphql';

	app.use(graphqlUploadExpress());
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

	// Debug: Show actual env values with quotes
	console.log('DEBUG - Raw env values:', {
		WCA_CLIENT_ID: `"${process.env.WCA_CLIENT_ID}"`,
		WCA_CLIENT_SECRET: `"${process.env.WCA_CLIENT_SECRET}"`,
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

// Admin: Tum WCA bagli kullanicilarin Kinch + SoR skorlarini yeniden hesapla
app.post('/api/admin/recalculate-rankings', (req, res) => {
	const {getMe} = require('./util/auth');
	const {recalculateAllRankings} = require('./models/ranking');

	getMe(req).then((me) => {
		if (!me || !me.admin) {
			res.status(403).json({error: 'Forbidden'});
			return;
		}

		recalculateAllRankings().then(() => {
			console.log('[Rankings] All rankings recalculated via API');
		}).catch((err) => {
			console.error('[Rankings] Recalculation failed:', err);
		});

		res.json({success: true, message: 'Ranking recalculation started'});
	}).catch((err) => {
		console.error('[Rankings] API error:', err);
		res.status(500).json({error: 'Internal server error'});
	});
});

// Admin: Sitemap'i manuel yeniden olustur (cron 2 saatte bir, acelen varsa buradan tetikle)
// Query param ?force=1 → ENV check'i ve Redis lock'u bypass et (debug icin)
app.post('/api/admin/regenerate-sitemap', (req, res) => {
	const {getMe} = require('./util/auth');
	const {initSiteMapGeneration} = require('./services/sitemap');
	const force = req.query.force === '1';

	getMe(req).then(async (me) => {
		if (!me || !me.admin) {
			res.status(403).json({error: 'Forbidden'});
			return;
		}

		try {
			const result = await initSiteMapGeneration({force});
			console.log('[Sitemap] Manual regeneration result:', result);
			res.json({success: true, result});
		} catch (err: any) {
			console.error('[Sitemap] Manual regeneration failed:', err);
			res.status(500).json({error: err?.message || 'unknown', stack: err?.stack});
		}
	}).catch((err) => {
		console.error('[Sitemap] API error:', err);
		res.status(500).json({error: 'Internal server error'});
	});
});

// Admin: Dunya rekorlarini Robin WCA REST API'dan yeniden senkronize et
app.post('/api/admin/sync-world-records', (req, res) => {
	const {getMe} = require('./util/auth');
	const {syncAllWorldRecords} = require('./services/WorldRecordSyncService');

	getMe(req).then((me) => {
		if (!me || !me.admin) {
			res.status(403).json({error: 'Forbidden'});
			return;
		}

		syncAllWorldRecords().then((result) => {
			console.log(`[WRSync] Manual sync done. Updated: ${result.updated}, Failed: ${result.failed}`);
		}).catch((err) => {
			console.error('[WRSync] Manual sync failed:', err);
		});

		res.json({success: true, message: 'World record sync started'});
	}).catch((err) => {
		console.error('[WRSync] API error:', err);
		res.status(500).json({error: 'Internal server error'});
	});
});

// RevenueCat webhook — in-app purchase eventleri
import { revenueCatWebhookHandler } from './api/revenuecat_webhook';
app.post('/api/iap/revenuecat-webhook', revenueCatWebhookHandler);

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
