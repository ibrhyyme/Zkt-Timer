import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { getTimeString } from '../../util/time';
import { useBattle, BattleSolve, BattleRound } from './BattleContext';
import { useTranslation } from 'react-i18next';
import block from '../../styles/bem';

const b = block('battle');

type TimerStatus = 'RESTING' | 'PRIMING' | 'TIMING' | 'DONE';

interface BattleTimerProps {
	player: 1 | 2;
	onSolve: (solve: BattleSolve) => void;
}

export default function BattleTimer({ player, onSolve }: BattleTimerProps) {
	const { t } = useTranslation();
	const { state, dispatch } = useBattle();
	const { settings, currentRound, rounds, currentScramble, player1Score, player2Score, winStreak } = state;
	const currentRoundData = rounds[currentRound];

	const [status, setStatus] = useState<TimerStatus>('RESTING');
	const [displayTime, setDisplayTime] = useState(0);
	const [penalty, setPenalty] = useState<'none' | 'plus2' | 'dnf'>('none');

	const startTimeRef = useRef<number>(0);
	const rafRef = useRef<number>(0);
	const touchActiveRef = useRef(false);
	const statusRef = useRef<TimerStatus>('RESTING');
	const finalTimeRef = useRef(0);
	const stateRef = useRef(state);
	stateRef.current = state;

	const alreadySolved = player === 1 ? !!currentRoundData?.player1Solve : !!currentRoundData?.player2Solve;
	const bothSolved = !!currentRoundData?.player1Solve && !!currentRoundData?.player2Solve;
	// Only show timer until both players finish
	const roundActive = state.roundStarted && !bothSolved;

	// Synchronously update statusRef and status state — don't wait for useEffect, prevent race conditions
	const updateStatus = useCallback((newStatus: TimerStatus) => {
		statusRef.current = newStatus;
		setStatus(newStatus);
	}, []);

	// Reset when round changes or scramble refreshes (cube type change, RESET,
	// CHANGE_SCRAMBLE — all generate new currentScramble). currentRound alone isn't sufficient
	// because after RESET on first round, currentRound is still 0, so effect won't trigger.
	useEffect(() => {
		// Timer already running — don't touch (started from handler)
		if (statusRef.current === 'TIMING') return;

		setDisplayTime(0);
		setPenalty('none');
		if (rafRef.current) cancelAnimationFrame(rafRef.current);

		if (touchActiveRef.current) {
			// Player still holding down — go straight to PRIMING
			updateStatus('PRIMING');
			dispatch({ type: 'PLAYER_READY', player });
		} else {
			updateStatus('RESTING');
		}
	}, [currentRound, currentScramble, dispatch, player, updateStatus]);

	const tick = useCallback(() => {
		const elapsed = (performance.now() - startTimeRef.current) / 1000;
		setDisplayTime(elapsed);
		rafRef.current = requestAnimationFrame(tick);
	}, []);

	const stopTimer = useCallback(() => {
		if (rafRef.current) cancelAnimationFrame(rafRef.current);
		const finalTime = (performance.now() - startTimeRef.current) / 1000;
		finalTimeRef.current = finalTime;
		setDisplayTime(finalTime);
		updateStatus('DONE');

		onSolve({
			time: finalTime,
			plusTwo: false,
			dnf: false,
			scramble: currentScramble,
			roundIndex: currentRound,
		});
	}, [onSolve, currentScramble, currentRound, updateStatus]);

	const handleTouchStart = useCallback(
		(_e: React.TouchEvent) => {
			const s = statusRef.current;

			if (s === 'TIMING') {
				stopTimer();
				return;
			}

			// This player solved but opponent hasn't — block
			if (alreadySolved && !bothSolved) return;

			// Only allow in RESTING or DONE (if round is complete) state
			if (s !== 'RESTING' && !(s === 'DONE' && bothSolved)) return;

			touchActiveRef.current = true;

			if (bothSolved) {
				setDisplayTime(0);
				setPenalty('none');
			}
			// No delay, go straight to PRIMING — hand touches green light immediately
			updateStatus('PRIMING');
			dispatch({ type: 'PLAYER_READY', player });
		},
		[alreadySolved, bothSolved, stopTimer, dispatch, player, updateStatus]
	);

	const handleTouchEnd = useCallback(
		(_e: React.TouchEvent) => {
			touchActiveRef.current = false;

			const s = statusRef.current;
			if (s === 'PRIMING') {
				const cs = stateRef.current;
				const otherReady = player === 1 ? cs.player2Ready : cs.player1Ready;
				const otherStarted = player === 1 ? cs.player2StartedAt : cs.player1StartedAt;
				// Other player may have already finished this round.
				// roundStarted condition is required: prevent misreading solve data from a completed
				// previous round and starting alone.
				const otherSolvedThisRound = cs.roundStarted && !!(player === 1
					? cs.rounds[cs.currentRound]?.player2Solve
					: cs.rounds[cs.currentRound]?.player1Solve);

				if (otherReady || otherStarted || otherSolvedThisRound) {
					// Start timer directly — not dependent on useEffect chain
					const startTime = performance.now();
					startTimeRef.current = startTime;
					updateStatus('TIMING');
					rafRef.current = requestAnimationFrame(tick);
					dispatch({ type: 'PLAYER_START', player, startTime });
				} else {
					updateStatus('RESTING');
					dispatch({ type: 'PLAYER_UNREADY', player });
				}
			} else if (s !== 'TIMING' && s !== 'DONE') {
				dispatch({ type: 'PLAYER_UNREADY', player });
				updateStatus('RESTING');
			}
		},
		[dispatch, player, tick, updateStatus]
	);

	const applyPenalty = useCallback(
		(type: 'plus2' | 'dnf') => {
			if (status !== 'DONE' && !alreadySolved) return;
			const newPenalty = penalty === type ? 'none' : type;
			setPenalty(newPenalty);
			onSolve({
				time: finalTimeRef.current,
				plusTwo: newPenalty === 'plus2',
				dnf: newPenalty === 'dnf',
				scramble: currentScramble,
				roundIndex: currentRound,
			});
		},
		[status, alreadySolved, penalty, onSolve, currentScramble, currentRound]
	);

	// --- Stats ---
	const playerStats = useMemo(() => getPlayerStats(rounds, player), [rounds, player]);

	// --- Time text ---
	const isIdle = status === 'RESTING' && !alreadySolved;
	let timeText: string;
	if (isIdle) {
		timeText = t('battle.tap_to_start');
	} else if (status === 'PRIMING') {
		timeText = '0.00';
	} else if (status === 'TIMING' && !settings.showTimeWhenSolving) {
		timeText = t('battle.solving');
	} else if (alreadySolved && status === 'RESTING') {
		const solve = player === 1 ? currentRoundData.player1Solve : currentRoundData.player2Solve;
		timeText = solve.dnf ? 'DNF' : getTimeString(solve.plusTwo ? solve.time + 2 : solve.time);
	} else {
		const effectiveTime = penalty === 'plus2' ? displayTime + 2 : displayTime;
		timeText = penalty === 'dnf' ? 'DNF' : getTimeString(effectiveTime);
	}

	// --- Modifier ---
	const timerMod: Record<string, boolean> = {
		rotated: player === 1,
		priming: status === 'PRIMING',
		timing: status === 'TIMING',
		done: status === 'DONE' || (alreadySolved && status === 'RESTING'),
	};

	const timeMod: Record<string, boolean> = {
		idle: isIdle,
		dnf: penalty === 'dnf',
		plus2: penalty === 'plus2',
	};

	const score = player === 1 ? `${player1Score} - ${player2Score}` : `${player2Score} - ${player1Score}`;
	const isWinning =
		player === 1 ? player1Score > player2Score : player2Score > player1Score;
	const isLosing =
		player === 1 ? player1Score < player2Score : player2Score < player1Score;

	// roundActive: someone started but both didn't finish together — show timer only
	const showPenalties = !roundActive && (status === 'DONE' || (alreadySolved && status === 'RESTING'));

	return (
		<div
			className={b('timer', timerMod)}
			onTouchStart={handleTouchStart}
			onTouchEnd={handleTouchEnd}
		>
			{/* Score badge */}
			{settings.showScore && !roundActive && (
				<div className={b('score-badge', { winning: isWinning, losing: isLosing })}>{score}</div>
			)}

			{/* Penalty buttons — top right corner */}
			{showPenalties && (
				<div className={b('penalties')}>
					<button
						className={b('penalty-btn', { 'active-plus2': penalty === 'plus2' })}
						onTouchStart={(e) => {
							e.stopPropagation();
							applyPenalty('plus2');
						}}
					>
						+2
					</button>
					<button
						className={b('penalty-btn', { 'active-dnf': penalty === 'dnf' })}
						onTouchStart={(e) => {
							e.stopPropagation();
							applyPenalty('dnf');
						}}
					>
						DNF
					</button>
				</div>
			)}

			{/* Streak badge */}
			{settings.showWinStreak && !roundActive && winStreak.count >= 2 && winStreak.player === player && !showPenalties && (
				<div className={b('streak-badge')}>
					{t('battle.streak')}: {winStreak.count}
				</div>
			)}

			{/* Player name */}
			{settings.showPlayerNames && (
				<div className={b('player-name')}>
					{player === 1 ? settings.player1Name : settings.player2Name}
				</div>
			)}

			{/* Time — lang="en" locale-based dot->comma font substitution prevention */}
			<div className={b('time', timeMod)} lang="en">{timeText}</div>

			{/* Scramble — hide when round is active (someone solving) */}
			{settings.showScramble && !roundActive && status !== 'TIMING' && (
				<div className={b('scramble')}>{currentScramble}</div>
			)}

			{/* Stats */}
			{settings.showStatistics && !roundActive && playerStats && (
				<div className={b('stats', { left: player === 2, right: player === 1 })}>
					{playerStats.best !== null && (
						<div>
							{t('battle.best')}: {getTimeString(playerStats.best)}
						</div>
					)}
					{playerStats.mean !== null && (
						<div>
							{t('battle.mean')}: {getTimeString(playerStats.mean)}
						</div>
					)}
					{playerStats.mo3 !== null && <div>Mo3: {getTimeString(playerStats.mo3)}</div>}
					<div>
						{t('battle.solves')}: {playerStats.count}
					</div>
				</div>
			)}
		</div>
	);
}

function getPlayerStats(rounds: BattleRound[], player: 1 | 2) {
	const solves = rounds
		.map((r) => (player === 1 ? r.player1Solve : r.player2Solve))
		.filter((s): s is BattleSolve => !!s);

	if (solves.length === 0) return null;

	const validTimes = solves.filter((s) => !s.dnf).map((s) => (s.plusTwo ? s.time + 2 : s.time));

	if (validTimes.length === 0) return { count: solves.length, best: null, mean: null, mo3: null };

	const best = Math.min(...validTimes);
	const mean = validTimes.reduce((a: number, b: number) => a + b, 0) / validTimes.length;

	let mo3: number | null = null;
	if (validTimes.length >= 3) {
		const last3 = validTimes.slice(-3);
		mo3 = last3.reduce((a: number, b: number) => a + b, 0) / 3;
	}

	return { count: solves.length, best, mean, mo3 };
}
