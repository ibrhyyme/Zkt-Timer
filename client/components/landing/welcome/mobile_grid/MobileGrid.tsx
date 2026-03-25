import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import './MobileGrid.scss';
import block from '../../../../styles/bem';

if (typeof window !== 'undefined') {
	gsap.registerPlugin(ScrollTrigger);
}

const b = block('welcome-mobile-grid');

const MOBILE_SCREENS = [
	{ src: '/public/welcome/mobile/timer_mobile.png', labelKey: 'welcome_mobile.label_timer' },
	{ src: '/public/welcome/mobile/solves_mobile.png', labelKey: 'welcome_mobile.label_solves' },
	{ src: '/public/welcome/mobile/smartcube_timer_mobile.png', labelKey: 'welcome_mobile.label_smart_cube' },
	{ src: '/public/welcome/mobile/setting_mobile.png', labelKey: 'welcome_mobile.label_settings' },
];

export default function MobileGrid() {
	const containerRef = useRef<HTMLElement>(null);
	const headerRef = useRef<HTMLDivElement>(null);
	const { t } = useTranslation();

	useEffect(() => {
		const container = containerRef.current;
		const header = headerRef.current;
		if (!container) return;

		const tweens: gsap.core.Tween[] = [];

		// Header fade in
		if (header) {
			tweens.push(
				gsap.fromTo(
					header,
					{ opacity: 0, y: 40 },
					{
						opacity: 1,
						y: 0,
						duration: 0.7,
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

		// Phone items: stagger with rotation
		const items = container.querySelectorAll('[data-grid-item]');
		if (items.length) {
			tweens.push(
				gsap.fromTo(
					items,
					{ opacity: 0, y: 60, rotation: 3, scale: 0.9 },
					{
						opacity: 1,
						y: 0,
						rotation: 0,
						scale: 1,
						duration: 0.8,
						stagger: 0.12,
						ease: 'back.out(1.4)',
						scrollTrigger: {
							trigger: container,
							start: 'top 75%',
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
				<div ref={headerRef} className={b('header')} style={{ opacity: 0 }}>
					<h2 className={b('title')}>{t('welcome_mobile.title')}</h2>
					<p className={b('description')}>{t('welcome_mobile.description')}</p>
				</div>

				<div className={b('grid')}>
					{MOBILE_SCREENS.map((screen, index) => (
						<div key={index} className={b('item')} data-grid-item style={{ opacity: 0 }}>
							<div className={b('phone-frame')}>
								<img src={screen.src} alt={t(screen.labelKey)} loading="lazy" />
							</div>
							<p className={b('label')}>{t(screen.labelKey)}</p>
						</div>
					))}
				</div>
			</div>
		</section>
	);
}
