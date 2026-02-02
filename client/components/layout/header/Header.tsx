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

export default function Header(props: Props) {
	const currentPath = props.path || '';
	const fullUrl = `https://zktimer.app${currentPath}`;

	// Sayfa bazlı varsayılan SEO bilgileri
	let pageTitle = props.title;
	let pageDesc = props.description;

	// Eğer component'e özel title/desc gelmediyse, path'e göre belirle
	if (!pageTitle) {
		if (currentPath === '/' || currentPath === '') {
			pageTitle = 'Zkt-Timer | Profesyonel Zeka Küpü Zamanlayıcısı';
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
		}
	}

	// Varsayılanlara geri dön (Hala boşsa)
	const finalTitle = pageTitle || DEFAULT_TITLE;
	const finalDesc = pageDesc || DEFAULT_DESCRIPTION;
	const secureImage = props.featuredImage || DEFAULT_FEATURED_IMAGE;

	// İndekslenmemesi gereken sayfalar (NoIndex)
	const noIndexPaths = ['/settings', '/sessions', '/force-log-out'];
	const shouldNoIndex = noIndexPaths.some((p) => currentPath.startsWith(p));

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
			{props.children}
		</Helmet>
	);
}
