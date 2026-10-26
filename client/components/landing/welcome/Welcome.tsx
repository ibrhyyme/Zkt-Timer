import React from 'react';
import { Helmet } from 'react-helmet';
import HeroSection from './hero_section/HeroSection';
import ReelSection from './reel_section/ReelSection';
import ChaptersSection from './chapters_section/ChaptersSection';
import WcaSection from './wca_section/WcaSection';
import InsideSection from './inside_section/InsideSection';
import MobileGrid from './mobile_grid/MobileGrid';
import WelcomeFooter from './welcome_footer/WelcomeFooter';
import {useScrollProgress} from './hooks/useScrollProgress';
import './Welcome.scss';

import { useMe } from '../../../util/hooks/useMe';
import { useHistory } from 'react-router-dom';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { getStructuredData, SITE_URL, getPageKeywords, OG_LOCALE_MAP, renderLanguageAlternates } from '../../layout/header/Header';
import { FALLBACK_LANGUAGE, matchSupportedLanguage } from '../../../../shared/i18n_language';
import { localizedPath } from '../../../../shared/seo_language';

export default function Welcome() {
	const me = useMe();
	const history = useHistory();
	const { t, i18n } = useTranslation();
	// The bar is written to directly; see useScrollProgress for why this is not state.
	const progressRef = useRef<HTMLDivElement>(null);
	useScrollProgress(progressRef);

	useEffect(() => {
		if (me) {
			history.replace('/timer');
		}
	}, [me, history]);

	// Prevent flashing content if user is logged in
	if (me) {
		return null;
	}

	const title = t('seo.home_title');
	const desc = t('seo.home_description');
	const keywords = getPageKeywords('/', t);
	// 1200x630 exactly, matching the og:image:width/height declared below. The old
	// timer.jpeg was 1661x1036, so the ratio it advertised was never the one it had.
	const ogImage = `${SITE_URL}/public/welcome/web/og-card.jpeg`;

	const lang = matchSupportedLanguage(i18n.language) || FALLBACK_LANGUAGE;
	// "/" for English, /welcome?lang=tr for a translation (shared/seo_language.ts).
	const pageUrl = `${SITE_URL}${localizedPath('/', lang)}`;
	// No faqSchema here: the FAQ answers are rendered on /help, and that is where
	// the FAQPage markup now lives.
	const { websiteSchema, organizationSchema, softwareSchema, navigationSchema } = getStructuredData('/', title, desc, t, lang);

	return (
		<>
			<Helmet>
				<title>{title}</title>
				<meta name="description" content={desc} />
				<meta name="keywords" content={keywords} />
				<meta name="author" content="Zkt Timer" />
				<link rel="canonical" href={pageUrl} />
				{renderLanguageAlternates('/')}

				{/* Open Graph */}
				<meta property="og:title" content={title} />
				<meta property="og:description" content={desc} />
				<meta property="og:image" content={ogImage} />
				<meta property="og:image:secure_url" content={ogImage} />
				<meta property="og:image:width" content="1200" />
				<meta property="og:image:height" content="630" />
				<meta property="og:url" content={pageUrl} />
				<meta property="og:site_name" content="Zkt Timer" />
				<meta property="og:type" content="website" />
				<meta property="og:locale" content={OG_LOCALE_MAP[lang] || 'en_US'} />

				{/* Twitter Card */}
				<meta name="twitter:card" content="summary_large_image" />
				<meta name="twitter:title" content={title} />
				<meta name="twitter:description" content={desc} />
				<meta name="twitter:image" content={ogImage} />
				<meta name="twitter:url" content={pageUrl} />

				{/* JSON-LD Structured Data */}
				<script type="application/ld+json">{JSON.stringify(websiteSchema)}</script>
				<script type="application/ld+json">{JSON.stringify(organizationSchema)}</script>
				<script type="application/ld+json">{JSON.stringify(softwareSchema)}</script>
				<script type="application/ld+json">{JSON.stringify(navigationSchema)}</script>
			</Helmet>

			<div className="zt-welcome min-h-screen bg-[#050505] text-white">
				<div
					ref={progressRef}
					className="zt-welcome__scroll-progress"
				/>
				<HeroSection />
				<ReelSection />
				<ChaptersSection />
				<WcaSection />
				<InsideSection />
				<MobileGrid />
				<WelcomeFooter />
			</div>
		</>
	);
}
