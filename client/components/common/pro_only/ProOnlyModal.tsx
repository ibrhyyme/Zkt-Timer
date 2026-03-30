import React from 'react';
import {useTranslation} from 'react-i18next';
import {useHistory} from 'react-router-dom';
import {useDispatch} from 'react-redux';
import {closeModal} from '../../../actions/general';
import {Crown, Check, ArrowRight} from 'phosphor-react';
import block from '../../../styles/bem';
import './ProOnlyModal.scss';

const b = block('pro-only-modal');

const DEFAULT_HIGHLIGHTS = ['sync', 'themes', 'advanced_stats'] as const;

const FEATURE_HIGHLIGHTS: Record<string, readonly string[]> = {
	room_music: ['music_youtube', 'music_friends', 'music_unlimited'],
	leaderboard: ['leaderboard_publish', 'leaderboard_profile', 'leaderboard_compete'],
	data_import: ['import_history', 'import_sources', 'import_one_click'],
	smart_cube: ['smart_analysis', 'smart_steps', 'smart_animation'],
	themes: ['themes_six', 'themes_colors', 'themes_atmosphere'],
	stats: ['stats_blocks', 'stats_charts', 'stats_customize'],
	trainer: ['trainer_ble', 'trainer_feedback', 'trainer_speed'],
};

interface Props {
	featureKey?: string;
}

export default function ProOnlyModal({featureKey}: Props) {
	const {t} = useTranslation();
	const history = useHistory();
	const dispatch = useDispatch();

	const highlights = featureKey && FEATURE_HIGHLIGHTS[featureKey]
		? FEATURE_HIGHLIGHTS[featureKey]
		: DEFAULT_HIGHLIGHTS;

	const title = featureKey
		? t(`pro.modal.${featureKey}.title`, {defaultValue: t('pro.feature_title')})
		: t('pro.feature_title');

	const description = featureKey
		? t(`pro.modal.${featureKey}.desc`, {defaultValue: t('pro.feature_description')})
		: t('pro.feature_description');

	function handleUpgrade() {
		dispatch(closeModal());
		history.push('/account/pro');
	}

	return (
		<div className={b()}>
			<div className={b('icon')}>
				<Crown weight="fill" />
			</div>

			<h2 className={b('title')}>{title}</h2>
			<p className={b('desc')}>{description}</p>

			<div className={b('highlights')}>
				{highlights.map((key) => (
					<div key={key} className={b('highlight')}>
						<Check weight="bold" />
						<span>{t(`pro.highlights.${key}`)}</span>
					</div>
				))}
			</div>

			<button type="button" className={b('cta')} onClick={handleUpgrade}>
				<span>{t('pro.upgrade_button')}</span>
				<ArrowRight weight="bold" />
			</button>
		</div>
	);
}
