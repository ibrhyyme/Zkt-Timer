import React, { useEffect, useState } from 'react';
import { useHistory } from 'react-router-dom';
import './HeroSection.scss';
import block from '../../../../styles/bem';
import Button from '../../../common/button/Button';

const b = block('welcome-hero');

export default function HeroSection() {
	const history = useHistory();

	return (
		<section className={b()}>
			{/* Background Ambience */}
			<div className={b('background')}>
				<div className={b('background-orb', { position: 'left' })} />
				<div className={b('background-orb', { position: 'right' })} />
				<div className={b('background-noise')} />
			</div>

			{/* Hero Content */}
			<div className={b('content')}>
				{/* Logo */}
				<img
					src="/public/images/zkt-logo.png"
					alt="ZKT-Timer Logo"
					className={b('logo')}
				/>

				{/* Headline */}
				<h1 className={b('title')}>
					Türkiye'nin en gelişmiş <span className={b('title-highlight')}>zeka küpü platformu</span>
				</h1>

				{/* Subheadline */}
				<p className={b('description')}>
					Profesyonel zamanlayıcı, detaylı analizler ve canlı yarışmalarla potansiyelini açığa çıkar.
				</p>

				{/* CTA Buttons */}
				<div className={b('actions')}>
					<Button
						primary
						large
						glow
						onClick={() => history.push('/timer')}
					>
						Timer'ı Başlat →
					</Button>
				</div>

				{/* Device Mockup */}
				<div className={b('device-mockup')}>
					{/* Desktop (Mac) Frame */}
					<div className={b('device-mockup-desktop')}>
						<img
							src="/public/welcome/web/timer.jpeg"
							alt="ZKT-Timer Desktop Interface"
							loading="eager"
						/>
					</div>

					{/* Mobile (iPhone) Frame */}
					<div className={b('device-mockup-mobile')}>
						<img
							src="/public/welcome/mobile/timer_mobile.png"
							alt="ZKT-Timer Mobile Interface"
							loading="eager"
						/>
					</div>
				</div>
			</div>
		</section>
	);
}
