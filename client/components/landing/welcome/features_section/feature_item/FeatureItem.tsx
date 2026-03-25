import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import './FeatureItem.scss';
import block from '../../../../../styles/bem';
import type { Icon } from 'phosphor-react';

if (typeof window !== 'undefined') {
	gsap.registerPlugin(ScrollTrigger);
}

const b = block('welcome-feature-item');

interface FeatureItemProps {
	title: string;
	description: string;
	bullets?: string[];
	image: string;
	imageAlt: string;
	position: 'left' | 'right';
	color: string;
	icon?: Icon;
}

export default function FeatureItem(props: FeatureItemProps) {
	const {
		title,
		description,
		bullets,
		image,
		imageAlt,
		position,
		color,
		icon: IconComponent,
	} = props;

	const containerRef = useRef<HTMLDivElement>(null);
	const textRef = useRef<HTMLDivElement>(null);
	const imageRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const container = containerRef.current;
		const textEl = textRef.current;
		const imageEl = imageRef.current;
		if (!container || !textEl || !imageEl) return;

		const tweens: gsap.core.Tween[] = [];

		// Container fade in
		tweens.push(
			gsap.fromTo(
				container,
				{ opacity: 0 },
				{
					opacity: 1,
					duration: 0.4,
					scrollTrigger: {
						trigger: container,
						start: 'top 85%',
						toggleActions: 'play none none none',
					},
				}
			)
		);

		// Text: slide in from left
		tweens.push(
			gsap.fromTo(
				textEl,
				{ opacity: 0, x: position === 'left' ? -60 : 60 },
				{
					opacity: 1,
					x: 0,
					duration: 0.8,
					ease: 'power3.out',
					scrollTrigger: {
						trigger: container,
						start: 'top 80%',
						toggleActions: 'play none none none',
					},
				}
			)
		);

		// Image: scale + clip-path reveal
		tweens.push(
			gsap.fromTo(
				imageEl,
				{
					opacity: 0,
					scale: 0.85,
					clipPath: position === 'left'
						? 'inset(10% 30% 10% 0%)'
						: 'inset(10% 0% 10% 30%)',
				},
				{
					opacity: 1,
					scale: 1,
					clipPath: 'inset(0% 0% 0% 0%)',
					duration: 1,
					ease: 'power3.out',
					scrollTrigger: {
						trigger: container,
						start: 'top 75%',
						toggleActions: 'play none none none',
					},
				}
			)
		);

		// Staggered bullets
		const bulletEls = textEl.querySelectorAll(`.${b('bullet').split(' ').join('.')}`);
		if (bulletEls.length) {
			tweens.push(
				gsap.fromTo(
					bulletEls,
					{ opacity: 0, x: -20 },
					{
						opacity: 1,
						x: 0,
						duration: 0.5,
						stagger: 0.1,
						ease: 'power2.out',
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
	}, [position]);

	return (
		<div ref={containerRef} className={b({ position })} style={{ opacity: 0 }}>
			<div ref={textRef} className={b('text')}>
				{IconComponent && (
					<div className={b('icon')} style={{ color }}>
						<IconComponent size={48} weight="duotone" />
					</div>
				)}
				<h2 className={b('title')}>{title}</h2>
				<p className={b('description')}>{description}</p>
				{bullets && bullets.length > 0 && (
					<ul className={b('bullets')}>
						{bullets.map((bullet, index) => (
							<li key={index} className={b('bullet')}>
								<span className={b('bullet-icon')} style={{ color }}>
									&#10003;
								</span>
								{bullet}
							</li>
						))}
					</ul>
				)}
			</div>

			<div ref={imageRef} className={b('image-wrapper')}>
				<div
					className={b('image-glow')}
					style={{ background: `radial-gradient(circle,${color}40,transparent)` }}
				/>
				<img
					src={image}
					alt={imageAlt}
					className={b('image')}
					loading="lazy"
				/>
			</div>
		</div>
	);
}
