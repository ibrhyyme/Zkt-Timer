import React from 'react';
import {useTranslation} from 'react-i18next';
import {useHistory} from 'react-router-dom';
import {Wrench, ArrowLeft} from 'phosphor-react';
import block from '../../../styles/bem';
import './PageDisabled.scss';

const b = block('page-disabled');

interface Props {
	pageName: string;
}

export default function PageDisabled({pageName}: Props) {
	const {t} = useTranslation();
	const history = useHistory();

	return (
		<div className={b()}>
			<div className={b('content')}>
				<div className={b('icon-wrapper')}>
					<Wrench size={48} weight="fill" className={b('icon')} />
				</div>
				<h2 className={b('title')}>{t('site_config.page_disabled_title', {page: pageName})}</h2>
				<p className={b('description')}>{t('site_config.page_disabled_description')}</p>
				<button className={b('back-btn')} onClick={() => history.push('/timer')}>
					<ArrowLeft size={16} />
					{t('site_config.go_to_timer')}
				</button>
			</div>
		</div>
	);
}
