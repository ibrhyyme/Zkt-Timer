import React from 'react';
import './FeatureItem.scss';
import block from '../../../../../styles/bem';
import { useInView } from '../../hooks/useInView';
import type { Icon } from 'phosphor-react';

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
		icon: IconComponent
	} = props;

	const { ref, isInView } = useInView({ threshold: 0.2, triggerOnce: true });

	return (
		<div ref={ref as any} className={b({ position, visible: isInView })}>
			<div className={b('text')}>
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
									✓
								</span>
								{bullet}
							</li>
						))}
					</ul>
				)}
			</div>

			<div className={b('image-wrapper')}>
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
