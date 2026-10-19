import React, {useEffect, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {ArrowsClockwise, BatteryMedium, CheckSquare, Flag} from 'phosphor-react';
import block from '../../../styles/bem';
import Button from '../../common/button/Button';
import {getTimeString} from '../../../util/time';
import ScrambleMoveList from '../../timer/time_display/timer_scramble/smart_scramble/ScrambleMoveList';
import SmartCubeView, {SmartCubeViewHandle} from '../../timer/smart_cube/cube_view/SmartCubeView';
import {
	INSPECTION_DNF_SEC,
	INSPECTION_SEC,
	ROUNDS_TO_WIN,
	SCRAMBLE_SEC,
	SCRAMBLE_TIMEOUT_SEC,
	SOLVE_CUTOFF_SEC,
} from '../../../../shared/battle/config';
import {inspectionPenalty} from '../../../../shared/battle/rules';
import type {MatchStatus} from '../../../util/smart_cube/solve_engine';
import type {BattlePenalty} from '../../../../shared/battle/types';
import OpponentBar, {Pips, avatarSrc, formatBattleTime} from './OpponentBar';
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
	/** +2 for a scramble over 20 s, the device's call. */
	scramblePenalty: BattlePenalty | null;
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
				? Math.round(Math.max(120, Math.min(window.innerHeight * 0.24, 210)))
				: Math.round(Math.max(72, Math.min(window.innerWidth * 0.42, window.innerHeight * 0.21, 190)));
	const [size, setSize] = useState(read);
	useEffect(() => {
		const onResize = () => setSize(read());
		window.addEventListener('resize', onResize);
		return () => window.removeEventListener('resize', onResize);
	}, []);
	return size;
}

/** ok: inside the free window. warn: the +2 window, or the last seconds before the cutoff. over: DNF. */
export type ClockZone = 'ok' | 'warn' | 'over';

export interface PhaseClock {
	/** Share of the current window still left, 0..1: the bar under the phase row. */
	left: number;
	zone: ClockZone;
	/** Whole seconds left in the current window. */
	seconds: number;
}

/**
 * The clock of a limited phase: the free window first, then the +2 window, then DNF. Pure,
 * so the scramble (20 s, +2 up to 40 s) and the inspection (15 s, +2 up to 17 s) share it.
 */
export function phaseClock(elapsedMs: number, freeSec: number, limitSec: number): PhaseClock {
	const free = freeSec * 1000;
	const limit = limitSec * 1000;
	const e = Math.max(0, elapsedMs);
	if (e <= free) return {left: 1 - e / free, zone: 'ok', seconds: Math.max(1, Math.ceil((free - e) / 1000))};
	if (e <= limit) return {left: 1 - (e - free) / (limit - free), zone: 'warn', seconds: Math.ceil((limit - e) / 1000)};
	return {left: 0, zone: 'over', seconds: 0};
}

/** The cutoff as a draining bar while solving; the last 10 s are a warning. */
export function solveClock(elapsedMs: number): PhaseClock {
	const limit = SOLVE_CUTOFF_SEC * 1000;
	const e = Math.max(0, elapsedMs);
	const leftMs = limit - e;
	return {
		left: Math.max(0, leftMs / limit),
		zone: leftMs <= 0 ? 'over' : leftMs <= 10_000 ? 'warn' : 'ok',
		seconds: Math.max(0, Math.ceil(leftMs / 1000)),
	};
}

/** One side of the scoreboard: picture, name, rating and the rounds won. */
function BoardSide(props: {name: string; avatar: string | null; rating: number; provisional: boolean; score: number; end?: boolean}) {
	const {t} = useTranslation();
	const src = avatarSrc(props.avatar);
	return (
		<div className={b('board-side', {end: !!props.end})}>
			<span className={b('avatar')} aria-hidden="true">
				{src ? <img src={src} alt="" /> : <span>{(props.name || '?').charAt(0).toUpperCase()}</span>}
			</span>
			<span className={b('board-name')}>{props.name}</span>
			<span className={b('board-rating')} lang="en" title={props.provisional ? t('online_battle.provisional') : undefined}>
				{props.rating}
				{props.provisional && <span className={b('provisional')}>?</span>}
			</span>
			<Pips score={props.score} />
		</div>
	);
}

