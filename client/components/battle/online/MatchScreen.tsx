import React, {useEffect, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {ArrowsClockwise, BatteryMedium, CheckSquare} from 'phosphor-react';
import block from '../../../styles/bem';
import Button from '../../common/button/Button';
import {getTimeString} from '../../../util/time';
import ScrambleMoveList from '../../timer/time_display/timer_scramble/smart_scramble/ScrambleMoveList';
import SmartCubeView, {SmartCubeViewHandle} from '../../timer/smart_cube/cube_view/SmartCubeView';
import {INSPECTION_DNF_SEC, INSPECTION_SEC} from '../../../../shared/battle/config';
import {inspectionPenalty} from '../../../../shared/battle/rules';
import type {MatchStatus} from '../../../util/smart_cube/solve_engine';
import OpponentBar, {PlayerLine, formatBattleTime} from './OpponentBar';
import {OnlineMatchView, otherSide, outcomeFor, sideScore, sideSolve} from './battle_state';
import type {BattleCubePhase, BattleCubeSolve} from './useBattleCube';

const b = block('online-battle');

export interface MatchCubeView {
	connected: boolean;
	connecting: boolean;
	reconnecting: boolean;
	battery: number | null;
	gyroSupported: boolean;
	/** The 3D mirror; the cube hook replays it on engine re-anchors and "mark solved". */
	viewRef: React.RefObject<SmartCubeViewHandle>;
	phase: BattleCubePhase;
	matchStatus: MatchStatus[];
	undoMoves: string[] | null;
	outOfSync: boolean;
	scrambleDoneAt: number | null;
	solveStartedAt: number | null;
	solve: BattleCubeSolve | null;
	markSolved(): void;
	resetGyro(): void;
	/** Open the picker again after the link was lost for good. */
	connect(): void;
}

interface Props {
	match: OnlineMatchView;
	myName: string;
	myAvatar: string | null;
	cube: MatchCubeView;
	/** Server clock to local clock. */
	toLocal(serverMs: number): number;
	/** The player's first match ever: the scramble screen explains itself once. */
	firstMatch: boolean;
	useBlueMatch: boolean;
	onGiveUp(): void;
}

/** Re-renders every `ms` while active; returns Date.now(). */
function useTicker(active: boolean, ms: number): number {
	const [now, setNow] = useState(() => Date.now());
	useEffect(() => {
		if (!active) return;
		setNow(Date.now());
		const id = setInterval(() => setNow(Date.now()), ms);
		return () => clearInterval(id);
	}, [active, ms]);
	return active ? now : Date.now();
}

/**
 * Size of the 3D mirror. SmartCubeView takes pixels, and the match screen must fit without
 * scrolling, so it follows the viewport: a share of the height, capped by the width on a
 * phone and by a fixed size on a desktop.
 */
function useCubeSize(): number {
	const read = () =>
		typeof window === 'undefined'
			? 120
			: window.innerWidth >= 1024
				? Math.round(Math.max(120, Math.min(window.innerHeight * 0.26, 230)))
				: Math.round(Math.max(80, Math.min(window.innerWidth * 0.34, window.innerHeight * 0.17, 150)));
	const [size, setSize] = useState(read);
	useEffect(() => {
		const onResize = () => setSize(read());
		window.addEventListener('resize', onResize);
		return () => window.removeEventListener('resize', onResize);
	}, []);
	return size;
}

/**
 * One round on the player's own phone (design 5.4): the opponent on top, the scramble and
 * the big time in the middle, the player and "Give up" at the bottom. Side by side on a
 * desktop. Never scrolls.
 */
export default function MatchScreen({match, myName, myAvatar, cube, toLocal, firstMatch, useBlueMatch, onGiveUp}: Props) {
	const {t} = useTranslation();
	const now = useTicker(true, 100);
	const cubeSize = useCubeSize();
	const {matched, current, opponent} = match;
	const side = matched.side;
	const opp = otherSide(side);
	const myScore = sideScore(match.score, side);
	const oppScore = sideScore(match.score, opp);

	const roundOver = !!(match.lastRoundResult && current && match.lastRoundResult.round === current.round);
	const goAtLocal = current ? toLocal(current.goAt) : null;
	const scrambleDeadlineLocal = current ? toLocal(current.scrambleDeadline) : null;

	// ── The middle of the screen ──
	let headline: string | null = null;
	let bigTime: string | null = null;
	let bigMod: string | null = null;
	let showScramble = false;
	let note: string | null = null;

	if (!current) {
		const startsIn = Math.ceil((toLocal(matched.startsAt) - now) / 1000);
		headline = t('online_battle.opponent_found');
		bigTime = startsIn > 0 ? String(startsIn) : null;
		bigMod = 'count';
	} else if (roundOver && match.lastRoundResult) {
		const result = match.lastRoundResult;
		const outcome = outcomeFor(result.winner, side);
		headline =
			outcome === 'won'
				? t('online_battle.round_won')
				: outcome === 'lost'
					? t('online_battle.round_lost')
					: t('online_battle.round_draw');
		const mine = sideSolve(result, side);
		bigTime = formatBattleTime(mine.timeMs, mine.penalty);
		bigMod = outcome;
		const theirs = sideSolve(result, opp);
		note = `${matched.opponent.username}: ${formatBattleTime(theirs.timeMs, theirs.penalty)}`;
	} else if (goAtLocal != null && now < goAtLocal) {
		headline = t('online_battle.round', {n: current.round});
		// The scramble opens on both screens at goAt, not before.
		bigTime = String(Math.max(1, Math.ceil((goAtLocal - now) / 1000)));
		bigMod = 'count';
	} else if (cube.phase === 'inspecting') {
		const elapsed = cube.scrambleDoneAt != null ? now - cube.scrambleDoneAt : 0;
		const penalty = inspectionPenalty(elapsed);
		headline = t('online_battle.inspect');
		if (penalty === 'DNF') bigTime = 'DNF';
		else if (penalty === 'PLUS_TWO') bigTime = '+2';
		else bigTime = String(Math.max(1, Math.ceil(INSPECTION_SEC - elapsed / 1000)));
		bigMod = penalty ? 'late' : 'inspect';
		showScramble = false;
		if (elapsed > INSPECTION_DNF_SEC * 1000) note = t('online_battle.inspection_dnf');
	} else if (cube.phase === 'solving') {
		bigTime = getTimeString(Math.max(0, now - (cube.solveStartedAt || now)) / 1000, 1);
		bigMod = 'running';
	} else if (cube.phase === 'done') {
		if (cube.solve) {
			bigTime = formatBattleTime(cube.solve.timeMs, cube.solve.penalty);
			bigMod = 'final';
		}
		// What the opponent is actually doing. This always said "solving", so it read "Opponent
		// solving" right above a panel saying the opponent was still inspecting. No state yet
		// means the opponent has not finished scrambling.
		const oppPhase = opponent?.phase;
		headline =
			oppPhase === 'finished'
				? null
				: oppPhase === 'solving'
					? t('online_battle.opponent_solving')
					: oppPhase === 'inspecting'
						? t('online_battle.opponent_inspecting')
						: t('online_battle.opponent_scrambling');
	} else {
		headline = t('online_battle.scramble_your_cube');
		showScramble = true;
		if (firstMatch) note = t('online_battle.scramble_hint_first');
		if (scrambleDeadlineLocal != null) {
			const left = Math.ceil((scrambleDeadlineLocal - now) / 1000);
			if (left <= 20 && left >= 0) note = t('online_battle.scramble_time_left', {seconds: left});
		}
	}

	// ── Scramble line ──
	let scrambleBody: React.ReactNode = null;
	if (current && showScramble) {
		const scrambling = cube.phase === 'scrambling';
		const mismatch =
			scrambling &&
			(cube.outOfSync || (cube.undoMoves && cube.undoMoves.length === 1 && cube.undoMoves[0] === 'TOO_MANY'));
		if (mismatch) {
			scrambleBody = (
				<div className={b('cube-alert')}>
					{/* Out of sync covers two cubes the app cannot tell apart: one really scrambled
					    (dropped mid-scramble, came back mixed up) and one whose firmware drifted
					    while it sits solved in the hand. The text gives the way out of both. */}
					<span>{cube.outOfSync ? t('online_battle.cube_mismatch') : t('battle.cube_just_solve')}</span>
					{cube.outOfSync && (
						<Button small outline text={t('smart_cube.mark_as_solved')} onClick={() => cube.markSolved()} />
					)}
				</div>
			);
		} else if (scrambling && cube.undoMoves && cube.undoMoves.length) {
			scrambleBody = <span className={b('undo')}>{cube.undoMoves.join(' ')}</span>;
		} else if (scrambling && cube.matchStatus.length > 0) {
			scrambleBody = (
				<ScrambleMoveList
					moves={current.scramble.trim().split(/\s+/)}
					matchStatus={cube.matchStatus}
					useBlueMatch={useBlueMatch}
				/>
			);
		} else {
			scrambleBody = current.scramble;
		}
	}

	const graceLeftSec =
		!match.opponentConnected && match.opponentGraceUntil != null
			? Math.max(0, Math.ceil((toLocal(match.opponentGraceUntil) - now) / 1000))
			: null;

	let cubeWarning: string | null = null;
	if (!cube.connected) {
		cubeWarning = cube.reconnecting ? t('online_battle.cube_reconnecting') : t('online_battle.cube_lost');
	}

	return (
		<div className={b('match')}>
			<div className={b('match-head')}>
				<span className={b('match-round')}>{current ? t('online_battle.round', {n: current.round}) : ' '}</span>
				<span className={b('match-score')}>
					{myScore} - {oppScore}
				</span>
				{!matched.rated && <span className={b('tag')}>{t('online_battle.unrated_match')}</span>}
			</div>

			<div className={b('match-opponent')}>
				<OpponentBar
					name={matched.opponent.username}
					avatar={matched.opponent.avatar}
					rating={matched.opponent.rating}
					provisional={matched.opponent.provisional}
					score={oppScore}
					state={opponent}
					solvingSinceLocal={opponent?.solvingSince != null ? toLocal(opponent.solvingSince) : null}
					now={now}
					connected={match.opponentConnected}
					graceLeftSec={graceLeftSec}
				/>
			</div>

			<div className={b('match-self')}>
				<div className={b('scramble')}>{scrambleBody}</div>
				<div className={b('headline')}>{headline || ' '}</div>
				<div className={b('big-time', bigMod ? {[bigMod]: true} : {})}>{bigTime || ' '}</div>
				<div className={b('note')}>{note || ' '}</div>
				{!current && matched.preview && (
					<div className={b('preview')}>
						{t('online_battle.preview', {win: matched.preview.win, loss: Math.abs(matched.preview.loss)})}
					</div>
				)}

				{/* The player's own cube: the 3D mirror and what to do with it. Kept mounted
				    while the link is down, so it comes back where it was. */}
				<div className={b('my-cube')}>
					<div className={b('my-cube-view', {off: !cube.connected})}>
						<SmartCubeView ref={cube.viewRef} connected={cube.connected} size={cubeSize} keepVisualOnClear />
					</div>
					<div className={b('cube-tools')}>
						{cube.connected ? (
							<>
								{cube.battery != null && (
									<span className={b('cube-battery')} lang="en">
										<BatteryMedium /> {cube.battery}%
									</span>
								)}
								{cube.gyroSupported && (
									<button type="button" className={b('cube-tool')} onClick={() => cube.resetGyro()}>
										<ArrowsClockwise weight="bold" />
										{t('smart_cube.reset_gyro')}
									</button>
								)}
								{/* Not while the cube is meant to be scrambled or solving: the cube's
								    state is right then, and resetting it would break the round. */}
								{/* Hidden while the mismatch alert above offers the same button: one
								    action, one place. */}
								{cube.phase !== 'inspecting' && cube.phase !== 'solving' && !(cube.phase === 'scrambling' && cube.outOfSync) && (
									<button type="button" className={b('cube-tool')} onClick={() => cube.markSolved()}>
										<CheckSquare weight="bold" />
										{t('smart_cube.mark_as_solved')}
									</button>
								)}
							</>
						) : (
							<>
								{cubeWarning && <span className={b('cube-warning')}>{cubeWarning}</span>}
								{!cube.reconnecting && (
									<Button
										small
										primary
										loading={cube.connecting}
										text={t('online_battle.reconnect_cube')}
										onClick={() => cube.connect()}
									/>
								)}
							</>
						)}
					</div>
				</div>
			</div>

			<div className={b('match-foot')}>
				<PlayerLine
					name={myName}
					avatar={myAvatar}
					rating={matched.you.rating}
					provisional={matched.you.provisional}
					score={myScore}
					self
				/>
				<Button small outline text={t('online_battle.give_up')} onClick={onGiveUp} />
			</div>
		</div>
	);
}
