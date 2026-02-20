import React from 'react';
import {useTranslation} from 'react-i18next';
import './FeaturesSection.scss';
import block from '../../../../styles/bem';
import FeatureItem from './feature_item/FeatureItem';
import { Timer, ChartLine, Bluetooth, Users } from 'phosphor-react';

const b = block('welcome-features');

export default function FeaturesSection() {
	const {t} = useTranslation();

	const FEATURES = [
		{
			title: t('features.timer_title'),
			description: t('features.timer_desc'),
			bullets: [
				t('features.timer_bullet_1'),
				t('features.timer_bullet_2'),
				t('features.timer_bullet_3')
			],
			image: '/public/welcome/web/timer.jpeg',
			imageAlt: t('features.timer_alt'),
			position: 'left' as const,
			color: '#246bfd',
			icon: Timer
		},
		{
			title: t('features.stats_title'),
			description: t('features.stats_desc'),
			bullets: [
				t('features.stats_bullet_1'),
				t('features.stats_bullet_2'),
				t('features.stats_bullet_3')
			],
			image: '/public/welcome/web/stasts.jpeg',
			imageAlt: t('features.stats_alt'),
			position: 'right' as const,
			color: '#66bb6a',
			icon: ChartLine
		},
		{
			title: t('features.smart_cube_title'),
			description: t('features.smart_cube_desc'),
			bullets: [
				t('features.smart_cube_bullet_1'),
				t('features.smart_cube_bullet_2'),
				t('features.smart_cube_bullet_3')
			],
			image: '/public/welcome/web/smart_cube_timer.jpeg',
			imageAlt: t('features.smart_cube_alt'),
			position: 'left' as const,
			color: '#42a5f5',
			icon: Bluetooth
		},
		{
			title: t('features.rooms_title'),
			description: t('features.rooms_desc'),
			bullets: [
				t('features.rooms_bullet_1'),
				t('features.rooms_bullet_2'),
				t('features.rooms_bullet_3')
			],
			image: '/public/welcome/web/Rooms.jpeg',
			imageAlt: t('features.rooms_alt'),
			position: 'right' as const,
			color: '#ef6c00',
			icon: Users
		}
	];
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
