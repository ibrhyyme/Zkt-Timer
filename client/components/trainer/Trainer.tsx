import React from 'react';
import './Trainer.scss';
import { Cube, Gear, Clock, Lightning } from 'phosphor-react';
import PageTitle from '../common/page_title/PageTitle';
import block from '../../styles/bem';
import Header from '../layout/header/Header';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const b = block('trainer');

export default function Trainer() {
	const { t } = useTranslation();
	const location = useLocation();

	return (
		<div className={b()}>
			<Header title={t('trainer.page_title')} path={location.pathname} />
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
							<span className={b('title-line')}>{t('trainer.title')}</span>
							<span className={b('title-line', { highlight: true })}>{t('trainer.coming_soon')}</span>
						</h1>

						<p className={b('description')}>
							{t('trainer.description')}
						</p>

						<div className={b('features')}>
							<div className={b('feature')}>
								<div className={b('feature__icon')}>
									<Cube size={32} />
								</div>
								<div className={b('feature__content')}>
									<h3>{t('trainer.feature_algorithms_title')}</h3>
									<p>{t('trainer.feature_algorithms_desc')}</p>
								</div>
							</div>

							<div className={b('feature')}>
								<div className={b('feature__icon')}>
									<Lightning size={32} />
								</div>
								<div className={b('feature__content')}>
									<h3>{t('trainer.feature_smart_cube_title')}</h3>
									<p>{t('trainer.feature_smart_cube_desc')}</p>
								</div>
							</div>

							<div className={b('feature')}>
								<div className={b('feature__icon')}>
									<Clock size={32} />
								</div>
								<div className={b('feature__content')}>
									<h3>{t('trainer.feature_performance_title')}</h3>
									<p>{t('trainer.feature_performance_desc')}</p>
								</div>
							</div>
						</div>

						<div className={b('progress')}>
							<div className={b('progress__bar')}>
								<div className={b('progress__fill')}></div>
							</div>
							<p className={b('progress__text')}>{t('trainer.progress_text')}</p>
						</div>
					</div>
				</div>

				{/* Footer */}
				<div className={b('footer')}>
					<p>{t('trainer.footer')}</p>
				</div>
			</div>
		</div>
	);
}
