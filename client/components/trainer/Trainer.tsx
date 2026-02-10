import React from 'react';
import './Trainer.scss';
import { Cube, Gear, Clock, Lightning } from 'phosphor-react';
import PageTitle from '../common/page_title/PageTitle';
import block from '../../styles/bem';
import Header from '../layout/header/Header';
import { useLocation } from 'react-router-dom';

const b = block('trainer');

export default function Trainer() {
	const location = useLocation();

	return (
		<div className={b()}>
			<Header title="Zkt-Timer | Algoritma Öğreticisi" path={location.pathname} />
			<PageTitle pageName="Trainer" />
			<div className={b('coming-soon')}>
				{/* Hero Section */}
				<div className={b('hero')}>
					<div className={b('hero__animation')}>
						<div className={b('cube-container')}>
							<Cube size={120} className={b('cube-icon')} />
							<div className={b('floating-icons')}>
								<Gear size={24} className={b('icon', { gear: true })} />
								<Clock size={24} className={b('icon', { clock: true })} />
								<Lightning size={24} className={b('icon', { lightning: true })} />
							</div>
						</div>
					</div>

					<div className={b('content')}>
						<h1 className={b('title')}>
							<span className={b('title-line')}>Algoritma Eğiticisi</span>
							<span className={b('title-line', { highlight: true })}>Coming Soon!</span>
						</h1>

						<p className={b('description')}>
							Bu sayfa çok yakında kullanıma açılacak! 🚀
							F2, OLL, PLL, ZBLL ve daha fazla algoritma seti, akıllı küp desteği ve gelişmiş
							performans izleme özellikleri yakında!
						</p>

						<div className={b('features')}>
							<div className={b('feature')}>
								<div className={b('feature__icon')}>
									<Cube size={32} />
								</div>
								<div className={b('feature__content')}>
									<h3>Kapsamlı Algoritma Koleksiyonu</h3>
									<p>OLL, PLL, ZBLL ve daha fazla algoritma seti</p>
								</div>
							</div>

							<div className={b('feature')}>
								<div className={b('feature__icon')}>
									<Lightning size={32} />
								</div>
								<div className={b('feature__content')}>
									<h3>Akıllı Küp Entegrasyonu</h3>
									<p>GAN akıllı küp desteği ile gerçek zamanlı analiz</p>
								</div>
							</div>

							<div className={b('feature')}>
								<div className={b('feature__icon')}>
									<Clock size={32} />
								</div>
								<div className={b('feature__content')}>
									<h3>Gelişmiş Performans İzleme</h3>
									<p>Detaylı istatistikler ve ilerleme takibi</p>
								</div>
							</div>
						</div>

						<div className={b('progress')}>
							<div className={b('progress__bar')}>
								<div className={b('progress__fill')}></div>
							</div>
							<p className={b('progress__text')}>Geliştirme İlerlemesi: %75</p>
						</div>
					</div>
				</div>

				{/* Footer */}
				<div className={b('footer')}>
					<p>Bu sayfa çok yakında kullanıma açılacak! 🚀</p>
				</div>
			</div>
		</div>
	);
}
