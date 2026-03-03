import React from 'react';
import {useTranslation} from 'react-i18next';
import './MobileGrid.scss';
import block from '../../../../styles/bem';
import { useInView } from '../hooks/useInView';

const b = block('welcome-mobile-grid');

const MOBILE_SCREENS = [
	{ src: '/public/welcome/mobile/timer_mobile.png', labelKey: 'welcome_mobile.label_timer' },
	{ src: '/public/welcome/mobile/solves_mobile.png', labelKey: 'welcome_mobile.label_solves' },
	{ src: '/public/welcome/mobile/smartcube_timer_mobile.png', labelKey: 'welcome_mobile.label_smart_cube' },
	{ src: '/public/welcome/mobile/setting_mobile.png', labelKey: 'welcome_mobile.label_settings' }
];

export default function MobileGrid() {
	const { ref, isInView } = useInView({ threshold: 0.1, triggerOnce: true });
	const {t} = useTranslation();

	return (
		<section ref={ref as any} className={b({ visible: isInView })}>
			<div className={b('container')}>
				<div className={b('header')}>
					<h2 className={b('title')}>{t('welcome_mobile.title')}</h2>
					<p className={b('description')}>
						{t('welcome_mobile.description')}
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
