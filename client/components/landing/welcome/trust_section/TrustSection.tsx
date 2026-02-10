import React from 'react';
import './TrustSection.scss';
import block from '../../../../styles/bem';
import { useParallax } from '../hooks/useParallax';
import { useInView } from '../hooks/useInView';

const b = block('welcome-trust');

export default function TrustSection() {
	const parallaxOffset = useParallax(0.3);
	const { ref, isInView } = useInView({ threshold: 0.2, triggerOnce: true });

	return (
		<section ref={ref as any} className={b({ visible: isInView })}>
			<div
				className={b('background')}
				style={{ transform: `translateY(${parallaxOffset}px)` }}
			>
				<img src="/public/welcome/web/wca_records.jpeg" alt="WCA Records" loading="lazy" />
				<div className={b('overlay')} />
			</div>

			<div className={b('content')}>
				<div className={b('container')}>
					<div className={b('header')}>
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
