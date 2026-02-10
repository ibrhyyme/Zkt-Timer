import React from 'react';
import './FeaturesSection.scss';
import block from '../../../../styles/bem';
import FeatureItem from './feature_item/FeatureItem';
import { Timer, ChartLine, Bluetooth, Users } from 'phosphor-react';

const b = block('welcome-features');

const FEATURES = [
	{
		title: 'Kusursuz Zamanlayıcı',
		description:
			'Sade, dikkat dağıtmayan ve milisaniye hassasiyetinde çalışan bir arayüz. Keyboard shortcutları ile tam kontrol elinizde.',
		bullets: [
			'Gecikmesiz başlatma',
			'Özelleştirilebilir görünüm',
			'WCA Scramble algoritmaları'
		],
		image: '/public/welcome/web/timer.jpeg',
		imageAlt: 'Timer Arayüzü',
		position: 'left' as const,
		color: '#246bfd',
		icon: Timer
	},
	{
		title: 'Detaylı İstatistikler',
		description:
			'Gelişiminizi grafiklerle takip edin. PB\'lerinizi, ortalamalarınızı (AO5, AO12, AO100) ve trendlerinizi görün.',
		bullets: ['PB takibi', 'AO5/AO12/AO100', 'Trend analizi'],
		image: '/public/welcome/web/stasts.jpeg',
		imageAlt: 'İstatistik Paneli',
		position: 'right' as const,
		color: '#66bb6a',
		icon: ChartLine
	},
	{
		title: 'Akıllı Küp Desteği',
		description:
			'Bluetooth özellikli küpünüzü bağlayın ve hamlelerinizi, TPS\'inizi ve dönüş hatalarınızı analiz edin.',
		bullets: ['Hamle analizi', 'TPS takibi', 'Dönüş doğruluğu'],
		image: '/public/welcome/web/smart_cube_timer.jpeg',
		imageAlt: 'Akıllı Küp Entegrasyonu',
		position: 'left' as const,
		color: '#42a5f5',
		icon: Bluetooth
	},
	{
		title: 'Rekabetçi Odalar',
		description:
			'Arkadaşlarınızla özel odalar kurun veya herkese açık odalarda yarışın. Canlı sıralama ve anlık sohbet.',
		bullets: ['Özel odalar', 'Canlı liderlik tablosu', 'Anlık sohbet'],
		image: '/public/welcome/web/Rooms.jpeg',
		imageAlt: 'Çok Oyunculu Odalar',
		position: 'right' as const,
		color: '#ef6c00',
		icon: Users
	}
];

export default function FeaturesSection() {
	return (
		<section className={b()}>
			<div className={b('container')}>
				{FEATURES.map((feature, index) => (
					<FeatureItem key={index} {...feature} />
				))}
			</div>
		</section>
	);
}
