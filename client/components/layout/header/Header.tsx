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

export const DEFAULT_TITLE = 'Zkt-Timer | Türkiye\'nin #1 Zeka Küpü Timer Sitesi';
export const DEFAULT_DESCRIPTION =
	"Türkiye'nin en gelişmiş zeka küpü timer sitesi! Rubik küp çözüm sürenizi ölçün, canlı mücadele odalarında yarışın, Türkiye rekorlarını takip edin. Speedcubing, 3x3, 2x2, 4x4 ve tüm WCA kategorileri. %100 Türkçe cubing platformu.";
export const DEFAULT_KEYWORDS = 'zeka küpü, rubik küp, rubiks cube, küp timer, speedcubing, cubing türkiye, zeka küpü timer, rubik küp çözümü, 3x3 küp, 2x2 küp, 4x4 küp, WCA türkiye, zeka küpü yarışması, küp çözme, rubik türkiye, speedcubing türkiye, cubing timer, zeka küpü nasıl çözülür, rubik küp algoritma';
export const DEFAULT_FEATURED_IMAGE = resourceUri('/public/images/zkt-logo.png');
export const SITE_URL = 'https://zktimer.app';
export const LOGO_URL = `${SITE_URL}/public/images/zkt-logo.png`;

// JSON-LD Schema for Google Sitelinks
export const getStructuredData = (currentPath: string, finalTitle: string, finalDesc: string) => {
	// WebSite schema - enables sitelinks search box
	const websiteSchema = {
		'@context': 'https://schema.org',
		'@type': 'WebSite',
		'name': 'ZKT Timer - Zeka Küpü Timer',
		'alternateName': [
			'Zeka Küpü Türkiye Timer',
			'Rubik Küp Timer',
			'Rubiks Cube Timer Türkiye',
			'Speedcubing Türkiye',
			'Cubing Timer',
			'Zeka Küpü Timer',
			'Rubik Timer',
			'ZKT Timer'
		],
		'url': SITE_URL,
		'description': DEFAULT_DESCRIPTION,
		'inLanguage': 'tr-TR',
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
		'alternateName': ['Zeka Küpü Türkiye', 'Rubik Küp Türkiye', 'Speedcubing Türkiye'],
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

	// SoftwareApplication schema - helps Google understand this is a timer app
	const softwareSchema = {
		'@context': 'https://schema.org',
		'@type': 'WebApplication',
		'name': 'ZKT Timer',
		'alternateName': 'Zeka Küpü Timer',
		'description': 'Türkiye\'nin en gelişmiş zeka küpü ve rubik küp timer uygulaması. Speedcubing timer\'ı.',
		'url': SITE_URL,
		'applicationCategory': 'UtilitiesApplication',
		'operatingSystem': 'Web Browser, Android, iOS',
		'offers': {
			'@type': 'Offer',
			'price': '0',
			'priceCurrency': 'TRY'
		},
		'aggregateRating': {
			'@type': 'AggregateRating',
			'ratingValue': '4.8',
			'ratingCount': '150',
			'bestRating': '5',
			'worstRating': '1'
		},
		'featureList': [
			'Zeka küpü timer',
			'Rubik küp timer',
			'Canlı yarışma odaları',
			'Türkiye sıralaması',
			'Algoritma öğreticisi',
			'Smart Cube desteği',
			'Stackmat Timer desteği'
		],
		'inLanguage': 'tr-TR',
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
				'description': 'Profesyonel zeka küpü timer\'ı',
				'url': `${SITE_URL}/timer`
			},
			{
				'@type': 'SiteNavigationElement',
				'position': 2,
				'name': 'Canlı Yarışma Odaları',
				'description': 'Arkadaşlarınla veya diğer küpçülerle canlı yarış.',
				'url': `${SITE_URL}/rooms`
			},
			{
				'@type': 'SiteNavigationElement',
				'position': 3,
				'name': 'Türkiye Sıralaması',
				'description': 'Türkiye\'nin en hızlı speedcuber listesi ve rekorları.',
				'url': `${SITE_URL}/community/leaderboards`
			},
			{
				'@type': 'SiteNavigationElement',
				'position': 4,
				'name': 'Algoritma Eğitmeni',
				'description': 'OLL, PLL ve ZBLL algoritmalarını interaktif öğren.',
				'url': `${SITE_URL}/trainer`
			},
			{
				'@type': 'SiteNavigationElement',
				'position': 5,
				'name': 'Ücretsiz Kayıt Ol',
				'description': 'İstatistiklerini bulutta sakla ve analiz et.',
				'url': `${SITE_URL}/signup`
			},
			{
				'@type': 'SiteNavigationElement',
				'position': 6,
				'name': 'ibrhyyme Profili',
				'description': 'Geliştiricinin profili',
				'url': `${SITE_URL}/user/ibrhyyme`
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

	// FAQPage schema - Sık Sorulan Sorular (Ana sayfada gösterilir)
	const faqSchema = (currentPath === '/' || currentPath === '') ? {
		'@context': 'https://schema.org',
		'@type': 'FAQPage',
		'mainEntity': [
			{
				'@type': 'Question',
				'name': 'ZKT Timer nedir ve ne işe yarar?',
				'acceptedAnswer': {
					'@type': 'Answer',
					'text': 'ZKT Timer, Türkiye\'nin en gelişmiş zeka küpü (Rubik Küp) timer platformudur. Speedcubing çözüm sürelerinizi milisaniye hassasiyetinde ölçer, WCA resmi scramble algoritmaları sunar, detaylı istatistikler ve performans analizi sağlar. Canlı yarış odaları, Türkiye sıralaması, akıllı küp desteği ve algoritma öğreticisi gibi profesyonel özellikler içerir.'
				}
			},
			{
				'@type': 'Question',
				'name': 'ZKT Timer tamamen ücretsiz mi?',
				'acceptedAnswer': {
					'@type': 'Answer',
					'text': 'Evet! ZKT Timer %100 ücretsiz bir platformdur. Tüm özellikler (timer, istatistikler, online yarışmalar, trainer, sıralamalar) sınırsız ve reklamsız olarak kullanılabilir. Premium veya ücretli abonelik sistemi yoktur. Hesap oluşturmak ve tüm özelliklere erişmek tamamen ücretsizdir.'
				}
			},
			{
				'@type': 'Question',
				'name': 'Hangi zeka küpü türlerini destekler?',
				'acceptedAnswer': {
					'@type': 'Answer',
					'text': 'ZKT Timer tüm WCA resmi kategorilerini destekler: 2x2x2, 3x3x3, 4x4x4, 5x5x5, 6x6x6, 7x7x7 küpler; Pyraminx, Megaminx, Skewb, Square-1, Clock; 3x3 One-Handed, 3x3 Blindfolded, 4x4 Blindfolded, 5x5 Blindfolded, 3x3 Multi-Blind, 3x3 Fewest Moves kategorileri mevcuttur. Her kategori için WCA resmi scramble algoritmaları kullanılır.'
				}
			},
			{
				'@type': 'Question',
				'name': 'İnternet bağlantısı olmadan kullanabilir miyim?',
				'acceptedAnswer': {
					'@type': 'Answer',
					'text': 'Evet! ZKT Timer Progressive Web App (PWA) teknolojisi sayesinde çevrimdışı çalışabilir. Tarayıcınızda "Ana ekrana ekle" seçeneği ile uygulamayı yükledikten sonra internet olmadan timer\'ı kullanabilir, solve kayıtları oluşturabilir ve istatistiklerinizi görüntüleyebilirsiniz. Verileriniz yerel veritabanında güvenle saklanır ve internet bağlantısı kurulduğunda otomatik olarak senkronize edilir.'
				}
			},
			{
				'@type': 'Question',
				'name': 'WCA resmi bir timer mı?',
				'acceptedAnswer': {
					'@type': 'Answer',
					'text': 'ZKT Timer, WCA (World Cube Association) resmi scramble algoritmalarını kullanan ve WCA kurallarına uygun olarak geliştirilmiş bir antrenman platformudur. Ancak resmi WCA yarışmalarında fiziksel Stackmat Timer kullanılması zorunludur. ZKT Timer, antrenman, pratik yapma, istatistik takibi ve online yarışmalar için idealdir. WCA resmi yarışmalara hazırlanmak için mükemmel bir araçtır.'
				}
			},
			{
				'@type': 'Question',
				'name': 'Hangi cihazlarda çalışır?',
				'acceptedAnswer': {
					'@type': 'Answer',
					'text': 'ZKT Timer tüm modern web tarayıcılarında (Chrome, Firefox, Safari, Edge) çalışır. Windows, macOS, Linux bilgisayarlar; Android ve iOS telefonlar/tabletler desteklenir. PWA olarak telefonunuza uygulama gibi yüklenebilir. Responsive tasarım sayesinde mobil, tablet ve masaüstü cihazlarda optimize deneyim sunar. Smart Cube (GAN, MoYu) ve Stackmat Timer ile de uyumludur.'
				}
			},
			{
				'@type': 'Question',
				'name': 'Verilerim güvende mi?',
				'acceptedAnswer': {
					'@type': 'Answer',
					'text': 'Evet, verileriniz güvendedir. Tüm solve kayıtları, istatistikler ve hesap bilgileri şifreli olarak saklanır. Verileriniz yedekleme amacıyla hem sunucuda hem de tarayıcınızın yerel veritabanında (IndexedDB) tutulur. Kişisel bilgileriniz üçüncü taraflarla paylaşılmaz. İstediğiniz zaman hesabınızı ve tüm verilerinizi silebilirsiniz. KVKK ve GDPR uyumlu veri işleme politikaları uygulanır.'
				}
			},
			{
				'@type': 'Question',
				'name': 'Online yarışmalara nasıl katılabilirim?',
				'acceptedAnswer': {
					'@type': 'Answer',
					'text': 'Online yarışmalara katılmak çok kolay! Ücretsiz hesap oluşturun, "Odalar" menüsünden açık yarış odalarına katılabilir veya arkadaşlarınızla özel oda oluşturabilirsiniz. Head-to-Head (bire bir) ve Elimination (eleme) formatlarında gerçek zamanlı yarışmalar düzenlenir. Ayrıca "Online" bölümünden canlı maçlara katılabilir ve Türkiye sıralamasında yerinizi alabilirsiniz. ELO puanlama sistemi ile rakiplerinizle adil bir şekilde eşleştirilirsiniz.'
				}
			}
		]
	} : null;

	return { websiteSchema, organizationSchema, softwareSchema, navigationSchema, breadcrumbSchema, faqSchema };
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
			pageTitle = 'Zkt-Timer | Türkiye\'nin En Gelişmiş Zeka Küpü Platformu';
			pageDesc = "Türkiye'nin en gelişmiş zeka küpü ve rubik küp platformu! Profesyonel timer, canlı yarış odaları, akıllı küp desteği, detaylı istatistikler ve Türkiye sıralaması. 3x3, 2x2, 4x4 ve tüm WCA kategorileri. %100 Türkçe speedcubing deneyimi.";
		} else if (currentPath === '/timer') {
			pageTitle = 'Timer - Zkt-Timer';
			pageDesc = 'Profesyonel zeka küpü timer. Milisaniye hassasiyetinde ölçüm, WCA scramble algoritmaları, akıllı küp desteği ve detaylı performans analizi. Speedcubing için en iyi timer.';
		} else if (currentPath === '/login') {
			pageTitle = 'Giriş Yap - Zkt-Timer';
			pageDesc = 'ZKT Timer hesabına giriş yap. Çözümlerini kaydet, istatistiklerini takip et ve Türkiye sıralamasında yerini al.';
		} else if (currentPath === '/signup') {
			pageTitle = 'Ücretsiz Hesap Oluştur - Zkt-Timer';
			pageDesc = 'Türkiye\'nin en büyük zeka küpü topluluğuna katıl! Ücretsiz hesap oluştur, çözümlerini kaydet ve diğer küpçülerle yarış.';
		} else if (currentPath === '/forgot-password') {
			pageTitle = 'Şifre Sıfırla - Zkt-Timer';
			pageDesc = 'ZKT Timer hesabının şifresini sıfırla. E-posta adresine gönderilecek bağlantı ile yeni şifre belirle.';
		} else if (currentPath.startsWith('/rooms')) {
			pageTitle = 'Canlı Yarışma Odaları - Zkt-Timer';
			pageDesc = 'Diğer küpçülerle gerçek zamanlı yarış! Arkadaşlarınla oda oluştur veya açık odalara katıl. Speedcubing mücadelesi için en iyi platform.';
		} else if (currentPath === '/settings') {
			pageTitle = 'Kullanıcı Ayarları - Zkt-Timer';
			pageDesc = 'Timer ayarlarını, görünümü ve hesap tercihlerini kişiselleştir.';
		} else if (currentPath.startsWith('/user/')) {
			const parts = currentPath.split('/');
			const username = parts[2] || 'Kullanıcı';
			pageTitle = `${username} - Cuber Profili | Zkt-Timer`;
			pageDesc = `${username} kullanıcısının zeka küpü profili. Rekorları, çözüm istatistikleri ve yarışma geçmişi.`;
		} else if (currentPath.startsWith('/trainer')) {
			pageTitle = 'Algoritma Eğitmeni - Zkt-Timer';
			pageDesc = 'F2L, OLL, PLL ve daha fazla algoritma öğren. İnteraktif 3D küp ile antrenman yap ve hızını artır.';
		} else if (currentPath === '/stats') {
			pageTitle = 'Çözüm İstatistikleri - Zkt-Timer';
			pageDesc = 'Zeka küpü performansını analiz et. Ortalamalar, en iyi süreler, grafiker ve detaylı istatistikler.';
		} else if (currentPath === '/solves') {
			pageTitle = 'Çözüm Geçmişi - Zkt-Timer';
			pageDesc = 'Tüm zeka küpü çözümlerini görüntüle. Scramble, süre ve çözüm detayları ile performans analizi.';
		} else if (currentPath === '/community/leaderboards') {
			pageTitle = 'Türkiye Sıralaması - Zkt-Timer';
			pageDesc = 'Türkiye\'nin en hızlı zeka küpü çözücüleri! Single ve Average rekorları, kategori bazlı sıralamalar.';
		} else if (currentPath === '/demo') {
			pageTitle = 'Demo Modu - Zkt-Timer';
			pageDesc = 'ZKT Timer\'ı ücretsiz dene! Hesap oluşturmadan timer özelliklerini keşfet.';
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
	const { websiteSchema, organizationSchema, softwareSchema, navigationSchema, breadcrumbSchema, faqSchema } = getStructuredData(currentPath, finalTitle, finalDesc);

	return (
		<Helmet>
			<title>{finalTitle}</title>
			<link rel="canonical" href={fullUrl} />
			<link rel="icon" type="image/png" href="/public/images/zkt-logo.png" />

			{shouldNoIndex && <meta name="robots" content="noindex, nofollow" />}

			<meta name="description" content={finalDesc} />
			<meta name="keywords" content={DEFAULT_KEYWORDS} />
			<meta name="author" content="ZKT Timer" />
			<meta name="twitter:title" content={finalTitle} />
			<meta name="twitter:description" content={finalDesc} />
			<meta name="twitter:url" content={fullUrl} />
			<meta name="twitter:image" content={secureImage} />
			<meta property="og:title" content={finalTitle} />
			<meta property="og:description" content={finalDesc} />
			<meta property="og:url" content={fullUrl} />
			<meta property="og:image" content={secureImage} />
			<meta property="og:image:secure_url" content={secureImage} />
			<meta property="og:site_name" content="ZKT Timer - Zeka Küpü Timer" />
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
