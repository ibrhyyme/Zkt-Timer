import React from 'react';
import {useTranslation} from 'react-i18next';
import block from '../../../styles/bem';
import {getTimeString} from '../../../util/time';
import {getStorageURL} from '../../../util/storage';
import {ROUNDS_TO_WIN} from '../../../../shared/battle/config';
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

/** Formats a battle time: "12.84", "14.03+", "DNF". */
export function formatBattleTime(timeMs: number | null | undefined, penalty: BattlePenalty | null | undefined): string {
	if (penalty === 'DNF' || timeMs == null) return 'DNF';
	const base = getTimeString(timeMs / 1000, 2);
	return penalty === 'PLUS_TWO' ? `${getTimeString((timeMs + 2000) / 1000, 2)}+` : base;
}

interface PlayerLineProps {
	name: string;
	avatar?: string | null;
	rating: number;
	provisional: boolean;
	score: number;
	self?: boolean;
}

/** Avatar, name, rating and the round dots of one player. */
export function PlayerLine({name, avatar, rating, provisional, score, self}: PlayerLineProps) {
	const {t} = useTranslation();
	const src = avatarSrc(avatar);
	const dots = [];
	for (let i = 0; i < ROUNDS_TO_WIN; i++) {
		dots.push(<span key={i} className={b('dot', {won: i < score})} />);
	}
	return (
		<div className={b('player', {self: !!self})}>
			<span className={b('avatar')}>
				{src ? <img src={src} alt="" /> : <span>{(name || '?').charAt(0).toUpperCase()}</span>}
			</span>
			<span className={b('player-name')}>{name}</span>
			<span className={b('player-rating')} title={provisional ? t('online_battle.provisional') : undefined}>
				{rating}
				{provisional && <span className={b('provisional')}>?</span>}
			</span>
			<span className={b('dots')} aria-label={String(score)}>
				{dots}
			</span>
		</div>
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
	name: string;
	avatar: string | null;
	rating: number;
	provisional: boolean;
	score: number;
	state: OpponentStatePayload | null;
	/** Local clock of the opponent's solve start, for the live time. */
	solvingSinceLocal: number | null;
	now: number;
	connected: boolean;
	/** Seconds left of the opponent's disconnect grace. */
	graceLeftSec: number | null;
}

/** The opponent: who, how far, and what they are doing right now (design 5.4). */
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
	}

	return (
		<div className={b('opponent', {offline: !connected})}>
			<PlayerLine
				name={props.name}
				avatar={props.avatar}
				rating={props.rating}
				provisional={props.provisional}
				score={props.score}
			/>
			<PhaseBar step={state?.step} finished={state?.phase === 'finished'} />
			<div className={b('opponent-status')}>
				<span>{status || ' '}</span>
				{time && <span className={b('opponent-time')}>{time}</span>}
			</div>
		</div>
	);
}
