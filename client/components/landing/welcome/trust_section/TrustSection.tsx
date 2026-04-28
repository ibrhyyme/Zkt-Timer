import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import './TrustSection.scss';
import block from '../../../../styles/bem';
import { useTranslation } from 'react-i18next';

if (typeof window !== 'undefined') {
	gsap.registerPlugin(ScrollTrigger);
}

const b = block('welcome-trust');

export default function TrustSection() {
	const { t } = useTranslation();
	const sectionRef = useRef<HTMLElement>(null);
	const bgRef = useRef<HTMLDivElement>(null);
	const headerRef = useRef<HTMLDivElement>(null);
	const statsRef = useRef<HTMLDivElement>(null);

	const STATS = [
		{ value: 5000, suffix: '+', label: 'Cuber' },
		{ value: 250000, suffix: '+', label: t('trust_section.solves') },
		{ value: 17, suffix: '', label: t('trust_section.cube_type') },
		{ value: 50, suffix: '+', label: t('trust_section.countries') },
	];

	useEffect(() => {
		const section = sectionRef.current;
		const bg = bgRef.current;
		const header = headerRef.current;
		const stats = statsRef.current;
		if (!section) return;

		const tweens: gsap.core.Tween[] = [];

		// Parallax background — GSAP scrub (smoother than JS-driven)
		if (bg) {
			tweens.push(
				gsap.to(bg, {
					y: -80,
					ease: 'none',
					scrollTrigger: {
						trigger: section,
						start: 'top bottom',
						end: 'bottom top',
						scrub: 1.5,
					},
				})
			);
		}

		// Header entrance
		if (header) {
			tweens.push(
				gsap.fromTo(
					header,
					{ opacity: 0, y: 40 },
					{
						opacity: 1,
						y: 0,
						duration: 0.8,
						ease: 'power3.out',
						scrollTrigger: {
							trigger: section,
							start: 'top 75%',
							toggleActions: 'play none none none',
						},
					}
				)
			);
		}

		// Animated counters
		if (stats) {
			const counterEls = stats.querySelectorAll('[data-counter]');
			counterEls.forEach((el) => {
				const target = parseInt(el.getAttribute('data-counter') || '0', 10);
				const suffix = el.getAttribute('data-suffix') || '';
				const obj = { val: 0 };

				tweens.push(
					gsap.to(obj, {
						val: target,
						duration: 2,
						ease: 'power2.out',
						scrollTrigger: {
							trigger: stats,
							start: 'top 80%',
							toggleActions: 'play none none none',
						},
						onUpdate() {
							const formatted = target >= 1000
								? Math.floor(obj.val).toLocaleString('tr-TR')
								: Math.floor(obj.val).toString();
							el.textContent = formatted + suffix;
						},
					})
				);
			});

			// Stats card entrance
			const cards = stats.querySelectorAll('[data-stat-card]');
			if (cards.length) {
				tweens.push(
					gsap.fromTo(
						cards,
						{ opacity: 0, y: 30, scale: 0.9 },
						{
							opacity: 1,
							y: 0,
							scale: 1,
							duration: 0.6,
							stagger: 0.1,
							ease: 'back.out(1.2)',
							scrollTrigger: {
								trigger: stats,
								start: 'top 80%',
								toggleActions: 'play none none none',
							},
						}
					)
				);
			}
		}

		return () => {
			tweens.forEach((tw) => {
				tw.scrollTrigger?.kill();
				tw.kill();
			});
		};
	}, []);

	return (
		<section ref={sectionRef} className={b()}>
			<div ref={bgRef} className={b('background')}>
				<img src="/public/welcome/web/wca_records.jpeg" alt="WCA Records" loading="lazy" />
				<div className={b('overlay')} />
			</div>

			<div className={b('content')}>
				<div className={b('container')}>
					<div ref={headerRef} className={b('header')} style={{ opacity: 0 }}>
						<h2 className={b('title')}>{t('trust_section.title')}</h2>
						<p className={b('description')}>
							{t('trust_section.description')}
						</p>
					</div>

					<div ref={statsRef} className={b('stats')}>
						{STATS.map((stat, i) => (
							<div key={i} className={b('stat-card')} data-stat-card style={{ opacity: 0 }}>
								<span
									className={b('stat-value')}
									data-counter={stat.value}
									data-suffix={stat.suffix}
								>
									0{stat.suffix}
								</span>
								<span className={b('stat-label')}>{stat.label}</span>
							</div>
						))}
					</div>
				</div>
			</div>
		</section>
	);
}
