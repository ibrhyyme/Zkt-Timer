import React, { useEffect, useRef, useCallback } from 'react';
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

const TILT_MAX = 15; // degrees

export default function MobileGrid() {
	const containerRef = useRef<HTMLElement>(null);
	const headerRef = useRef<HTMLDivElement>(null);
	const { t } = useTranslation();

	const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
		const el = e.currentTarget;
		const rect = el.getBoundingClientRect();
		const x = (e.clientX - rect.left) / rect.width;
		const y = (e.clientY - rect.top) / rect.height;

		const rotateY = (x - 0.5) * TILT_MAX * 2;
		const rotateX = (0.5 - y) * TILT_MAX * 2;

		el.style.transform = `perspective(600px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.03, 1.03, 1.03)`;

		// Inner image parallax
		const img = el.querySelector('img') as HTMLImageElement;
		if (img) {
			img.style.transform = `translateX(${(x - 0.5) * 6}px) translateY(${(y - 0.5) * 6}px)`;
		}
	}, []);

	const handleMouseLeave = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
		const el = e.currentTarget;
		el.style.transform = '';
		const img = el.querySelector('img') as HTMLImageElement;
		if (img) {
			img.style.transform = '';
		}
	}, []);

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
				<div ref={headerRef} className={b('header')}>
					<h2 className={b('title')}>{t('welcome_mobile.title')}</h2>
					<p className={b('description')}>{t('welcome_mobile.description')}</p>
				</div>

				<div className={b('grid')}>
					{MOBILE_SCREENS.map((screen, index) => (
						<div key={index} className={b('item')} data-grid-item>
							<div
								className={b('phone-frame')}
								onMouseMove={handleMouseMove}
								onMouseLeave={handleMouseLeave}
							>
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
