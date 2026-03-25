import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import './TrustSection.scss';
import block from '../../../../styles/bem';

if (typeof window !== 'undefined') {
	gsap.registerPlugin(ScrollTrigger);
}

const b = block('welcome-trust');

export default function TrustSection() {
	const sectionRef = useRef<HTMLElement>(null);
	const bgRef = useRef<HTMLDivElement>(null);
	const headerRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const section = sectionRef.current;
		const bg = bgRef.current;
		const header = headerRef.current;
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
						<h2 className={b('title')}>WCA Uyumlu & Güncel</h2>
						<p className={b('description')}>
							Ulusal ve Dünya rekorlarına anında erişin. Resmi WCA karıştırmaları ile güncel kalın.
						</p>
					</div>
				</div>
			</div>
		</section>
	);
}
