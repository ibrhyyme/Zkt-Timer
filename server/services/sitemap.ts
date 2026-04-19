import fs from 'fs';
import { acquireRedisLock, createRedisKey, RedisNamespace } from './redis';
import process from 'process';
import { PageContext, routes } from '../../client/components/layout/Routes';
import { uploadObject } from './storage';
import { logger } from './logger';
import { getPrisma } from '../database';

const SITEMAP_REDIS_KEY = createRedisKey(RedisNamespace.SITEMAP);
const SITEMAP_SCHEMAS_DIR = __dirname + '/sitemap_schemas';
const SITEMAP_S3_PATH = 'site/sitemaps';
const PROFILE_BATCH_SIZE = 5000;
const ACTIVE_DAYS_WINDOW = 30;

interface SiteMapUrl {
	location: string;
	changeFrequency?: 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly';
	priority?: number;
	lastmod?: string;
}

// TODO need some sort of worker pool cuz there are lots of sync calls

/**
 * Priorities
 * Main site pages: 0.9 - 1.0
 * Profiles: 0.7 - 0.8
 * Solves: 0.1
 */

export async function initSiteMapGeneration() {
	const isProd = process.env.ENV === 'production';
	if (!isProd) {
		logger.warn('Not updating sitemap because environment is not prod');
		return;
	}

	const startTime = Date.now();

	const lock = await acquireRedisLock(SITEMAP_REDIS_KEY, 60 * 60 * 3 * 1000);
	if (!lock) {
		logger.info('Not updating sitemap because it has already been updated. Could not acquire lock.');
		return;
	}

	logger.info('Starting sitemap generation');
	deleteLocalSiteMapSchemasFolder();
	createLocalSiteMapSchemasFolder();

	const defaultSiteMapUrl = await uploadDefaultSiteMapUrls();

	logger.info('Finished writing default sitemap', {
		defaultSiteMapUrl,
	});

	const profileSiteMapUrls = await uploadProfileSiteMaps();

	logger.info('Finished writing profile sitemaps', {
		count: profileSiteMapUrls.length,
	});

	const allSiteMapUrls = [defaultSiteMapUrl, ...profileSiteMapUrls].filter(Boolean) as string[];
	await writeSiteMapIndices(allSiteMapUrls);
	// Cache invalidation removed - not needed for local storage

	deleteLocalSiteMapSchemasFolder();

	const endTime = Date.now();
	logger.info('Generated sitemap', {
		timeToGenerateSeconds: (endTime - startTime) / 1000,
	});
}

function createLocalSiteMapSchemasFolder() {
	if (!fs.existsSync(SITEMAP_SCHEMAS_DIR)) {
		fs.mkdirSync(SITEMAP_SCHEMAS_DIR);
	}
}

function deleteLocalSiteMapSchemasFolder() {
	if (fs.existsSync(SITEMAP_SCHEMAS_DIR)) {
		fs.rmSync(SITEMAP_SCHEMAS_DIR, { recursive: true, force: true });
	}
}

async function writeSiteMapIndices(siteMapUrls: string[]) {
	const siteMapList = siteMapUrls.map((loc) => `<sitemap><loc>${loc}</loc></sitemap>`).join('\n');

	const output = `
		<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
			${siteMapList}
		</sitemapindex>
	`;

	const fileName = 'sitemap.xml';
	fs.writeFileSync(getSiteMapFilePath(fileName), output);
	const finalSiteMapUrl = await uploadSiteMapToS3(fileName);

	logger.info('Wrote final sitemap to S3', {
		siteMapUrl: finalSiteMapUrl,
	});

	return finalSiteMapUrl;
}

function getSiteMapFilePath(fileName: string) {
	return `${SITEMAP_SCHEMAS_DIR}/${fileName}`;
}

async function uploadDefaultSiteMapUrls() {
	const urls = getDefaultSiteMapUrls();
	const fileName = `sitemap_site.xml`;
	const dataToWrite = getSiteMapXmlFromSchemaUrlList(urls);
	fs.writeFileSync(getSiteMapFilePath(fileName), dataToWrite);

	return uploadSiteMapToS3(fileName);
}

async function uploadSiteMapToS3(fileName: string) {
	const fileData = fs.readFileSync(getSiteMapFilePath(fileName));

	const cdnPath = `${SITEMAP_S3_PATH}/${fileName}`;

	if (process.env.ENV === 'production') {
		await uploadObject(fileData, cdnPath, {
			ContentType: 'application/xml',
			Expires: new Date(),
		});
	}

	// Returns the public URL
	return `https://zktimer.app/public/uploads/${cdnPath}`;
}

function getChangeFrequency(path: string): SiteMapUrl['changeFrequency'] {
	const hourlyPaths = ['/community/competitions'];
	const dailyPaths = [
		'/',
		'/welcome',
		'/timer',
		'/trainer',
		'/rooms',
		'/ranks',
	];
	const weeklyPaths = ['/pro', '/solves', '/stats', '/battle'];
	const yearlyPaths = ['/terms', '/privacy', '/credits'];

	if (hourlyPaths.includes(path)) return 'hourly';
	if (dailyPaths.includes(path)) return 'daily';
	if (weeklyPaths.includes(path)) return 'weekly';
	if (yearlyPaths.includes(path)) return 'yearly';
	return 'monthly';
}

