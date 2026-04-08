import React from 'react';
import {useTranslation} from 'react-i18next';
import {resourceUri} from '../../util/storage';
import block from '../../styles/bem';
import HeroCube from '../landing/welcome/hero_section/HeroCube';
import './MaintenancePage.scss';

const b = block('maintenance');

export default function MaintenancePage() {
	const {t} = useTranslation();

	return (
		<div className={b()}>
			<div className={b('content')}>
				<img src={resourceUri('/images/zkt-logo.png')} alt="Zkt-Timer" className={b('logo')} />
				<div className={b('cube-wrapper')}>
					<HeroCube />
				</div>
				<h1 className={b('title')}>{t('maintenance.title')}</h1>
				<p className={b('description')}>{t('maintenance.description')}</p>
				<div className={b('progress')}>
					<div className={b('progress-fill')} />
				</div>
				<p className={b('footer')}>{t('maintenance.thanks')}</p>
			</div>
		</div>
	);
}
