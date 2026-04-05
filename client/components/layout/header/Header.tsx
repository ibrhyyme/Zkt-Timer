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

export const DEFAULT_TITLE = "ZKT Timer | Online Rubik's Cube Timer & Speedcubing Platform";
export const DEFAULT_DESCRIPTION =
	"The most advanced online Rubik's cube timer with live race rooms, algorithm trainer, smart cube support, and global leaderboards. All WCA events: 3x3, 2x2, 4x4, Pyraminx, Megaminx & more.";
export const DEFAULT_KEYWORDS = "rubiks cube timer, cube timer, speedcubing timer, online cube timer, WCA timer, 3x3 timer, 2x2 timer, 4x4 timer, rubik cube, speedcubing, cubing, puzzle timer, zeka küpü timer, rubik küp, küp zamanlayıcı, кубик рубика таймер, спидкубинг, cronómetro cubo rubik, cubo rubik, مؤقت مكعب روبيك, rubik's cube solver, algorithm trainer, cube racing";
export const DEFAULT_FEATURED_IMAGE = resourceUri('/images/zkt-logo.png');
export const SITE_URL = 'https://zktimer.app';
export const LOGO_URL = `${SITE_URL}/public/images/zkt-logo.png`;

const OG_LOCALE_MAP: Record<string, string> = {
	tr: 'tr_TR', en: 'en_US', es: 'es_ES', ru: 'ru_RU'
};
const LANG_CODE_MAP: Record<string, string> = {
	tr: 'tr-TR', en: 'en-US', es: 'es-ES', ru: 'ru-RU'
};

// JSON-LD Schema for Google Sitelinks
export const getStructuredData = (currentPath: string, finalTitle: string, finalDesc: string, t: TFunction, lang: string) => {
	const inLanguage = LANG_CODE_MAP[lang] || 'en-US';

	// WebSite schema - enables sitelinks search box
	const websiteSchema = {
		'@context': 'https://schema.org',
		'@type': 'WebSite',
		'name': 'ZKT Timer',
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
		'keywords': DEFAULT_KEYWORDS,
		'potentialAction': {
			'@type': 'SearchAction',
			'target': {
				'@type': 'EntryPoint',
				'urlTemplate': `${SITE_URL}/user/{search_term_string}`
			},
			'query-input': 'required name=search_term_string'
		}
	};

	// Organization schema - shows logo in search results
	const organizationSchema = {
		'@context': 'https://schema.org',
		'@type': 'Organization',
		'name': 'ZKT Timer',
		'alternateName': ["Rubik's Cube Timer", 'Speedcubing Platform', 'Cubing Timer'],
		'url': SITE_URL,
		'logo': LOGO_URL,
		'image': LOGO_URL,
		'description': finalDesc,
		'sameAs': [
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
		'name': 'ZKT Timer',
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
		'keywords': DEFAULT_KEYWORDS
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
				'name': t('seo.nav_rooms_name'),
				'description': t('seo.nav_rooms_desc'),
				'url': `${SITE_URL}/rooms`
			},
			{
				'@type': 'SiteNavigationElement',
				'position': 3,
				'name': t('seo.nav_leaderboards_name'),
				'description': t('seo.nav_leaderboards_desc'),
				'url': `${SITE_URL}/community/leaderboards`
			},
			{
				'@type': 'SiteNavigationElement',
				'position': 4,
				'name': t('seo.nav_trainer_name'),
				'description': t('seo.nav_trainer_desc'),
				'url': `${SITE_URL}/trainer`
			},
			{
				'@type': 'SiteNavigationElement',
				'position': 5,
				'name': t('seo.nav_signup_name'),
				'description': t('seo.nav_signup_desc'),
				'url': `${SITE_URL}/signup`
			}
		]
	};

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
				'name': finalTitle.replace(' - Zkt-Timer', '').replace(' - ZKT Timer', ''),
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

	return { websiteSchema, organizationSchema, softwareSchema, navigationSchema, breadcrumbSchema, faqSchema };
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
		} else if (currentPath === '/community/leaderboards') {
			pageTitle = t('seo.leaderboards_title');
			pageDesc = t('seo.leaderboards_description');
		} else if (currentPath === '/demo') {
			pageTitle = t('seo.demo_title');
			pageDesc = t('seo.demo_description');
		}
	}

	// Varsayılanlara geri dön (Hala boşsa)
	const finalTitle = pageTitle || DEFAULT_TITLE;
	const finalDesc = pageDesc || DEFAULT_DESCRIPTION;
	const rawImage = props.featuredImage || DEFAULT_FEATURED_IMAGE;
	const secureImage = rawImage.startsWith('http') ? rawImage : `${SITE_URL}${rawImage}`;

	// İndekslenmemesi gereken sayfalar (NoIndex)
	const noIndexPaths = ['/settings', '/sessions', '/force-log-out', '/account', '/oauth', '/admin'];
	const shouldNoIndex = noIndexPaths.some((p) => currentPath.startsWith(p));

	// Structured Data
	const { websiteSchema, organizationSchema, softwareSchema, navigationSchema, breadcrumbSchema, faqSchema } = getStructuredData(currentPath, finalTitle, finalDesc, t, lang);

	return (
		<Helmet>
			<title>{finalTitle}</title>
			<link rel="canonical" href={fullUrl} />
			<link rel="icon" type="image/png" href="/public/images/zkt-logo.png" />

			{shouldNoIndex && <meta name="robots" content="noindex, nofollow" />}

			<meta name="description" content={finalDesc} />
			<meta name="keywords" content={DEFAULT_KEYWORDS} />
			<meta name="author" content="ZKT Timer" />

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
			<meta property="og:site_name" content="ZKT Timer" />
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

			{props.children}
		</Helmet>
	);
}