/**
 * One round on the player's own phone (design 5.4): the scoreboard with both players facing
 * each other, the opponent's lane, then this player's stage (the phase with its draining
 * clock, the scramble, the big time, the cube) and a row of quiet tools. On a desktop the
 * stage and the opponent sit side by side. Never scrolls.
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

	// ── This player's stage ──
	let phaseLabel: string | null = null;
	let phaseValue: string | null = null;
	let clock: PhaseClock | null = null;
	let headline: string | null = null;
	let bigTime: string | null = null;
	let bigMod: string | null = null;
	let showScramble = false;
	let note: string | null = null;
	const penalties: string[] = [];

	if (cube.scramblePenalty === 'PLUS_TWO' && !roundOver) penalties.push(t('online_battle.scramble_penalty'));

	if (!current) {
		const startsIn = Math.ceil((toLocal(matched.startsAt) - now) / 1000);
		headline = t('online_battle.opponent_found');
		bigTime = startsIn > 0 ? String(startsIn) : null;
		bigMod = 'count';
		if (matched.challenge) note = t('online_battle.duel.found_note');
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
		clock = phaseClock(elapsed, INSPECTION_SEC, INSPECTION_DNF_SEC);
		phaseLabel = t('online_battle.phase.inspect');
		const penalty = inspectionPenalty(elapsed);
		if (penalty === 'DNF') bigTime = 'DNF';
		else if (penalty === 'PLUS_TWO') bigTime = '+2';
		else bigTime = String(clock.seconds);
		bigMod = penalty === 'DNF' ? 'late' : penalty ? 'plus2' : 'inspect';
		if (penalty === 'DNF') note = t('online_battle.inspection_dnf', {seconds: INSPECTION_DNF_SEC});
	} else if (cube.phase === 'solving') {
		const elapsed = Math.max(0, now - (cube.solveStartedAt || now));
		clock = solveClock(elapsed);
		phaseLabel = t('online_battle.phase.solve', {seconds: SOLVE_CUTOFF_SEC});
		bigTime = getTimeString(elapsed / 1000, 1);
		bigMod = 'running';
		if (cube.scrambleDoneAt != null && cube.solveStartedAt != null) {
			if (inspectionPenalty(cube.solveStartedAt - cube.scrambleDoneAt) === 'PLUS_TWO') {
				penalties.push(t('online_battle.inspection_penalty'));
			}
		}
	} else if (cube.phase === 'done') {
		if (cube.solve) {
			bigTime = formatBattleTime(cube.solve.timeMs, cube.solve.penalty);
			bigMod = 'final';
		}
		// What the opponent is actually doing. No state yet means the opponent has not
		// finished scrambling.
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
		// Scrambling: the moves are the hero; the phase row counts the free 20 s down, then
		// the +2 window up to the DNF at 40 s.
		showScramble = true;
		const elapsed = goAtLocal != null ? now - goAtLocal : 0;
		clock = phaseClock(elapsed, SCRAMBLE_SEC, SCRAMBLE_TIMEOUT_SEC);
		phaseLabel = t('online_battle.phase.scramble');
		phaseValue = clock.zone === 'ok' ? String(clock.seconds) : clock.zone === 'warn' ? '+2' : 'DNF';
		if (clock.zone === 'warn') {
			if (!penalties.length) penalties.push(t('online_battle.scramble_penalty'));
			note = t('online_battle.scramble_dnf_in', {seconds: clock.seconds});
		} else if (firstMatch) {
			note = t('online_battle.scramble_hint_first');
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
					{cube.outOfSync && <Button small gray text={t('smart_cube.mark_as_solved')} onClick={() => cube.markSolved()} />}
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
			<header className={b('board')}>
				<BoardSide
					name={myName}
					avatar={myAvatar}
					rating={matched.you.rating}
					provisional={matched.you.provisional}
					score={myScore}
				/>
				<div className={b('board-center')}>
					<span className={b('eyebrow')}>{t('online_battle.round', {n: current ? current.round : 1})}</span>
					<span className={b('board-score')} lang="en">
						{myScore}
						<span className={b('board-colon')}>:</span>
						{oppScore}
					</span>
					<span className={b('board-rule')}>
						{matched.challenge
							? t('online_battle.duel.board_rule', {n: ROUNDS_TO_WIN})
							: matched.rated
								? t('online_battle.first_to', {n: ROUNDS_TO_WIN})
								: t('online_battle.unrated_match')}
					</span>
				</div>
				<BoardSide
					end
					name={matched.opponent.username}
					avatar={matched.opponent.avatar}
					rating={matched.opponent.rating}
					provisional={matched.opponent.provisional}
					score={oppScore}
				/>
			</header>

			<section className={b('match-opponent')} aria-label={t('online_battle.opponent')}>
				<OpponentBar
					state={opponent}
					solvingSinceLocal={opponent?.solvingSince != null ? toLocal(opponent.solvingSince) : null}
					now={now}
					connected={match.opponentConnected}
					graceLeftSec={graceLeftSec}
				/>
			</section>

			<section className={b('stage-self')}>
				{phaseLabel && clock && (
					<div className={b('phase-row', {[clock.zone]: true})}>
						<span className={b('phase-name')}>{phaseLabel}</span>
						{penalties.length > 0 && (
							<span className={b('penalties')}>
								{penalties.map((p) => (
									<span key={p} className={b('penalty')}>
										{p}
									</span>
								))}
							</span>
						)}
						{phaseValue && (
							<span className={b('phase-value')} lang="en">
								{phaseValue}
							</span>
						)}
						<span className={b('phase-meter')} aria-hidden="true">
							<span className={b('phase-meter-fill')} style={{transform: `scaleX(${clock.left})`}} />
						</span>
					</div>
				)}
				{showScramble && <div className={b('scramble')}>{scrambleBody}</div>}
				{headline && <div className={b('headline')}>{headline}</div>}
				{bigTime && <div className={b('big-time', bigMod ? {[bigMod]: true} : {})}>{bigTime}</div>}
				{note && <div className={b('note')}>{note}</div>}
				{!current && matched.preview && (
					<div className={b('preview')} lang="en">
						<span className={b('preview-win')}>+{matched.preview.win}</span>
						<span className={b('preview-loss')}>−{Math.abs(matched.preview.loss)}</span>
					</div>
				)}

				{/* The player's own cube. Kept mounted while the link is down, so it comes back
				    where it was. */}
				<div className={b('my-cube-view', {off: !cube.connected})}>
					<SmartCubeView ref={cube.viewRef} connected={cube.connected} size={cubeSize} keepVisualOnClear />
				</div>
				{cubeWarning && <div className={b('cube-warning')}>{cubeWarning}</div>}
			</section>

			<footer className={b('tools')}>
				{cube.connected ? (
					<>
						{cube.battery != null && (
							<span className={b('cube-battery')} lang="en">
								<BatteryMedium weight="bold" />
								{cube.battery}%
							</span>
						)}
						{cube.gyroSupported && (
							<Button
								small
								transparent
								iconFirst
								icon={<ArrowsClockwise weight="bold" />}
								text={t('smart_cube.reset_gyro')}
								onClick={() => cube.resetGyro()}
							/>
						)}
						{/* Not while the cube is meant to be scrambled or solving: the cube's
						    state is right then, and resetting it would break the round. Hidden
						    while the mismatch alert offers the same button: one action, one place. */}
						{cube.phase !== 'inspecting' && cube.phase !== 'solving' && !(cube.phase === 'scrambling' && cube.outOfSync) && (
							<Button
								small
								transparent
								iconFirst
								icon={<CheckSquare weight="bold" />}
								text={t('smart_cube.mark_as_solved')}
								onClick={() => cube.markSolved()}
							/>
						)}
					</>
				) : (
					!cube.reconnecting && (
						<Button
							small
							primary
							loading={cube.connecting}
							text={t('online_battle.reconnect_cube')}
							onClick={() => cube.connect()}
						/>
					)
				)}
				<span className={b('tools-gap')} />
				<Button small transparent iconFirst icon={<Flag weight="bold" />} text={t('online_battle.give_up')} onClick={onGiveUp} />
			</footer>
		</div>
	);
}
