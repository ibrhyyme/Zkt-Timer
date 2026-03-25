import React, { useEffect, useRef } from 'react';
import { useHistory } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import './HeroSection.scss';
import block from '../../../../styles/bem';
import Button from '../../../common/button/Button';
import LanguageSwitcher from '../../../common/language_switcher/LanguageSwitcher';
import { staggerContainer, fadeInUp, fadeInScale, hoverScale, tapScale } from '../motion-variants';

if (typeof window !== 'undefined') {
	gsap.registerPlugin(ScrollTrigger);
}

const b = block('welcome-hero');

export default function HeroSection() {
	const history = useHistory();
	const { t } = useTranslation();
	const mockupRef = useRef<HTMLDivElement>(null);
	const orbLeftRef = useRef<HTMLDivElement>(null);
	const orbRightRef = useRef<HTMLDivElement>(null);

	// GSAP: Device mockup scroll parallax + orb movement
	useEffect(() => {
		if (!mockupRef.current) return;

		const tweens: gsap.core.Tween[] = [];

		// Device mockup: subtle scale down + parallax on scroll
		tweens.push(
			gsap.to(mockupRef.current, {
				y: -60,
				scale: 0.95,
				ease: 'none',
				scrollTrigger: {
					trigger: mockupRef.current,
					start: 'top 60%',
					end: 'bottom top',
					scrub: 1.5,
				},
			})
		);

		// Left orb: parallax drift
		if (orbLeftRef.current) {
			tweens.push(
				gsap.to(orbLeftRef.current, {
					y: -120,
					x: 30,
					ease: 'none',
					scrollTrigger: {
						trigger: orbLeftRef.current,
						start: 'top bottom',
						end: 'bottom top',
						scrub: 2,
					},
				})
			);
		}

		// Right orb: parallax drift opposite direction
		if (orbRightRef.current) {
			tweens.push(
				gsap.to(orbRightRef.current, {
					y: -80,
					x: -40,
					ease: 'none',
					scrollTrigger: {
						trigger: orbRightRef.current,
						start: 'top bottom',
						end: 'bottom top',
						scrub: 2,
					},
				})
			);
		}

		return () => {
			tweens.forEach((tw) => {
				tw.scrollTrigger?.kill();
				tw.kill();
			});
		};
	}, []);

	return (
		<section className={b()}>
			{/* Background Ambience */}
			<div className={b('background')}>
				<div ref={orbLeftRef} className={b('background-orb', { position: 'left' })} />
				<div ref={orbRightRef} className={b('background-orb', { position: 'right' })} />
				<div className={b('background-noise')} />
			</div>

			{/* Mobile Language Switcher */}
			<div className={b('mobile-lang')}>
				<LanguageSwitcher />
			</div>

			{/* Hero Content — Framer Motion staggered entrance */}
			<motion.div
				className={b('content')}
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
				<motion.h1 className={b('title')} variants={fadeInUp}>
					{t('welcome_hero.title_start')}{' '}
					<span className={b('title-highlight')}>
						{t('welcome_hero.title_highlight')}
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

				{/* Device Mockup — GSAP scroll parallax */}
				<motion.div
					className={b('device-mockup')}
					variants={fadeInUp}
				>
					<div ref={mockupRef}>
						{/* Desktop (Mac) Frame */}
						<div className={b('device-mockup-desktop')}>
							<img
								src="/public/welcome/web/timer.jpeg"
								alt="ZKT-Timer Desktop Interface"
								loading="eager"
							/>
						</div>

						{/* Mobile (iPhone) Frame */}
						<div className={b('device-mockup-mobile')}>
							<img
								src="/public/welcome/mobile/timer_mobile.png"
								alt="ZKT-Timer Mobile Interface"
								loading="eager"
							/>
						</div>
					</div>
				</motion.div>
			</motion.div>
		</section>
	);
}
