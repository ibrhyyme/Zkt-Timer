import fs from 'fs';
import { acquireRedisLock, createRedisKey, RedisNamespace } from './redis';
import process from 'process';
import { PageContext, routes } from '../../client/components/layout/Routes';
import { uploadObject } from './storage';
import { logger } from './logger';

const SITEMAP_REDIS_KEY = createRedisKey(RedisNamespace.SITEMAP);
const SITEMAP_SCHEMAS_DIR = __dirname + '/sitemap_schemas';
const SITEMAP_S3_PATH = 'site/sitemaps';

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

	const allSiteMapUrls = [defaultSiteMapUrl].filter(Boolean) as string[];
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
	const dailyPaths = ['/', '/welcome', '/timer', '/trainer', '/rooms', '/play', '/community/leaderboards'];
	const weeklyPaths = ['/pro', '/solves', '/stats'];
	const yearlyPaths = ['/terms', '/privacy', '/credits'];

	if (dailyPaths.includes(path)) return 'daily';
	if (weeklyPaths.includes(path)) return 'weekly';
	if (yearlyPaths.includes(path)) return 'yearly';
	return 'monthly';
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
	];

	for (let i = 0; i < routes.length; i += 1) {
		const priority = Math.floor((1 - ((1 / routes.length) * i) / 10) * 1000) / 1000;
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

		urls.push({
			location: `${baseUri}${route.path}`,
			priority,
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

