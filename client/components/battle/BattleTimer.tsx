import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { getTimeString } from '../../util/time';
import { useBattle, BattleSolve, BattleRound } from './BattleContext';
import { useTranslation } from 'react-i18next';
import block from '../../styles/bem';

const b = block('battle');
const FREEZE_MS = 300;

type TimerStatus = 'RESTING' | 'PRIMING' | 'TIMING' | 'DONE';

interface BattleTimerProps {
	player: 1 | 2;
	onSolve: (solve: BattleSolve) => void;
}

export default function BattleTimer({ player, onSolve }: BattleTimerProps) {
	const { t } = useTranslation();
	const { state, dispatch } = useBattle();
	const { settings, currentRound, rounds, currentScramble, player1Score, player2Score, winStreak } = state;
	const myStartedAt = player === 1 ? state.player1StartedAt : state.player2StartedAt;
	const currentRoundData = rounds[currentRound];

	const [status, setStatus] = useState<TimerStatus>('RESTING');
	const [displayTime, setDisplayTime] = useState(0);
	const [penalty, setPenalty] = useState<'none' | 'plus2' | 'dnf'>('none');

	const startTimeRef = useRef<number>(0);
	const rafRef = useRef<number>(0);
	const freezeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
	const touchActiveRef = useRef(false);
	const statusRef = useRef<TimerStatus>('RESTING');
	const finalTimeRef = useRef(0);

	const alreadySolved = player === 1 ? !!currentRoundData?.player1Solve : !!currentRoundData?.player2Solve;
	const bothSolved = !!currentRoundData?.player1Solve && !!currentRoundData?.player2Solve;

	useEffect(() => {
		statusRef.current = status;
	}, [status]);

	// Reducer iptal ettiyse (ready false, parmak basili degil, hala PRIMING) → RESTING'e don
	const myReady = player === 1 ? state.player1Ready : state.player2Ready;
	useEffect(() => {
		if (!myReady && !touchActiveRef.current && statusRef.current === 'PRIMING') {
			setStatus('RESTING');
		}
	}, [myReady]);

	// Round degistiginde reset
	useEffect(() => {
		setDisplayTime(0);
		setPenalty('none');
		if (rafRef.current) cancelAnimationFrame(rafRef.current);
		if (freezeTimeoutRef.current) clearTimeout(freezeTimeoutRef.current);

		if (touchActiveRef.current) {
			// Oyuncu hala basili tutuyor — direkt PRIMING'e gec
			setStatus('PRIMING');
			dispatch({ type: 'PLAYER_READY', player });
		} else {
			setStatus('RESTING');
		}
	}, [currentRound, dispatch, player]);

	const tick = useCallback(() => {
		const elapsed = (performance.now() - startTimeRef.current) / 1000;
		setDisplayTime(elapsed);
		rafRef.current = requestAnimationFrame(tick);
	}, []);

	// Bagimsiz start: her oyuncunun kendi startedAt'i degistiginde baslar
	useEffect(() => {
		if (myStartedAt && statusRef.current !== 'TIMING' && statusRef.current !== 'DONE' && !alreadySolved) {
			startTimeRef.current = myStartedAt;
			setStatus('TIMING');
			rafRef.current = requestAnimationFrame(tick);
		}
	}, [myStartedAt, currentRound, tick, alreadySolved]);

	const stopTimer = useCallback(() => {
		if (rafRef.current) cancelAnimationFrame(rafRef.current);
		const finalTime = (performance.now() - startTimeRef.current) / 1000;
		finalTimeRef.current = finalTime;
		setDisplayTime(finalTime);
		setStatus('DONE');

		onSolve({
			time: finalTime,
			plusTwo: false,
			dnf: false,
			scramble: currentScramble,
			roundIndex: currentRound,
		});
	}, [onSolve, currentScramble, currentRound]);

	const handleTouchStart = useCallback(
		(e: React.TouchEvent) => {
			const s = statusRef.current;

			if (s === 'TIMING') {
				stopTimer();
				return;
			}

			// Bu oyuncu cozdu ama rakip henuz cozmedi — engelle
			if (alreadySolved && !bothSolved) return;

			// Sadece RESTING veya DONE (tur tamamlanmissa) durumunda izin ver
			if (s !== 'RESTING' && !(s === 'DONE' && bothSolved)) return;

			touchActiveRef.current = true;
			freezeTimeoutRef.current = setTimeout(() => {
				if (touchActiveRef.current) {
					// Yeni tur icin display sifirla
					if (bothSolved) {
						setDisplayTime(0);
						setPenalty('none');
					}
					setStatus('PRIMING');
					dispatch({ type: 'PLAYER_READY', player });
				}
			}, FREEZE_MS);
		},
		[alreadySolved, bothSolved, stopTimer, dispatch, player]
	);

	const handleTouchEnd = useCallback(
		(e: React.TouchEvent) => {
			if (e.touches.length > 0) return;

			touchActiveRef.current = false;

			if (freezeTimeoutRef.current) {
				clearTimeout(freezeTimeoutRef.current);
				freezeTimeoutRef.current = null;
			}

			const s = statusRef.current;
			if (s === 'PRIMING') {
				// Reducer karar verecek — baslat veya iptal et
				dispatch({ type: 'PLAYER_START', player, startTime: performance.now() });
			} else if (s !== 'TIMING' && s !== 'DONE') {
				dispatch({ type: 'PLAYER_UNREADY', player });
				setStatus('RESTING');
			}
		},
		[dispatch, player]
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

	const showPenalties = status === 'DONE' || (alreadySolved && status === 'RESTING');

	return (
		<div
			className={b('timer', timerMod)}
			onTouchStart={handleTouchStart}
			onTouchEnd={handleTouchEnd}
		>
			{/* Score badge */}
			{settings.showScore && (
				<div className={b('score-badge', { winning: isWinning, losing: isLosing })}>{score}</div>
			)}

			{/* Penalty buttons — sag ust kose */}
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
			{settings.showWinStreak && winStreak.count >= 2 && winStreak.player === player && !showPenalties && (
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

			{/* Time */}
			<div className={b('time', timeMod)}>{timeText}</div>

			{/* Scramble */}
			{settings.showScramble && status !== 'TIMING' && (
				<div className={b('scramble')}>{currentScramble}</div>
			)}

			{/* Stats */}
			{settings.showStatistics && playerStats && (
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
