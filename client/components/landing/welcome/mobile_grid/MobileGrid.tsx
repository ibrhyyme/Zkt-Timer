import React from 'react';
import './MobileGrid.scss';
import block from '../../../../styles/bem';
import { useInView } from '../hooks/useInView';

const b = block('welcome-mobile-grid');

const MOBILE_SCREENS = [
	{ src: '/public/welcome/mobile/timer_mobile.png', label: 'Zamanlayıcı' },
	{ src: '/public/welcome/mobile/solves_mobile.png', label: 'Çözümler' },
	{ src: '/public/welcome/mobile/smartcube_timer_mobile.png', label: 'Smart Cube' },
	{ src: '/public/welcome/mobile/setting_mobile.png', label: 'Ayarlar' }
];

export default function MobileGrid() {
	const { ref, isInView } = useInView({ threshold: 0.1, triggerOnce: true });

	return (
		<section ref={ref as any} className={b({ visible: isInView })}>
			<div className={b('container')}>
				<div className={b('header')}>
					<h2 className={b('title')}>Her Zaman Yanınızda</h2>
					<p className={b('description')}>
						Mobil uyumlu arayüzü ile ZKT-Timer'ı her yerden kullanabilirsiniz. Uygulama
						indirmeye gerek yok.
					</p>
				</div>

				<div className={b('grid')}>
					{MOBILE_SCREENS.map((screen, index) => (
						<div
							key={index}
							className={b('item')}
							style={{ animationDelay: `${(index * 0.1).toFixed(1)}s` }}
						>
							<div className={b('phone-frame')}>
								<img src={screen.src} alt={screen.label} loading="lazy" />
							</div>
							<p className={b('label')}>{screen.label}</p>
						</div>
					))}
				</div>
			</div>
		</section>
	);
}
