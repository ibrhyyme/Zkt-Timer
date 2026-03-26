import React from 'react';
import { useHistory } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import './HeroSection.scss';
import block from '../../../../styles/bem';
import Button from '../../../common/button/Button';
import LanguageSwitcher from '../../../common/language_switcher/LanguageSwitcher';
import HeroCube from './HeroCube';
import ParticleCanvas from './ParticleCanvas';
import TextType from '../text_type/TextType';
import { staggerContainer, fadeInUp, fadeInScale, fadeInLeft, fadeInRight, hoverScale, tapScale } from '../motion-variants';

const b = block('welcome-hero');

export default function HeroSection() {
	const history = useHistory();
	const { t } = useTranslation();

	return (
		<section className={b()}>
			{/* Particle Background */}
			<ParticleCanvas />

			{/* Background Ambience */}
			<div className={b('background')}>
				<div className={b('background-orb', { position: 'left' })} />
				<div className={b('background-orb', { position: 'right' })} />
			</div>

			{/* Mobile Language Switcher */}
			<div className={b('mobile-lang')}>
				<LanguageSwitcher />
			</div>

			{/* Hero Content — 2-column layout */}
			<div className={b('content')}>
				{/* Text Side */}
				<motion.div
					className={b('text-side')}
					variants={staggerContainer}
					initial="hidden"
					animate="visible"
				>
					{/* Logo */}
					<motion.img
						src="/public/images/zkt-logo.png"
						alt="ZKT-Timer Logo"
						className={b('logo')}
						variants={fadeInScale}
					/>

					{/* Headline */}
					<motion.h1 className={b('title')} variants={fadeInLeft}>
						{t('welcome_hero.title_start')}{' '}
						<span className={b('title-highlight')}>
							<TextType
								text={[
									t('welcome_hero.title_highlight'),
									t('welcome_hero.title_highlight_2'),
									t('welcome_hero.title_highlight_3'),
								]}
								typingSpeed={60}
								deletingSpeed={35}
								pauseDuration={2500}
								initialDelay={1200}
								loop
								showCursor
								cursorCharacter="|"
							/>
						</span>
					</motion.h1>

					{/* Subheadline */}
					<motion.p className={b('description')} variants={fadeInUp}>
						{t('welcome_hero.description')}
					</motion.p>

					{/* Desktop CTA */}
					<motion.div className={b('actions-desktop')} variants={fadeInUp}>
						<motion.div whileHover={hoverScale} whileTap={tapScale}>
							<Button
								primary
								large
								glow
								onClick={() => history.push('/timer')}
							>
								{t('welcome_hero.cta_start')}
							</Button>
						</motion.div>
					</motion.div>

					{/* Mobile CTA */}
					<motion.div className={b('actions-mobile')} variants={fadeInUp}>
						<motion.div whileHover={hoverScale} whileTap={tapScale}>
							<Button
								large
								glow
								onClick={() => (window.location.href = '/signup')}
							>
								{t('welcome_hero.cta_signup')}
							</Button>
						</motion.div>
						<motion.div whileHover={hoverScale} whileTap={tapScale}>
							<Button
								primary
								large
								glow
								onClick={() => (window.location.href = '/login')}
							>
								{t('welcome_hero.cta_login')}
							</Button>
						</motion.div>
					</motion.div>
				</motion.div>

				{/* Cube Side */}
				<motion.div
					className={b('cube-side')}
					variants={fadeInRight}
					initial="hidden"
					animate="visible"
				>
					<HeroCube />
				</motion.div>
			</div>

			{/* Scroll Indicator */}
			<motion.div
				className={b('scroll-indicator')}
				initial={{ opacity: 0 }}
				animate={{ opacity: 1 }}
				transition={{ delay: 1.5, duration: 0.8 }}
			>
				<div className={b('scroll-arrow')} />
			</motion.div>
		</section>
	);
}
