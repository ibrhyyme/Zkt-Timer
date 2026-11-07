import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Fire } from 'phosphor-react';
import { getSetting } from '../../../db/settings/query';
import { markFeatureTipSeen } from '../../../lib/feature_tips/store';
import { getWarmupThreshold } from '../../../lib/warmup/auto_save';
import { getTimeString } from '../../../util/time';
import { isWarmupActive, useWarmup } from '../../../lib/warmup/store';
import block from '../../../styles/bem';
import { displayTimerAlert } from '../helpers/notification';
import { sweepWarmup, toggleWarmup } from '../helpers/warmup';
import './WarmupToggle.scss';

const b = block('warmup-toggle');

const SWEEP_INTERVAL_MS = 60 * 1000;

interface Props {
	/** The phone: an icon-only segment inside the strip. Otherwise a control of its own beside it. */
	compact?: boolean;
}

export default function WarmupToggle(props: Props) {
	const { t } = useTranslation();
	const { active } = useWarmup();

	useEffect(() => {
		const sweep = () => sweepWarmup();
		const sweepWhenVisible = () => {
			if (!document.hidden) sweep();
		};

		sweep();
		const interval = setInterval(sweep, SWEEP_INTERVAL_MS);
		// Timers stop in a sleeping phone or a hidden tab; this catches the return.
		document.addEventListener('visibilitychange', sweepWhenVisible);

		return () => {
			clearInterval(interval);
			document.removeEventListener('visibilitychange', sweepWhenVisible);
		};
	}, []);

	function handleClick() {
		if (toggleWarmup() && isWarmupActive()) {
			markFeatureTipSeen('warmup_mode');
			displayTimerAlert({ text: warmupOnNotice(), backgroundColor: 'orange' });
		}
	}

	/** What the mode will keep, for the bucket on the timer right now. */
	function warmupOnNotice(): string {
		const mode = getSetting('warmup_auto_save');
		if (mode === 'off') return t('warmup.on_notice');

		const threshold =
			mode === 'threshold'
				? getWarmupThreshold(
						getSetting('warmup_auto_save_thresholds'),
						getSetting('cube_type'),
						getSetting('scramble_subset')
					)
				: null;
		if (threshold === null) return t('warmup.on_notice_auto_pb');
		return t('warmup.on_notice_auto_threshold', { time: getTimeString(threshold, 2) });
	}

	const title = active ? t('warmup.turn_off') : t('warmup.turn_on');

	return (
		<button
			type="button"
			className={b({ active, compact: props.compact, lone: !props.compact })}
			aria-pressed={active}
			aria-label={title}
			title={title}
			onClick={handleClick}
		>
			<Fire weight={active ? 'fill' : 'bold'} />
			{!props.compact && <span>{t('warmup.label')}</span>}
		</button>
	);
}
