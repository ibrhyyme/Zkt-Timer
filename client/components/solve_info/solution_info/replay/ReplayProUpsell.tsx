import React from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory } from 'react-router-dom';
import { Crown, Play } from 'phosphor-react';
import block from '../../../../styles/bem';

const b = block('replay-pro-upsell');

export default function ReplayProUpsell() {
	const { t } = useTranslation();
	const history = useHistory();

	function handleUpgrade() {
		history.push('/pro');
	}

	return (
		<div className={b()}>
			<div className={b('icon-wrap')}>
				<Crown size={36} weight="fill" />
			</div>
			<div className={b('title')}>{t('solve_info.replay.pro_required_title')}</div>
			<div className={b('desc')}>{t('solve_info.replay.pro_required_desc')}</div>
			<div className={b('preview')}>
				<Play size={48} weight="fill" />
			</div>
			<button className={b('cta')} onClick={handleUpgrade}>
				{t('solve_info.replay.upgrade_cta')}
			</button>
		</div>
	);
}
