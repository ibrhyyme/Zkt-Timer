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

	return (
		<>
			<Helmet>
				<title>ZKT-Timer - Profesyonel Speedcubing Timer</title>
				<meta
					name="description"
					content="ZKT-Timer ile speedcubing becerilerinizi geliştirin. Bulut tabanlı istatistikler, gerçek zamanlı yarışmalar, akıllı küp desteği ve profesyonel zamanlama. Türkiye'nin en hızlı speedcubing topluluğuna katılın."
				/>
				<meta
					name="keywords"
					content="speedcubing, zeka küpü, rubik küp, timer, WCA, akıllı küp, bluetooth küp, online timer, cubing timer, zkt timer"
				/>

				{/* Open Graph */}
				<meta property="og:title" content="ZKT-Timer - Profesyonel Speedcubing Timer" />
				<meta property="og:description" content="Profesyonel araçlarla speedcubing becerilerinizi geliştirin" />
				<meta property="og:image" content="/public/welcome/web/timer.jpeg" />
				<meta property="og:type" content="website" />

				{/* Twitter Card */}
				<meta name="twitter:card" content="summary_large_image" />
				<meta name="twitter:title" content="ZKT-Timer - Profesyonel Speedcubing Timer" />
				<meta name="twitter:description" content="Profesyonel araçlarla speedcubing becerilerinizi geliştirin" />
				<meta name="twitter:image" content="/public/welcome/web/timer.jpeg" />
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
