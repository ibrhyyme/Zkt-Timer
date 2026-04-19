import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import './PartnersSection.scss';
import block from '../../../../styles/bem';
import { hoverLift, tapScale } from '../motion-variants';

if (typeof window !== 'undefined') {
	gsap.registerPlugin(ScrollTrigger);
}

const b = block('welcome-partners');

interface Partner {
	name: string;
	logo: string;
	descriptionKey: string;
	category: 'official' | 'timer' | 'smart-cube';
}

const PARTNERS: Partner[] = [
	{
		name: 'WCA',
		logo: '/public/partners/wca.png',
		descriptionKey: 'welcome_partners.wca_desc',
		category: 'official',
	},
	{
		name: 'GAN Timer',
		logo: '/public/partners/gan-timer.png',
		descriptionKey: 'welcome_partners.gan_timer_desc',
		category: 'timer',
	},
	{
		name: 'StackMat',
		logo: '/public/partners/stackmat.png',
		descriptionKey: 'welcome_partners.stackmat_desc',
		category: 'timer',
	},
	{
		name: 'GAN Cube',
		logo: '/public/partners/gan.png',
		descriptionKey: 'welcome_partners.gan_cube_desc',
		category: 'smart-cube',
	},
	{
		name: 'MoYu',
		logo: '/public/partners/moyu.png',
		descriptionKey: 'welcome_partners.moyu_desc',
		category: 'smart-cube',
	},
];

export default function PartnersSection() {
	const containerRef = useRef<HTMLElement>(null);
	const headerRef = useRef<HTMLDivElement>(null);
	const { t } = useTranslation();

	const CATEGORY_LABELS: Record<string, string> = {
		official: t('welcome_partners.category_official'),
		timer: t('welcome_partners.category_timer'),
		'smart-cube': t('welcome_partners.category_smart_cube'),
	};

	useEffect(() => {
		const container = containerRef.current;
		const header = headerRef.current;
		if (!container) return;

		const tweens: gsap.core.Tween[] = [];

		// Header
		if (header) {
			tweens.push(
				gsap.fromTo(
					header,
					{ opacity: 0, y: 50 },
					{
						opacity: 1,
						y: 0,
						duration: 0.8,
						ease: 'power3.out',
						scrollTrigger: {
							trigger: container,
							start: 'top 85%',
							toggleActions: 'play none none none',
						},
					}
				)
			);
		}

		// Cards stagger entrance
		const cards = container.querySelectorAll('[data-partner-card]');
		if (cards.length) {
			tweens.push(
				gsap.fromTo(
					cards,
					{ opacity: 0, y: 50, scale: 0.9 },
					{
						opacity: 1,
						y: 0,
						scale: 1,
						duration: 0.7,
						stagger: 0.1,
						ease: 'back.out(1.2)',
						scrollTrigger: {
							trigger: container,
							start: 'top 70%',
							toggleActions: 'play none none none',
						},
					}
				)
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
		<section ref={containerRef} className={b()}>
			<div className={b('container')}>
				<div ref={headerRef} className={b('header')}>
					<h2 className={b('title')}>{t('welcome_partners.title')}</h2>
					<p className={b('description')}>{t('welcome_partners.description')}</p>
				</div>

				<div className={b('grid')}>
					{PARTNERS.map((partner) => (
						<motion.div
							key={partner.name}
							className={b('card', { category: partner.category })}
							data-partner-card
							whileHover={hoverLift}
							whileTap={tapScale}
						>
							<div className={b('card-badge')}>
								{CATEGORY_LABELS[partner.category]}
							</div>
							<div className={b('card-logo')}>
								<img
									src={partner.logo}
									alt={`${partner.name} - ${t(partner.descriptionKey)} - Zkt Timer`}
									loading="lazy"
								/>
							</div>
							<h3 className={b('card-name')}>{partner.name}</h3>
							<p className={b('card-description')}>
								{t(partner.descriptionKey)}
							</p>
						</motion.div>
					))}
				</div>
			</div>
		</section>
	);
}
