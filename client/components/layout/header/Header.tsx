import React, { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { TFunction } from 'i18next';
import Helmet from 'react-helmet';
import { resourceUri } from '../../../util/storage';
// process.env variables are defined by esbuild, no need to import process

interface Props {
	path: string;
	title?: string;
	description?: string;
	featuredImage?: string;
	children?: ReactNode;
}

export const DEFAULT_TITLE = "Zkt Timer | Online Rubik's Cube Timer, WCA Competitions & Speedcubing Platform";
export const DEFAULT_DESCRIPTION =
	"The most advanced online Rubik's cube timer with live WCA competitions, live race rooms, algorithm trainer, smart cube support, and global leaderboards. All WCA events: 3x3, 2x2, 4x4, Pyraminx, Megaminx & more.";
export const DEFAULT_KEYWORDS = "rubiks cube timer, cube timer, speedcubing timer, online cube timer, WCA timer, WCA competitions, speedcubing competitions, cube competition, WCA live, 3x3 timer, 2x2 timer, 4x4 timer, 5x5 timer, rubik cube, speedcubing, cubing, puzzle timer, zeka küpü timer, rubik küp, küp zamanlayıcı, zeka küpü yarışması, WCA yarışma, кубик рубика таймер, спидкубинг, соревнования WCA, cronómetro cubo rubik, cubo rubik, competiciones WCA, rubik's cube solver, algorithm trainer, cube racing, cube records, world records";
export const DEFAULT_FEATURED_IMAGE = resourceUri('/public/images/zkt-logo.png');
export const SITE_URL = 'https://zktimer.app';
export const LOGO_URL = `${SITE_URL}/public/images/zkt-logo.png`;

const OG_LOCALE_MAP: Record<string, string> = {
	tr: 'tr_TR', en: 'en_US', es: 'es_ES', ru: 'ru_RU'
};
const LANG_CODE_MAP: Record<string, string> = {
	tr: 'tr-TR', en: 'en-US', es: 'es-ES', ru: 'ru-RU'
};

export function getPageKeywords(currentPath: string, t: TFunction): string {
	const fallback = t('seo.keywords');

	if (currentPath === '/' || currentPath === '' || currentPath === '/welcome') {
		return t('seo.home_keywords', fallback);
	}
	if (currentPath === '/timer') return t('seo.timer_keywords', fallback);
	if (currentPath === '/trainer' || currentPath.startsWith('/trainer')) return t('seo.trainer_keywords', fallback);
	if (currentPath.startsWith('/rooms')) return t('seo.rooms_keywords', fallback);
	if (currentPath === '/battle') return t('seo.battle_keywords', fallback);
	if (currentPath === '/ranks' || currentPath === '/community/leaderboards') return t('seo.leaderboards_keywords', fallback);
	if (currentPath === '/stats') return t('seo.stats_keywords', fallback);
	if (currentPath === '/solves') return t('seo.solves_keywords', fallback);
	if (currentPath === '/pro' || currentPath === '/account/pro') return t('seo.pro_keywords', fallback);
	if (currentPath.startsWith('/user/')) return t('seo.user_profile_keywords', fallback);
	if (currentPath.startsWith('/community/competitions')) return t('seo.wca_competitions_keywords', fallback);
	if (currentPath.startsWith('/community/zkt-competitions')) return t('seo.zkt_competitions_keywords', fallback);
	if (currentPath === '/community/zkt-records') return t('seo.zkt_records_keywords', fallback);
	if (currentPath === '/community/zkt-rankings') return t('seo.zkt_rankings_keywords', fallback);
	if (currentPath === '/login' || currentPath === '/signup' || currentPath === '/wca-signup') return t('seo.login_keywords', fallback);

	return fallback;
}

// JSON-LD Schema for Google Sitelinks
export const getStructuredData = (currentPath: string, finalTitle: string, finalDesc: string, t: TFunction, lang: string) => {
	const inLanguage = LANG_CODE_MAP[lang] || 'en-US';

	// WebSite schema - enables sitelinks search box
	const websiteSchema = {
		'@context': 'https://schema.org',
		'@type': 'WebSite',
		'name': 'Zkt Timer',
		'alternateName': [
			"Rubik's Cube Timer",
			'Zeka Küpü Timer',
			'Cronómetro Cubo Rubik',
			'Таймер Кубика Рубика',
			'مؤقت مكعب روبيك',
			'Speedcubing Timer',
			'Cubing Timer'
		],
		'url': SITE_URL,
		'description': finalDesc,
		'inLanguage': inLanguage,
		'keywords': t('seo.keywords')
	};

	// Person schema - the creator behind the platform (E-E-A-T trust signal)
	const creatorSchema = {
		'@type': 'Person',
		'name': 'ibrhyyme',
		'url': `${SITE_URL}/user/ibrhyyme`,
		'jobTitle': 'Founder & Lead Developer',
		'knowsAbout': ['Speedcubing', "Rubik's Cube", 'Web Development', 'Smart Cube Bluetooth Integration']
	};

	// Organization schema - shows logo in search results
	const organizationSchema = {
		'@context': 'https://schema.org',
		'@type': 'Organization',
		'name': 'Zkt Timer',
		'alternateName': ["Rubik's Cube Timer", 'Speedcubing Platform', 'Cubing Timer'],
		'url': SITE_URL,
		'logo': LOGO_URL,
		'image': LOGO_URL,
		'description': finalDesc,
		'foundingDate': '2024',
		'founder': creatorSchema,
		'sameAs': [
			'https://apps.apple.com/app/zkt-timer/id6760920873',
			'https://play.google.com/store/apps/details?id=com.zktimer.app',
			'https://www.instagram.com/zekakuputurkiye',
			'https://www.youtube.com/@zekakuputurkiye'
		],
		'contactPoint': {
			'@type': 'ContactPoint',
			'contactType': 'customer support',
			'availableLanguage': ['Turkish', 'English', 'Spanish', 'Russian']
		}
	};

	// SoftwareApplication schema - helps Google understand this is a timer app
	const featureList = t('seo.feature_list', { returnObjects: true });
	const softwareSchema = {
		'@context': 'https://schema.org',
		'@type': 'WebApplication',
		'name': 'Zkt Timer',
		'alternateName': "Rubik's Cube Timer",
		'description': t('seo.app_description'),
		'url': SITE_URL,
		'applicationCategory': 'GameApplication',
		'applicationSubCategory': 'PuzzleGame',
		'operatingSystem': 'Web Browser, Android, iOS',
		'installUrl': SITE_URL,
		'offers': {
			'@type': 'Offer',
			'price': '0',
			'priceCurrency': 'USD'
		},
		'featureList': Array.isArray(featureList) ? featureList : [],
		'inLanguage': inLanguage,
		'keywords': t('seo.keywords'),
		'creator': creatorSchema,
		'author': creatorSchema,
		'publisher': {
			'@type': 'Organization',
			'name': 'Zkt Timer',
			'url': SITE_URL,
			'logo': LOGO_URL
		}
	};

	// MobileApplication - iOS App Store
	const iosAppSchema = {
		'@context': 'https://schema.org',
		'@type': 'MobileApplication',
		'name': 'Zkt Timer',
		'operatingSystem': 'iOS',
		'applicationCategory': 'GameApplication',
		'applicationSubCategory': 'PuzzleGame',
		'description': t('seo.app_description'),
		'downloadUrl': 'https://apps.apple.com/app/zkt-timer/id6760920873',
		'installUrl': 'https://apps.apple.com/app/zkt-timer/id6760920873',
		'image': LOGO_URL,
		'offers': { '@type': 'Offer', 'price': '0', 'priceCurrency': 'USD' },
		'creator': creatorSchema,
		'inLanguage': inLanguage
	};

	// MobileApplication - Android Play Store
	const androidAppSchema = {
		'@context': 'https://schema.org',
		'@type': 'MobileApplication',
		'name': 'Zkt Timer',
		'operatingSystem': 'Android',
		'applicationCategory': 'GameApplication',
		'applicationSubCategory': 'PuzzleGame',
		'description': t('seo.app_description'),
		'downloadUrl': 'https://play.google.com/store/apps/details?id=com.zktimer.app',
		'installUrl': 'https://play.google.com/store/apps/details?id=com.zktimer.app',
		'image': LOGO_URL,
		'offers': { '@type': 'Offer', 'price': '0', 'priceCurrency': 'USD' },
		'creator': creatorSchema,
		'inLanguage': inLanguage
	};

	// SiteNavigationElement - defines main navigation for sitelinks hierarchy
	const navigationSchema = {
		'@context': 'https://schema.org',
		'@type': 'ItemList',
		'itemListElement': [
			{
				'@type': 'SiteNavigationElement',
				'position': 1,
				'name': 'Timer',
				'description': t('seo.nav_timer_desc'),
				'url': `${SITE_URL}/timer`
			},
			{
				'@type': 'SiteNavigationElement',
				'position': 2,
				'name': t('seo.nav_competitions_name'),
				'description': t('seo.nav_competitions_desc'),
				'url': `${SITE_URL}/community/competitions`
			},
			{
				'@type': 'SiteNavigationElement',
				'position': 3,
				'name': t('seo.nav_rooms_name'),
				'description': t('seo.nav_rooms_desc'),
				'url': `${SITE_URL}/rooms`
			},
			{
				'@type': 'SiteNavigationElement',
				'position': 4,
				'name': t('seo.nav_leaderboards_name'),
				'description': t('seo.nav_leaderboards_desc'),
				'url': `${SITE_URL}/ranks`
			},
			{
				'@type': 'SiteNavigationElement',
				'position': 5,
				'name': t('seo.nav_trainer_name'),
				'description': t('seo.nav_trainer_desc'),
				'url': `${SITE_URL}/trainer`
			},
			{
				'@type': 'SiteNavigationElement',
				'position': 6,
				'name': t('seo.nav_signup_name'),
				'description': t('seo.nav_signup_desc'),
				'url': `${SITE_URL}/signup`
			}
		]
	};

	// CollectionPage schema for competitions list page
	const collectionPageSchema = currentPath === '/community/competitions' ? {
		'@context': 'https://schema.org',
		'@type': 'CollectionPage',
		'name': t('seo.wca_competitions_title'),
		'description': t('seo.wca_competitions_description'),
		'url': `${SITE_URL}/community/competitions`,
		'about': {
			'@type': 'Thing',
			'name': 'WCA Speedcubing Competitions',
			'description': 'World Cube Association official speedcubing competitions worldwide'
		},
		'inLanguage': inLanguage,
		'isPartOf': {
			'@type': 'WebSite',
			'name': 'Zkt Timer',
			'url': SITE_URL
		}
	} : null;

	// BreadcrumbList for current page
	const breadcrumbSchema = currentPath && currentPath !== '/' ? {
		'@context': 'https://schema.org',
		'@type': 'BreadcrumbList',
		'itemListElement': [
			{
				'@type': 'ListItem',
				'position': 1,
				'name': t('seo.breadcrumb_home'),
				'item': SITE_URL
			},
			{
				'@type': 'ListItem',
				'position': 2,
				'name': finalTitle.replace(' - Zkt Timer', ''),
				'item': `${SITE_URL}${currentPath}`
			}
		]
	} : null;

	// FAQPage schema - shown on homepage
	const faqItems = t('seo.faq', { returnObjects: true });
	const faqSchema = (currentPath === '/' || currentPath === '') && Array.isArray(faqItems) && faqItems.length > 0 ? {
		'@context': 'https://schema.org',
		'@type': 'FAQPage',
		'mainEntity': faqItems.map((item: { q: string; a: string }) => ({
			'@type': 'Question',
			'name': item.q,
			'acceptedAnswer': {
				'@type': 'Answer',
				'text': item.a
			}
		}))
	} : null;

	return { websiteSchema, organizationSchema, softwareSchema, navigationSchema, breadcrumbSchema, faqSchema, collectionPageSchema, iosAppSchema, androidAppSchema };
};

export default function Header(props: Props) {
	const { t, i18n } = useTranslation();
	const lang = i18n.language || 'en';
	const currentPath = props.path || '';
	const fullUrl = `https://zktimer.app${currentPath}`;

	// Sayfa bazlı varsayılan SEO bilgileri
	let pageTitle = props.title;
	let pageDesc = props.description;

	// Eğer component'e özel title/desc gelmediyse, path'e göre belirle
	if (!pageTitle) {
		if (currentPath === '/' || currentPath === '') {
			pageTitle = t('seo.home_title');
			pageDesc = t('seo.home_description');
		} else if (currentPath === '/timer') {
			pageTitle = t('seo.timer_title');
			pageDesc = t('seo.timer_description');
		} else if (currentPath === '/login') {
			pageTitle = t('seo.login_title');
			pageDesc = t('seo.login_description');
		} else if (currentPath === '/signup') {
			pageTitle = t('seo.signup_title');
			pageDesc = t('seo.signup_description');
		} else if (currentPath === '/forgot-password') {
			pageTitle = t('seo.forgot_password_title');
			pageDesc = t('seo.forgot_password_description');
		} else if (currentPath.startsWith('/rooms')) {
			pageTitle = t('seo.rooms_title');
			pageDesc = t('seo.rooms_description');
		} else if (currentPath === '/settings') {
			pageTitle = t('seo.settings_title');
			pageDesc = t('seo.settings_description');
		} else if (currentPath.startsWith('/user/')) {
			const parts = currentPath.split('/');
			const username = parts[2] || t('seo.user_fallback');
			pageTitle = t('seo.user_profile_title', { username });
			pageDesc = t('seo.user_profile_description', { username });
		} else if (currentPath.startsWith('/trainer')) {
			pageTitle = t('seo.trainer_title');
			pageDesc = t('seo.trainer_description');
		} else if (currentPath === '/stats') {
			pageTitle = t('seo.stats_title');
			pageDesc = t('seo.stats_description');
		} else if (currentPath === '/solves') {
			pageTitle = t('seo.solves_title');
			pageDesc = t('seo.solves_description');
		} else if (currentPath === '/community/leaderboards' || currentPath === '/ranks') {
			pageTitle = t('seo.leaderboards_title');
			pageDesc = t('seo.leaderboards_description');
		} else if (currentPath === '/community/competitions') {
			pageTitle = t('seo.wca_competitions_title');
			pageDesc = t('seo.wca_competitions_description');
		} else if (/\/community\/competitions\/[^/]+\/wca-live/.test(currentPath)) {
			pageTitle = t('seo.wca_live_title');
			pageDesc = t('seo.wca_live_description');
		} else if (/\/community\/competitions\/[^/]+\/persons/.test(currentPath)) {
			pageTitle = t('seo.wca_person_title');
			pageDesc = t('seo.wca_person_description');
		} else if (/\/community\/competitions\/[^/]+\/activities/.test(currentPath)) {
			pageTitle = t('seo.wca_activity_title');
			pageDesc = t('seo.wca_activity_description');
		} else if (/\/community\/competitions\/[^/]+\/personal-bests/.test(currentPath)) {
			pageTitle = t('seo.wca_personal_bests_title');
			pageDesc = t('seo.wca_personal_bests_description');
		} else if (currentPath.startsWith('/community/competitions/')) {
			pageTitle = t('seo.wca_competition_detail_title');
			pageDesc = t('seo.wca_competition_detail_description');
		} else if (/\/community\/zkt-competitions\/[^/]+\/live/.test(currentPath)) {
			pageTitle = t('seo.zkt_live_title');
			pageDesc = t('seo.zkt_live_description');
		} else if (/\/community\/zkt-competitions\/[^/]+\/competitors/.test(currentPath)) {
			pageTitle = t('seo.zkt_competitor_title');
			pageDesc = t('seo.zkt_competitor_description');
		} else if (/\/community\/zkt-competitions\/[^/]+\/activities/.test(currentPath)) {
			pageTitle = t('seo.zkt_activity_title');
			pageDesc = t('seo.zkt_activity_description');
		} else if (currentPath.startsWith('/community/zkt-competitions/')) {
			pageTitle = t('seo.zkt_competition_detail_title');
			pageDesc = t('seo.zkt_competition_detail_description');
		} else if (currentPath === '/community/zkt-records') {
			pageTitle = t('seo.zkt_records_title');
			pageDesc = t('seo.zkt_records_description');
		} else if (currentPath === '/community/zkt-rankings') {
			pageTitle = t('seo.zkt_rankings_title');
			pageDesc = t('seo.zkt_rankings_description');
		} else if (currentPath === '/pro' || currentPath === '/account/pro') {
			pageTitle = t('seo.pro_title');
			pageDesc = t('seo.pro_description');
		} else if (currentPath === '/battle') {
			pageTitle = t('seo.battle_title');
			pageDesc = t('seo.battle_description');
		}
	}

	// Varsayılanlara geri dön (Hala boşsa)
	const finalTitle = pageTitle || DEFAULT_TITLE;
	const finalDesc = pageDesc || DEFAULT_DESCRIPTION;
	const rawImage = props.featuredImage || DEFAULT_FEATURED_IMAGE;
	const secureImage = rawImage.startsWith('http') ? rawImage : `${SITE_URL}${rawImage}`;

	// İndekslenmemesi gereken sayfalar (NoIndex)
	// ZKT yarismalari kapali — sadece kayitli kullanicilara ozel
	const noIndexPaths = [
		'/settings', '/sessions', '/force-log-out', '/account', '/oauth', '/admin',
		'/community/zkt-competitions', '/community/zkt-records', '/community/zkt-rankings',
	];
	// WCA yarisma alt sayfalari — sınırsız URL, thin content riski (WCA Live ile ayni strateji)
	// Ana yarisma sayfasi (`/community/competitions/:id`) ve liste indexlenebilir kalacak.
	const noIndexPatterns = [
		/^\/community\/competitions\/[^/]+\/wca-live\//,
		/^\/community\/competitions\/[^/]+\/persons\//,
		/^\/community\/competitions\/[^/]+\/activities\//,
		/^\/community\/competitions\/[^/]+\/personal-bests\//,
	];
	const shouldNoIndex =
		noIndexPaths.some((p) => currentPath.startsWith(p)) ||
		noIndexPatterns.some((re) => re.test(currentPath));

	// Structured Data
	const { websiteSchema, organizationSchema, softwareSchema, navigationSchema, breadcrumbSchema, faqSchema, collectionPageSchema, iosAppSchema, androidAppSchema } = getStructuredData(currentPath, finalTitle, finalDesc, t, lang);
	const pageKeywords = getPageKeywords(currentPath, t);

	return (
		<Helmet>
			<title>{finalTitle}</title>
			<link rel="canonical" href={fullUrl} />
			<link rel="icon" type="image/png" href="/public/images/zkt-logo.png" />

			{shouldNoIndex && <meta name="robots" content="noindex, nofollow" />}

			<meta name="description" content={finalDesc} />
			<meta name="keywords" content={pageKeywords} />
			<meta name="author" content="Zkt Timer" />

			{/* Twitter Card */}
			<meta name="twitter:card" content="summary_large_image" />
			<meta name="twitter:title" content={finalTitle} />
			<meta name="twitter:description" content={finalDesc} />
			<meta name="twitter:url" content={fullUrl} />
			<meta name="twitter:image" content={secureImage} />

			{/* Open Graph */}
			<meta property="og:title" content={finalTitle} />
			<meta property="og:description" content={finalDesc} />
			<meta property="og:url" content={fullUrl} />
			<meta property="og:image" content={secureImage} />
			<meta property="og:image:secure_url" content={secureImage} />
			<meta property="og:image:width" content="1200" />
			<meta property="og:image:height" content="630" />
			<meta property="og:site_name" content="Zkt Timer" />
			<meta property="og:type" content="website" />
			<meta property="og:locale" content={OG_LOCALE_MAP[lang] || 'en_US'} />

			{/* JSON-LD Structured Data for Google Sitelinks */}
			<script type="application/ld+json">
				{JSON.stringify(websiteSchema)}
			</script>
			<script type="application/ld+json">
				{JSON.stringify(organizationSchema)}
			</script>
			<script type="application/ld+json">
				{JSON.stringify(softwareSchema)}
			</script>
			<script type="application/ld+json">
				{JSON.stringify(navigationSchema)}
			</script>
			<script type="application/ld+json">
				{JSON.stringify(iosAppSchema)}
			</script>
			<script type="application/ld+json">
				{JSON.stringify(androidAppSchema)}
			</script>
			{breadcrumbSchema && (
				<script type="application/ld+json">
					{JSON.stringify(breadcrumbSchema)}
				</script>
			)}
			{faqSchema && (
				<script type="application/ld+json">
					{JSON.stringify(faqSchema)}
				</script>
			)}
			{collectionPageSchema && (
				<script type="application/ld+json">
					{JSON.stringify(collectionPageSchema)}
				</script>
			)}

			{props.children}
		</Helmet>
	);
}