function getPriorityForPath(path: string): number | null {
	const highPriorityPaths: Record<string, number> = {
		'/': 1.0,
		'/welcome': 1.0,
		'/timer': 1.0,
		'/community/competitions': 0.95,
		'/trainer': 0.9,
		'/rooms': 0.85,
		'/ranks': 0.85,
		'/signup': 0.8,
		'/login': 0.7,
		'/battle': 0.7,
		'/solves': 0.6,
		'/stats': 0.6,
		'/terms': 0.3,
		'/privacy': 0.3,
		'/credits': 0.3,
	};
	return highPriorityPaths[path] ?? null;
}

function getDefaultSiteMapUrls() {
	const baseUri = process.env.BASE_URI;
	const urls: SiteMapUrl[] = [];
	const today = new Date().toISOString().split('T')[0];

	// Sitemap'e dahil edilmemesi gereken path'ler
	const excludedPaths = [
		'/settings',
		'/sessions',
		'/force-log-out',
		'/forgot',
		'/unsub-emails',
		'/account',
		'/oauth',
		'/admin',
		// ZKT yarismalari ozel — Google'a hicbir formda verme
		'/community/zkt-competitions',
		'/community/zkt-records',
		'/community/zkt-rankings',
	];

	for (let i = 0; i < routes.length; i += 1) {
		const fallbackPriority = Math.floor((1 - ((1 / routes.length) * i) / 10) * 1000) / 1000;
		const route = routes[i] as PageContext;

		if ((route as any)?.redirect) {
			continue;
		}

		if (route.admin || route.restricted || route.path.includes(':')) {
			continue;
		}

		// Exclude paths that should not be indexed
		if (excludedPaths.some(excluded => route.path.startsWith(excluded))) {
			continue;
		}

		const explicitPriority = getPriorityForPath(route.path);
		urls.push({
			location: `${baseUri}${route.path}`,
			priority: explicitPriority ?? fallbackPriority,
			changeFrequency: getChangeFrequency(route.path),
			lastmod: today,
		});
	}

	return urls;
}


function getSiteMapXmlFromSchemaUrlList(urls: SiteMapUrl[]): string {
	const urlListInXml = urls.map((url) => convertSchemaUrlToXml(url)).join('\n');

	return `
		<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
			${urlListInXml}		  
		</urlset> 
	`;
}

function convertSchemaUrlToXml(url: SiteMapUrl) {
	const location = url.location ? `<loc>${url.location}</loc>` : '';
	const priority = url.priority ? `<priority>${url.priority}</priority>` : '';
	const changeFreq = url.changeFrequency ? `<changefreq>${url.changeFrequency}</changefreq>` : '';
	const lastmod = url.lastmod ? `<lastmod>${url.lastmod}</lastmod>` : '';

	return `
		<url>
			${location}
			${priority}
			${changeFreq}
			${lastmod}
		</url>
	`;
}

async function uploadProfileSiteMaps(): Promise<string[]> {
	const baseUri = process.env.BASE_URI;
	const prisma = getPrisma();
	const activeThreshold = new Date(Date.now() - ACTIVE_DAYS_WINDOW * 24 * 60 * 60 * 1000);

	// Kaliteli profil filtresi: banli degil, email dogrulanmis, username var,
	// ve AKTIF (son 30 gun) VEYA Pro/Premium VEYA profil dolu (bio/pfp)
	const users = await prisma.userAccount.findMany({
		where: {
			banned_forever: false,
			email_verified: true,
			username: { not: null },
			OR: [
				{ last_solve_at: { gte: activeThreshold } },
				{ is_pro: true },
				{ is_premium: true },
				{ profile: { bio: { not: null } } },
				{ profile: { pfp_image_id: { not: null } } },
			],
		},
		select: {
			username: true,
			last_solve_at: true,
			created_at: true,
			is_pro: true,
			is_premium: true,
		},
	});

	if (users.length === 0) {
		logger.info('No qualifying profiles for sitemap');
		return [];
	}

	const urls: SiteMapUrl[] = users.map((u) => {
		const lastActivity = u.last_solve_at || u.created_at;
		const isSubscriber = u.is_pro || u.is_premium;
		return {
			location: `${baseUri}/user/${encodeURIComponent(u.username!)}`,
			priority: isSubscriber ? 0.8 : 0.7,
			changeFrequency: 'weekly',
			lastmod: lastActivity.toISOString().split('T')[0],
		};
	});

	const uploadedUrls: string[] = [];
	for (let i = 0; i < urls.length; i += PROFILE_BATCH_SIZE) {
		const batch = urls.slice(i, i + PROFILE_BATCH_SIZE);
		const batchIndex = Math.floor(i / PROFILE_BATCH_SIZE) + 1;
		const fileName = `sitemap_profiles_${batchIndex}.xml`;
		const xml = getSiteMapXmlFromSchemaUrlList(batch);
		fs.writeFileSync(getSiteMapFilePath(fileName), xml);
		const url = await uploadSiteMapToS3(fileName);
		uploadedUrls.push(url);
	}

	logger.info('Wrote profile sitemaps', {
		totalProfiles: users.length,
		batches: uploadedUrls.length,
	});

	return uploadedUrls;
}

