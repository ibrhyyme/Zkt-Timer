import React from 'react';
import {useTranslation} from 'react-i18next';
import {useHistory} from 'react-router-dom';
import {useDispatch} from 'react-redux';
import {closeModal} from '../../../actions/general';
import {Crown, Check, ArrowRight} from 'phosphor-react';
import block from '../../../styles/bem';
import './ProOnlyModal.scss';

const b = block('pro-only-modal');

// `advanced_stats` used to sit here, but nothing gates it: the stats blocks are open
// to everyone and only the module customization editor is Pro. Sell that instead.
const DEFAULT_HIGHLIGHTS = ['sync', 'themes', 'stats_customize'] as const;

// Keyed by the `featureKey` callers pass. Where a key matches a registry entry in
// client/lib/pro_features.ts, the two must stay spelled the same: `record_alerts` was
// called `competition_watch` here while the Pro page called it `record_alerts`, and
// nothing connected them. The data-import entry is gone with the feature, which turned
// out not to be gated on either side.
const FEATURE_HIGHLIGHTS: Record<string, readonly string[]> = {
	room_music: ['music_youtube', 'music_friends', 'music_unlimited'],
	leaderboard: ['leaderboard_publish', 'leaderboard_profile', 'leaderboard_compete'],
	smart_cube: ['smart_analysis', 'smart_steps', 'smart_animation'],
	themes: ['themes_six', 'themes_colors', 'themes_atmosphere'],
	stats: ['stats_blocks', 'stats_charts', 'stats_customize'],
	trainer: ['trainer_ble', 'trainer_feedback', 'trainer_speed'],
	trainer_pdf: ['pdf_professional', 'pdf_alternatives', 'pdf_stats'],
	competition_follow: ['follow_realtime', 'follow_limit'],
	record_alerts: ['watch_records', 'watch_scope', 'watch_push'],
	slam_to_stop: ['slam_drop', 'slam_calibrate', 'slam_stackmat'],
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
		history.push('/pro');
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
