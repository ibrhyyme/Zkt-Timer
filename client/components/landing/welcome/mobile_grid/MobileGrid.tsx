import React, { useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import './MobileGrid.scss';
import block from '../../../../styles/bem';
import { landingAsset } from '../../../../util/api-base';
import { APP_STORE_URL, PLAY_STORE_URL } from '../../../../util/store-links';
import { isNative } from '../../../../util/platform';
import NotationHeading from '../notation_heading/NotationHeading';

if (typeof window !== 'undefined') {
	gsap.registerPlugin(ScrollTrigger);
}

const b = block('welcome-mobile-grid');

// Timer, stats and trainer are iPhone captures from the owner's account (September
// 2026); the battle round was played and captured on 2026-09-30 after its redesign.
const MOBILE_SCREENS = [
	{ src: '/public/welcome/v2/phone-timer.webp', labelKey: 'welcome_mobile.label_timer' },
	{ src: '/public/welcome/v2/phone-stats.webp', labelKey: 'welcome_mobile.label_stats' },
	{ src: '/public/welcome/v2/phone-trainer.webp', labelKey: 'seo.nav_trainer_name' },
	{ src: '/public/welcome/v2/phone-battle.webp', labelKey: 'seo.nav_battle_name' },
];

const TILT_MAX = 15; // degrees

export default function MobileGrid() {
	const containerRef = useRef<HTMLElement>(null);
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
		if (!container) return;
		// The phones are visible by default; with reduced motion they simply stay put.
		if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

		const tweens: gsap.core.Tween[] = [];

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
				<div className={b('header')}>
					<NotationHeading className={b('title')} text={t('welcome_mobile.title')} />
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
								<img
									src={landingAsset(screen.src)}
									alt={t(screen.labelKey)}
									loading="lazy"
									decoding="async"
									width={640}
									height={1387}
								/>
							</div>
							<p className={b('label')}>{t(screen.labelKey)}</p>
						</div>
					))}
				</div>

				{/* The page's closing call: the same two badges as the hero. Hidden inside
				    the native app, which is already the app. */}
				{!isNative() && (
					<div className={b('stores')}>
						<a href={APP_STORE_URL} target="_blank" rel="noopener noreferrer" className={b('store')}>
							<img src="/public/images/landing/app-store-badge.svg" alt={t('welcome_hero.app_store_alt')} />
						</a>
						<a href={PLAY_STORE_URL} target="_blank" rel="noopener noreferrer" className={b('store')}>
							<img src="/public/images/landing/google-play-badge.svg" alt={t('welcome_hero.google_play_alt')} />
						</a>
					</div>
				)}
			</div>
		</section>
	);
}
