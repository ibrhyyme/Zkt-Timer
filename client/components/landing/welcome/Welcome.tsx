import React from 'react';
import { Helmet } from 'react-helmet';
import HeroSection from './hero_section/HeroSection';
import FeaturesSection from './features_section/FeaturesSection';
import MobileGrid from './mobile_grid/MobileGrid';
import PartnersSection from './partners_section/PartnersSection';
import WelcomeFooter from './welcome_footer/WelcomeFooter';
import './Welcome.scss';

import { useMe } from '../../../util/hooks/useMe';
import { useHistory } from 'react-router-dom';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { getStructuredData, SITE_URL, DEFAULT_KEYWORDS } from '../../layout/header/Header';

export default function Welcome() {
	const me = useMe();
	const history = useHistory();
	const { t } = useTranslation();

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
	const ogImage = `${SITE_URL}/public/welcome/web/timer.jpeg`;

	const { websiteSchema, organizationSchema, softwareSchema, navigationSchema, faqSchema } = getStructuredData('/', title, desc);

	return (
		<>
			<Helmet>
				<title>{title}</title>
				<meta name="description" content={desc} />
				<meta name="keywords" content={DEFAULT_KEYWORDS} />
				<meta name="author" content="ZKT Timer" />
				<link rel="canonical" href={`${SITE_URL}/`} />

				{/* Open Graph */}
				<meta property="og:title" content={title} />
				<meta property="og:description" content={desc} />
				<meta property="og:image" content={ogImage} />
				<meta property="og:image:secure_url" content={ogImage} />
				<meta property="og:image:width" content="1200" />
				<meta property="og:image:height" content="630" />
				<meta property="og:url" content={`${SITE_URL}/`} />
				<meta property="og:site_name" content="ZKT Timer - Zeka Küpü Timer" />
				<meta property="og:type" content="website" />
				<meta property="og:locale" content="tr_TR" />

				{/* Twitter Card */}
				<meta name="twitter:card" content="summary_large_image" />
				<meta name="twitter:title" content={title} />
				<meta name="twitter:description" content={desc} />
				<meta name="twitter:image" content={ogImage} />
				<meta name="twitter:url" content={`${SITE_URL}/`} />

				{/* JSON-LD Structured Data */}
				<script type="application/ld+json">{JSON.stringify(websiteSchema)}</script>
				<script type="application/ld+json">{JSON.stringify(organizationSchema)}</script>
				<script type="application/ld+json">{JSON.stringify(softwareSchema)}</script>
				<script type="application/ld+json">{JSON.stringify(navigationSchema)}</script>
				{faqSchema && <script type="application/ld+json">{JSON.stringify(faqSchema)}</script>}
			</Helmet>

			<div className="cd-welcome min-h-screen bg-[#050505] text-white">
				<HeroSection />
				<FeaturesSection />
				<MobileGrid />
				<PartnersSection />
				<WelcomeFooter />
			</div>
		</>
	);
}
