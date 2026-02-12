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

import { getStructuredData, SITE_URL, DEFAULT_TITLE, DEFAULT_DESCRIPTION, DEFAULT_FEATURED_IMAGE, DEFAULT_KEYWORDS } from '../../layout/header/Header';

export default function Welcome() {
	const me = useMe();
	const history = useHistory();

	useEffect(() => {
		if (me) {
			history.replace('/timer');
		}
	}, [me, history]);

	// Prevent flashing content if user is logged in
	if (me) {
		return null;
	}

	const title = "ZKT-Timer - Profesyonel Speedcubing Timer";
	const desc = "ZKT-Timer ile speedcubing becerilerinizi geliştirin. Bulut tabanlı istatistikler, gerçek zamanlı yarışmalar, akıllı küp desteği ve profesyonel zamanlama. Türkiye'nin en hızlı speedcubing topluluğuna katılın.";

	const { websiteSchema, organizationSchema, softwareSchema, navigationSchema, faqSchema } = getStructuredData('/', title, desc);

	return (
		<>
			<Helmet>
				<title>{title}</title>
				<meta name="description" content={desc} />
				<meta name="keywords" content={DEFAULT_KEYWORDS} />

				{/* Open Graph */}
				<meta property="og:title" content={title} />
				<meta property="og:description" content="Profesyonel araçlarla speedcubing becerilerinizi geliştirin" />
				<meta property="og:image" content="/public/welcome/web/timer.jpeg" />
				<meta property="og:type" content="website" />

				{/* Twitter Card */}
				<meta name="twitter:card" content="summary_large_image" />
				<meta name="twitter:title" content={title} />
				<meta name="twitter:description" content="Profesyonel araçlarla speedcubing becerilerinizi geliştirin" />
				<meta name="twitter:image" content="/public/welcome/web/timer.jpeg" />

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
