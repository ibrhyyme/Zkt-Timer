import React from 'react';
import {useTranslation} from 'react-i18next';
import block from '../../../styles/bem';
import {getTimeString} from '../../../util/time';
import {getStorageURL} from '../../../util/storage';
import {ROUNDS_TO_WIN} from '../../../../shared/battle/config';
import {penaltyMs, plusTwoCount} from '../../../../shared/battle/rules';
import {BATTLE_PROGRESS_STEPS, BattleProgressStep, OpponentStatePayload} from '../../../../shared/battle/events';
import type {BattlePenalty} from '../../../../shared/battle/types';

const b = block('online-battle');

/**
 * Avatar as an <img> src. The server may send a storage path (the leaderboard rows do) or a
 * full URL; a path goes through getStorageURL like every other profile picture.
 */
export function avatarSrc(avatar: string | null | undefined): string | null {
	if (!avatar) return null;
	if (/^(https?:|data:|blob:)/i.test(avatar)) return avatar;
	return getStorageURL(avatar);
}

/** Formats a battle time with its penalty in: "12.84", "14.84+" (+2), "16.84++" (+4), "DNF". */
export function formatBattleTime(timeMs: number | null | undefined, penalty: BattlePenalty | null | undefined): string {
	if (penalty === 'DNF' || timeMs == null) return 'DNF';
	return getTimeString((timeMs + penaltyMs(penalty)) / 1000, 2) + '+'.repeat(plusTwoCount(penalty));
}

/** Rounds won as cube stickers, one per round needed to take the match. */
export function Pips({score}: {score: number}) {
	const pips = [];
	for (let i = 0; i < ROUNDS_TO_WIN; i++) {
		pips.push(<span key={i} className={b('pip', {won: i < score})} />);
	}
	return (
		<span className={b('pips')} aria-label={String(score)}>
			{pips}
		</span>
	);
}

const STEP_GROUPS: {label: string; steps: BattleProgressStep[]}[] = [
	{label: 'Cross', steps: ['cross']},
	{label: 'F2L', steps: ['f2l_1', 'f2l_2', 'f2l_3', 'f2l_4']},
	{label: 'OLL', steps: ['oll']},
	{label: 'PLL', steps: ['pll']},
];

/** Cross, F2L 1-4, OLL, PLL; everything up to the reported step is done. */
export function PhaseBar({step, finished}: {step?: BattleProgressStep | null; finished?: boolean}) {
	const reached = finished ? BATTLE_PROGRESS_STEPS.length : step ? BATTLE_PROGRESS_STEPS.indexOf(step) + 1 : 0;
	return (
		<div className={b('phases')}>
			{STEP_GROUPS.map((group) => {
				const done = group.steps.filter((s) => BATTLE_PROGRESS_STEPS.indexOf(s) < reached).length;
				// Label above, a thin track below: the filled colour never carries text.
				return (
					<span key={group.label} className={b('phase', {done: done === group.steps.length})}>
						<span className={b('phase-label')}>{group.label}</span>
						<span className={b('phase-track')}>
							{group.steps.map((s, i) => (
								<span key={s} className={b('phase-seg', {done: i < done})} />
							))}
						</span>
					</span>
				);
			})}
		</div>
	);
}

interface OpponentBarProps {
	state: OpponentStatePayload | null;
	/** Local clock of the opponent's solve start, for the live time. */
	solvingSinceLocal: number | null;
	now: number;
	connected: boolean;
	/** Seconds left of the opponent's disconnect grace. */
	graceLeftSec: number | null;
}

/**
 * The opponent's lane (design 5.4): what they are doing, their time and how far they got.
 * Who they are sits on the scoreboard above. A compact strip on a phone, the right-hand
 * column on a desktop.
 */
export default function OpponentBar(props: OpponentBarProps) {
	const {t} = useTranslation();
	const {state, solvingSinceLocal, now, connected, graceLeftSec} = props;

	let status: string | null = null;
	let time: string | null = null;
	if (!connected) {
		// Once the grace has run out there is nothing left to wait for: "0 s" read as stuck.
		status =
			graceLeftSec != null && graceLeftSec > 0
				? t('online_battle.opponent_disconnected', {seconds: graceLeftSec})
				: t('online_battle.opponent_disconnected_short');
	} else if (state?.phase === 'scrambling') {
		status = t('online_battle.opponent_scrambling');
	} else if (state?.phase === 'inspecting') {
		status = t('online_battle.opponent_inspecting');
	} else if (state?.phase === 'solving') {
		status = t('online_battle.opponent_solving');
		if (solvingSinceLocal != null) time = getTimeString(Math.max(0, now - solvingSinceLocal) / 1000, 1);
	} else if (state?.phase === 'finished') {
		status = t('online_battle.opponent_finished');
		if (state.timeMs !== undefined) time = formatBattleTime(state.timeMs, state.penalty);
	} else {
		status = t('online_battle.opponent_scrambling');
	}

	return (
		<div className={b('opponent', {offline: !connected, [state?.phase || 'scrambling']: connected})}>
			<span className={b('eyebrow')}>{t('online_battle.opponent')}</span>
			<span className={b('opponent-status')}>{status}</span>
			<span className={b('opponent-time')} lang="en">
				{time || ' '}
			</span>
			<PhaseBar step={state?.step} finished={state?.phase === 'finished'} />
		</div>
	);
}
