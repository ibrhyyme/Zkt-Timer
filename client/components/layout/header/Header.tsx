import React, { ReactNode } from 'react';
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

const DEFAULT_TITLE = 'Zkt-Timer | Profesyonel Zeka Küpü Timer';
const DEFAULT_DESCRIPTION =
	"Türkiye'nin en gelişmiş zeka küpü timer sitesi! Canlı mücadele odalarında yarış, Türkiye rekorlarını takip et ve algoritma öğreticisi ile yeni teknikler öğren. %100 Türkçe.";
const DEFAULT_FEATURED_IMAGE = resourceUri('/public/images/zkt-logo.png');
const SITE_URL = 'https://zktimer.app';
const LOGO_URL = `${SITE_URL}/public/images/zkt-logo.png`;

// JSON-LD Schema for Google Sitelinks
const getStructuredData = (currentPath: string, finalTitle: string, finalDesc: string) => {
	// WebSite schema - enables sitelinks search box
	const websiteSchema = {
		'@context': 'https://schema.org',
		'@type': 'WebSite',
		'name': 'ZKT Timer',
		'alternateName': 'Zeka Küpü Türkiye Timer',
		'url': SITE_URL,
		'description': DEFAULT_DESCRIPTION,
		'inLanguage': 'tr-TR',
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
		'alternateName': 'Zeka Küpü Türkiye',
		'url': SITE_URL,
		'logo': LOGO_URL,
		'image': LOGO_URL,
		'description': DEFAULT_DESCRIPTION,
		'sameAs': [
			'https://www.instagram.com/zekakuputurkiye',
			'https://www.youtube.com/@zekakuputurkiye'
		],
		'contactPoint': {
			'@type': 'ContactPoint',
			'contactType': 'customer support',
			'availableLanguage': 'Turkish'
		}
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
				'description': 'Profesyonel zeka küpü zamanlayıcısı',
				'url': SITE_URL
			},
			{
				'@type': 'SiteNavigationElement',
				'position': 2,
				'name': 'Giriş Yap',
				'description': 'Hesabına giriş yap',
				'url': `${SITE_URL}/login`
			},
			{
				'@type': 'SiteNavigationElement',
				'position': 3,
				'name': 'Odalar',
				'description': 'Canlı yarış odaları',
				'url': `${SITE_URL}/rooms`
			},
			{
				'@type': 'SiteNavigationElement',
				'position': 4,
				'name': 'İstatistikler',
				'description': 'Çözüm istatistiklerin',
				'url': `${SITE_URL}/stats`
			},
			{
				'@type': 'SiteNavigationElement',
				'position': 5,
				'name': 'Çözümler',
				'description': 'Tüm çözümlerini görüntüle',
				'url': `${SITE_URL}/solves`
			},
			{
				'@type': 'SiteNavigationElement',
				'position': 6,
				'name': 'Liderlik Tablosu',
				'description': 'Türkiye sıralaması',
				'url': `${SITE_URL}/community/leaderboards`
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
				'name': 'Ana Sayfa',
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

	return { websiteSchema, organizationSchema, navigationSchema, breadcrumbSchema };
};

export default function Header(props: Props) {
	const currentPath = props.path || '';
	const fullUrl = `https://zktimer.app${currentPath}`;

	// Sayfa bazlı varsayılan SEO bilgileri
	let pageTitle = props.title;
	let pageDesc = props.description;

	// Eğer component'e özel title/desc gelmediyse, path'e göre belirle
	if (!pageTitle) {
		if (currentPath === '/' || currentPath === '') {
			pageTitle = 'Zkt-Timer | Profesyonel Cubing Timer';
			pageDesc = "Türkiye'nin en gelişmiş zeka küpü timer sitesi! Canlı mücadele odalarında yarış, Türkiye rekorlarını takip et ve algoritma öğreticisi ile yeni teknikler öğren. %100 Türkçe.";
		} else if (currentPath === '/login') {
			pageTitle = 'Giriş Yap - Zkt-Timer';
			pageDesc = 'Hesabına giriş yaparak zeka küpü verilerine ve özel antrenmanlarına ulaş.';
		} else if (currentPath.startsWith('/rooms')) {
			pageTitle = 'Yarışma Odaları - Zkt-Timer';
			pageDesc = 'Diğer küpçülerle canlı yarış odalarında buluş ve hızını test et.';
		} else if (currentPath === '/settings') {
			pageTitle = 'Kullanıcı Ayarları - Zkt-Timer';
			pageDesc = 'Görünüm, zamanlayıcı ve hesap ayarlarını kişiselleştir.';
		} else if (currentPath.startsWith('/user/')) {
			// /user/username şeklindeki path'ten username'i alalım
			const parts = currentPath.split('/');
			const username = parts[2] || 'Kullanıcı';
			pageTitle = `${username} Profili - Zkt-Timer`;
			pageDesc = 'Kişisel zeka küpü rekorlarını ve gelişimini görüntüle.';
		} else if (currentPath.startsWith('/trainer')) {
			pageTitle = 'Algoritma Eğitmeni - Zkt-Timer';
			pageDesc = 'Yeni algoritmalar öğren ve antrenman modlarıyla hızını artır.';
		} else if (currentPath === '/stats') {
			pageTitle = 'İstatistikler - Zkt-Timer';
			pageDesc = 'Zeka küpü çözüm istatistiklerini, ortalamalarını ve gelişimini takip et.';
		} else if (currentPath === '/solves') {
			pageTitle = 'Çözümler - Zkt-Timer';
			pageDesc = 'Tüm zeka küpü çözümlerini görüntüle ve analiz et.';
		} else if (currentPath === '/signup') {
			pageTitle = 'Üye Ol - Zkt-Timer';
			pageDesc = 'Ücretsiz hesap oluştur ve zeka küpü antrenmanlarına başla.';
		} else if (currentPath === '/community/leaderboards') {
			pageTitle = 'Liderlik Tablosu - Zkt-Timer';
			pageDesc = 'Türkiye zeka küpü sıralaması. En hızlı küpçüleri keşfet.';
		}
	}

	// Varsayılanlara geri dön (Hala boşsa)
	const finalTitle = pageTitle || DEFAULT_TITLE;
	const finalDesc = pageDesc || DEFAULT_DESCRIPTION;
	const secureImage = props.featuredImage || DEFAULT_FEATURED_IMAGE;

	// İndekslenmemesi gereken sayfalar (NoIndex)
	const noIndexPaths = ['/settings', '/sessions', '/force-log-out', '/account', '/oauth', '/admin'];
	const shouldNoIndex = noIndexPaths.some((p) => currentPath.startsWith(p));

	// Structured Data
	const { websiteSchema, organizationSchema, navigationSchema, breadcrumbSchema } = getStructuredData(currentPath, finalTitle, finalDesc);

	return (
		<Helmet>
			<title>{finalTitle}</title>
			<link rel="canonical" href={fullUrl} />
			<link rel="icon" type="image/png" href="/public/images/zkt-logo.png" />

			{shouldNoIndex && <meta name="robots" content="noindex, nofollow" />}

			<meta name="description" content={finalDesc} />
			<meta name="twitter:title" content={finalTitle} />
			<meta name="twitter:description" content={finalDesc} />
			<meta name="twitter:url" content={fullUrl} />
			<meta name="twitter:image" content={secureImage} />
			<meta property="og:title" content={finalTitle} />
			<meta property="og:description" content={finalDesc} />
			<meta property="og:url" content={fullUrl} />
			<meta property="og:image" content={secureImage} />
			<meta property="og:image:secure_url" content={secureImage} />
			<meta property="og:site_name" content="ZKT Timer" />
			<meta property="og:type" content="website" />
			<meta property="og:locale" content="tr_TR" />

			{/* JSON-LD Structured Data for Google Sitelinks */}
			<script type="application/ld+json">
				{JSON.stringify(websiteSchema)}
			</script>
			<script type="application/ld+json">
				{JSON.stringify(organizationSchema)}
			</script>
			<script type="application/ld+json">
				{JSON.stringify(navigationSchema)}
			</script>
			{breadcrumbSchema && (
				<script type="application/ld+json">
					{JSON.stringify(breadcrumbSchema)}
				</script>
			)}

			{props.children}
		</Helmet>
	);
}
