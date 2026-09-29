import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { getTimeString } from '../../util/time';
import { useBattle, BattleSolve, BattleRound } from './BattleContext';
import { useBattleCubes } from './smart/BattleCubesProvider';
import { SmartEngineEvent } from '../../util/smart_cube';
import type { MatchStatus } from '../../util/smart_cube/solve_engine';
import ScrambleMoveList, { isGreenBaseColor } from '../timer/time_display/timer_scramble/smart_scramble/ScrambleMoveList';
import SmartCubeView, { SmartCubeViewHandle } from '../timer/smart_cube/cube_view/SmartCubeView';
import { useSettings } from '../../util/hooks/useSettings';
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
	const { status: cubeStatus, stream: cubeStream, connect: connectCube, disconnect: disconnectCube, markSolved, subscribeGyro, registerHandler } = useBattleCubes();
	const { settings, currentRound, rounds, currentScramble, player1Score, player2Score, winStreak } = state;
	const currentRoundData = rounds[currentRound];

	const [status, setStatus] = useState<TimerStatus>('RESTING');
	const [displayTime, setDisplayTime] = useState(0);
	const [penalty, setPenalty] = useState<'none' | 'plus2' | 'dnf'>('none');

	// Correction hint from the engine while this player scrambles: moves to undo, or the
	// single token TOO_MANY meaning "you are past it, just solve the cube".
	const [undoMoves, setUndoMoves] = useState<string[] | null>(null);
	// Per-move verdict on the scramble, straight from the engine, so the display agrees with
	// what the engine acted on instead of running a second matcher that could disagree.
	const [matchStatus, setMatchStatus] = useState<MatchStatus[]>([]);
	// Cube is in a state that is neither solved nor on the scramble's path. Matching moves
	// is meaningless until the two agree again, so the display stops pretending otherwise.
	const [outOfSync, setOutOfSync] = useState(false);

	// Green-based themes paint the scramble text green, which would hide a green "done"
	// confirmation. The host reads the theme, the shared list just obeys.
	const useBlueMatch = isGreenBaseColor(useSettings('text_color'));

	const startTimeRef = useRef<number>(0);
	const rafRef = useRef<number>(0);
	const touchActiveRef = useRef(false);
	const statusRef = useRef<TimerStatus>('RESTING');
	const finalTimeRef = useRef(0);
	const stateRef = useRef(state);
	stateRef.current = state;

	const link = cubeStatus[player];
	// Cube input replaces touch input entirely for this player. The other player is
	// unaffected: one can play with a cube while the other taps the screen.
	const smartActive = link.state === 'connected';

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
		// Timer already running — don't touch (started from handler or from the cube)
		if (statusRef.current === 'TIMING') return;

		setDisplayTime(0);
		setPenalty('none');
		setUndoMoves(null);
		setMatchStatus([]);
		setOutOfSync(false);
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

	// ── Smart cube input ──
	// Assigned every render so the engine, which subscribes once, always reaches the current
	// closure instead of the one from first mount. Same pattern the rooms page uses.
	const engineHandlerRef = useRef<(event: SmartEngineEvent) => void>(() => { /* set below */ });
	/** The 3D mirror, so the engine's re-anchor can be replayed onto it. */
	const cubeViewRef = useRef<SmartCubeViewHandle>(null);

	// Stable object: the view re-subscribes whenever this identity changes, and a new one per
	// render would tear the gyro stream down and rebuild it on every move.
	const gyroSource = useMemo(
		() => ({ subscribeGyro: (listener: (event: any) => void) => subscribeGyro(player, listener) }),
		[player, subscribeGyro]
	);

	/**
	 * The preview has to follow the viewport, because the stylesheet scales this page from a
	 * phone to a desktop and SmartCubeView takes a pixel number, not a CSS length.
	 *
	 * Same shape as the timer page's own cube sizing (SmartCube.tsx): read the viewport, listen
	 * for resize. Bound by height as well as width, for the same reason every scaling value in
	 * the stylesheet is: a half is a fraction of the viewport height, and a tablet held sideways
	 * is short. The width term keeps it clear of the cube button in the middle of the same row,
	 * which is what caps it at 84 on a phone.
	 */
	const [viewportW, setViewportW] = useState(typeof window !== 'undefined' ? window.innerWidth : 390);
	const [viewportH, setViewportH] = useState(typeof window !== 'undefined' ? window.innerHeight : 844);
	useEffect(() => {
		if (typeof window === 'undefined') return;
		const onResize = () => {
			setViewportW(window.innerWidth);
			setViewportH(window.innerHeight);
		};
		window.addEventListener('resize', onResize);
		return () => window.removeEventListener('resize', onResize);
	}, []);
	// 768 is the same line the stylesheet scales at, kept in step with it by hand the way
	// useIsMobile does. Below it the value is the phone's literal 84 rather than a formula that
	// happens to land near it, so no phone can shift by a pixel.
	const previewSize =
		viewportW < 768 ? 84 : Math.round(Math.max(84, Math.min(viewportW * 0.14, viewportH * 0.14, 150)));

	engineHandlerRef.current = (event: SmartEngineEvent) => {
		switch (event.type) {
			case 'SCRAMBLE_COMPLETE':
				// The cube reached the scramble. That is this player's "ready", exactly what
				// holding a finger on the screen means in touch play.
				setUndoMoves(null);
				if (statusRef.current === 'RESTING' || statusRef.current === 'DONE') {
					setDisplayTime(0);
					setPenalty('none');
					updateStatus('PRIMING');
					dispatch({ type: 'PLAYER_READY', player });
				}
				break;

			case 'UNDO_MOVES':
				setUndoMoves(event.moves);
				break;

			case 'SCRAMBLE_PROGRESS':
				setMatchStatus(event.matchStatus);
				break;

			case 'OUT_OF_SYNC':
				setOutOfSync(event.out);
				break;

			case 'TIMER_START': {
				if (statusRef.current === 'TIMING') break;
				setUndoMoves(null);
				setMatchStatus([]);
				// startedAt comes from the cube's own clock on a Date.now() base. Rebasing it
				// onto performance.now() keeps the running display honest about the moves that
				// already happened before the packet reached us.
				startTimeRef.current = performance.now() - Math.max(0, Date.now() - event.startedAt);
				updateStatus('TIMING');
				if (rafRef.current) cancelAnimationFrame(rafRef.current);
				rafRef.current = requestAnimationFrame(tick);
				dispatch({ type: 'PLAYER_START', player, startTime: startTimeRef.current });
				break;
			}

			case 'SOLVE_COMPLETE': {
				if (rafRef.current) cancelAnimationFrame(rafRef.current);
				// The engine's time is corrected for BLE lag and stamped from the cube's own
				// clock, so it is the number to record — not what the screen happened to show
				// when the last packet arrived.
				const seconds = event.result.timeMs / 1000;
				finalTimeRef.current = seconds;
				setDisplayTime(seconds);
				setPenalty('none');
				updateStatus('DONE');

				onSolve({
					time: seconds,
					plusTwo: false,
					dnf: false,
					scramble: stateRef.current.currentScramble,
					roundIndex: stateRef.current.currentRound,
				});
				break;
			}

			case 'TRACKER_RESYNCED':
				// The mirror is driven by moves, so after the engine re-anchors to what the cube
				// actually reports it is showing a state that never happened. This is also what
				// makes a cube connected mid-scramble appear correctly instead of starting from
				// solved and drifting from the cube in the player's hands.
				void cubeViewRef.current?.syncToFacelets(event.facelets);
				break;

			default:
				// LATE_SCRAMBLE_MOVE is handled inside the link, which owns the move stream.
				break;
		}
	};

	useEffect(() => {
		return registerHandler(player, (event) => engineHandlerRef.current(event));
	}, [player, registerHandler]);

	// A cube that drops mid-round leaves the timer stranded: no packet will ever stop it.
	// Fall back to RESTING so the player can reconnect, or finish the round by tapping.
	useEffect(() => {
		if (link.state !== 'idle') return;
		setUndoMoves(null);
		setMatchStatus([]);
		setOutOfSync(false);
		if (statusRef.current === 'TIMING') {
			if (rafRef.current) cancelAnimationFrame(rafRef.current);
			updateStatus('RESTING');
			setDisplayTime(0);
		} else if (statusRef.current === 'PRIMING') {
			updateStatus('RESTING');
			dispatch({ type: 'PLAYER_UNREADY', player });
		}
	}, [link.state, dispatch, player, updateStatus]);

	const pressStart = useCallback(
		() => {
			// The cube drives this player's timer; a stray palm on the screen must not.
			if (smartActive) return;

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
		[smartActive, alreadySolved, bothSolved, stopTimer, dispatch, player, updateStatus]
	);

	const pressEnd = useCallback(
		() => {
			if (smartActive) return;

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
		[smartActive, dispatch, player, tick, updateStatus]
	);

	/**
	 * The timer half answers to a finger and to a mouse.
	 *
	 * Touch is what battle was built for and stays the primary input. The mouse bindings make
	 * the page playable in a desktop browser, which is also the only way it can be tested
	 * without a phone in hand. A touch is followed by a synthetic mouse event, so the same
	 * timestamp that guards the buttons guards this: a tap must not also count as a click.
	 */
	const handleTouchStart = useCallback(() => {
		lastTouchRef.current = Date.now();
		pressStart();
	}, [pressStart]);

	const handleTouchEnd = useCallback(() => {
		lastTouchRef.current = Date.now();
		pressEnd();
	}, [pressEnd]);

	const handleMouseDown = useCallback(() => {
		if (Date.now() - lastTouchRef.current < 700) return;
		pressStart();
	}, [pressStart]);

	const handleMouseUp = useCallback(() => {
		if (Date.now() - lastTouchRef.current < 700) return;
		pressEnd();
	}, [pressEnd]);

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

	/**
	 * Props that make a button inside the timer work with both a finger and a mouse.
	 *
	 * The timer area itself listens on touchstart, so every control on top of it has to stop
	 * propagation or pressing it would also arm the timer. Touch alone was enough while battle
	 * was phone-only, but it leaves every control dead under a mouse, which is the only way
	 * the page can be driven in a desktop browser.
	 *
	 * Binding both events means a single tap would fire twice: a touch produces touchstart and
	 * then a synthetic click. The timestamp swallows that second one. One ref serves every
	 * button here because a person is using either a finger or a mouse, not both at once.
	 *
	 * mousedown and mouseup are bound purely to stop them, and leaving them out broke these
	 * buttons outright under a mouse. The half listens on mousedown, so the press meant for the
	 * button also armed the timer underneath it: the half went to PRIMING, which drops
	 * showPenalties, which unmounts these very buttons, and the click that followed landed on
	 * nothing. Touch never hit this because touchstart is stopped and the synthetic mousedown
	 * behind it is caught by the timestamp guard, so the bug only ever showed in a desktop
	 * browser.
	 */
	const lastTouchRef = useRef(0);
	const tapProps = useCallback(
		(fn: () => void) => ({
			onTouchStart: (e: React.TouchEvent) => {
				e.stopPropagation();
				lastTouchRef.current = Date.now();
				fn();
			},
			onMouseDown: (e: React.MouseEvent) => e.stopPropagation(),
			onMouseUp: (e: React.MouseEvent) => e.stopPropagation(),
			onClick: (e: React.MouseEvent) => {
				e.stopPropagation();
				if (Date.now() - lastTouchRef.current < 700) return;
				fn();
			},
		}),
		[]
	);

	// Cube settings live behind the cube button rather than in the battle menu: everything in
	// them is about THIS player's cube, and the menu is shared by both players.
	const [cubePanelOpen, setCubePanelOpen] = useState(false);

	/**
	 * The cube button acts on CLICK, not on touchstart, unlike every other control here.
	 *
	 * Web Bluetooth refuses requestDevice unless the user gesture is still live when it runs,
	 * and the picker sits at the end of a long async chain (provider -> link -> Connect ->
	 * adapter). A touchstart does not carry the gesture that far under Chrome's touch
	 * emulation, which is why the first press failed with "Must be handling a user gesture".
	 * A click carries it on both desktop and mobile, and it is what the timer page uses.
	 *
	 * touchstart is still bound, but only to keep the press off the timer underneath it, and
	 * mousedown and mouseup for the same reason: without them a mouse press on this button also
	 * armed the timer and left the half sitting on a ready state nobody asked for.
	 */
	const cubeButtonProps = {
		onTouchStart: (e: React.TouchEvent) => e.stopPropagation(),
		onMouseDown: (e: React.MouseEvent) => e.stopPropagation(),
		onMouseUp: (e: React.MouseEvent) => e.stopPropagation(),
		onClick: (e: React.MouseEvent) => {
			e.stopPropagation();
			handleCubeButtonRef.current();
		},
	};

	const handleCubeButton = useCallback(() => {
		if (link.state === 'connected') {
			setCubePanelOpen((open) => !open);
			return;
		}
		if (link.state === 'scanning' || link.state === 'connecting') return;
		void connectCube(player);
	}, [link.state, connectCube, player]);

	// Read at click time so the props object above can stay stable and still call the current
	// handler; rebuilding the props every render would be fine too, this just keeps it honest.
	const handleCubeButtonRef = useRef(handleCubeButton);
	handleCubeButtonRef.current = handleCubeButton;

	// A cube that drops takes its settings panel with it, otherwise the panel would sit there
	// offering to reset the state of a cube that is no longer on the line.
	useEffect(() => {
		if (link.state !== 'connected') setCubePanelOpen(false);
	}, [link.state]);

	// --- Stats ---
	const playerStats = useMemo(() => getPlayerStats(rounds, player), [rounds, player]);

	// --- Time text ---
	const isIdle = status === 'RESTING' && !alreadySolved;
	let timeText: string;
	if (isIdle) {
		// With a cube on the line the player scrambles instead of tapping, so the prompt has
		// to say so, otherwise the screen tells them to do the one thing that now does nothing.
		timeText = smartActive ? t('battle.scramble_cube') : t('battle.tap_to_start');
	} else if (status === 'PRIMING') {
		timeText = smartActive ? t('battle.cube_ready') : '0.00';
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
		// Which screen edge this half touches, so the stylesheet can keep it clear of the notch
		// and the home indicator. The sheet used to work this out with :first-child and
		// :nth-child(3), which match nothing: the screen-reader heading is the block's first
		// child, so the halves are the second and the fourth element.
		top: player === 1,
		bottom: player === 2,
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
	const showScoreBadge = settings.showScore && !roundActive;
	/**
	 * The streak used to carry a !showPenalties guard as well, because it sat in the top-right
	 * corner and the penalty buttons claim that corner. The guard made it unreachable: a round
	 * only advances on PLAYER_START, so between rounds both players are holding a finished solve,
	 * which is exactly the state that puts the penalty buttons on screen. It was never once
	 * visible, at any streak length. It now sits beside the score on the left instead, so it no
	 * longer competes for the corner and the guard is gone.
	 */
	const showStreakBadge =
		settings.showWinStreak && !roundActive && winStreak.count >= 2 && winStreak.player === player;
	// The cube button stays out of the way while a solve is running.
	const showCubeButton = status !== 'TIMING' && !roundActive;

	/**
	 * Scramble done, waiting to start: the screen already says "Hazır" where the time goes, so
	 * the scramble underneath it is finished work and only adds noise. The timer page does the
	 * same, replacing the move list with "ready" rather than showing both.
	 *
	 * Touch play keeps its scramble here, because PRIMING there is a finger held on the screen
	 * for a moment, not a state the player sits in.
	 */
	const readyWithCube = smartActive && status === 'PRIMING';

	/**
	 * The mirror stays up for the whole round, including after a solve: it is how a player
	 * checks their cube is still the connected one and still in step. Only a running solve
	 * hides it, where the screen belongs to the time and nothing else.
	 *
	 * It stays MOUNTED when hidden. Tearing the player down would lose the visual state, and
	 * rebuilding a WebGL context per round is far more expensive than parking one.
	 */
	const showCubePreview = smartActive && status !== 'TIMING';

	// What the scramble area shows, in the same priority order the timer page uses.
	//
	// The correction REPLACES the scramble rather than sitting under it. An unchanged
	// scramble with a hint below it is exactly what the eye skips: the player keeps reading
	// the algorithm they were working through and turns straight past their mistake.
	// The cube and the app disagree about where the cube is. Either it connected already
	// scrambled, or its firmware state drifted from its physical one (turned while asleep).
	// Both are unrecoverable from the move stream, and both have the same way out.
	//
	// Only while the player still has to scramble. Once the scramble is done the timer is
	// PRIMING and the cube is SUPPOSED to be scrambled, so the "solve it first" warning would
	// be telling the player their correctly scrambled cube is wrong.
	//
	// Only the engine's own two "I cannot place this cube" verdicts count. A cube that merely
	// reports itself unsolved is NOT one of them: some firmware carries a state that has drifted
	// from the physical cube, and the engine still tracks a scramble from there perfectly well.
	// Warning on that alone shouted at a cube that was working, which is a thing the timer page
	// has never done either.
	const cubeMismatch =
		status === 'RESTING' &&
		(outOfSync || (undoMoves && undoMoves.length === 1 && undoMoves[0] === 'TOO_MANY'));

	let scrambleBody: React.ReactNode = currentScramble;
	if (smartActive) {
		if (cubeMismatch) {
			// Message only. "Mark as solved" lives in the cube button's settings panel, which is
			// where it belongs and where it stays reachable; having it in both places offered
			// the same action twice on one screen.
			scrambleBody = (
				<div className={b('cube-alert')}>
					{/* Same wording the timer page uses for the out-of-sync state, rather than a
					    second phrasing for the same problem. */}
					{outOfSync ? t('smart_scramble.out_of_sync') : t('battle.cube_just_solve')}
				</div>
			);
		} else if (undoMoves && undoMoves.length) {
			scrambleBody = <span className={b('cube-undo')}>{undoMoves.join(' ')}</span>;
		} else if (matchStatus.length > 0) {
			scrambleBody = (
				<ScrambleMoveList
					moves={currentScramble.trim().split(/\s+/)}
					matchStatus={matchStatus}
					useBlueMatch={useBlueMatch}
				/>
			);
		}
	}

	return (
		<div
			className={b('timer', timerMod)}
			onTouchStart={handleTouchStart}
			onTouchEnd={handleTouchEnd}
			onMouseDown={handleMouseDown}
			onMouseUp={handleMouseUp}
		>
			{/* Top-left of the strip: the score, and the streak beside it when there is one.
			    Grouped in one row so the two read as a pair and cannot land on top of each
			    other, which is what a second absolute corner would have risked. */}
			{(showScoreBadge || showStreakBadge) && (
				<div className={b('top-left')}>
					{showScoreBadge && (
						<div className={b('score-badge', { winning: isWinning, losing: isLosing })}>{score}</div>
					)}
					{showStreakBadge && (
						<div className={b('streak-badge')}>
							{t('battle.streak')}: {winStreak.count}
						</div>
					)}
				</div>
			)}

			{/* Cube connect / disconnect */}
			{showCubeButton && (
				<button
					className={b('cube-btn', {
						connected: link.state === 'connected',
						busy: link.state === 'scanning' || link.state === 'connecting',
					})}
					{...cubeButtonProps}
				>
					<CubeGlyph size={16} />
					<span className={b('cube-btn-label')}>
						{link.state === 'connected'
							? link.deviceName || t('battle.cube_connected')
							: link.state === 'scanning' || link.state === 'connecting'
								? t('battle.cube_connecting')
								: t('battle.connect_cube')}
					</span>
					{link.state === 'connected' && link.batteryLevel != null && (
						<span className={b('cube-btn-battery')}>{link.batteryLevel}%</span>
					)}
				</button>
			)}

			{/* 3D mirror of this player's cube. It sits in the bottom corner OPPOSITE this
			    player's stats, the one corner left free: the badges own the top and the cube
			    button the bottom centre. On the rotated half that corner lands top-right on
			    screen, which is the same corner from that player's own seat. */}
			{smartActive && (
				<div
					className={b('cube-preview', {
						hidden: !showCubePreview,
						left: player === 1,
						right: player === 2,
					})}
				>
					<SmartCubeView
						ref={cubeViewRef}
						connected={smartActive}
						// The player frames the cube with a wide margin at this camera angle, so
						// the drawing comes out well under the number given here. Capped by the
						// cube button beside it: measured at 320px with a connected cube and its
						// longest label, anything past 85 puts the cube under the button.
						size={previewSize}
						hidden={!showCubePreview}
						turns={cubeStream[player].turns}
						facelets={cubeStream[player].facelets}
						// This player's own cube, never the app-wide manager's: that one is a
						// different cube and would turn the model with someone else's hands.
						gyroSource={gyroSource}
					/>
				</div>
			)}

			{/* Cube settings, opened from the cube button below it */}
			{showCubeButton && smartActive && cubePanelOpen && (
				<div className={b('cube-panel')}>
					<div className={b('cube-panel-state')}>
						{link.physicallySolved === null
							? t('battle.cube_state_unknown')
							: link.physicallySolved
								? t('battle.cube_state_solved')
								: t('battle.cube_state_scrambled')}
					</div>
					<button
						className={b('cube-panel-btn')}
						{...tapProps(() => {
							void markSolved(player);
							setCubePanelOpen(false);
						})}
					>
						{t('battle.cube_mark_solved')}
					</button>
					<button
						className={b('cube-panel-btn', { danger: true })}
						{...tapProps(() => {
							disconnectCube(player);
							setCubePanelOpen(false);
						})}
					>
						{t('battle.cube_disconnect')}
					</button>
				</div>
			)}

			{/* Penalty buttons — top right corner */}
			{showPenalties && (
				<div className={b('penalties')}>
					<button
						className={b('penalty-btn', { 'active-plus2': penalty === 'plus2' })}
						{...tapProps(() => applyPenalty('plus2'))}
					>
						+2
					</button>
					<button
						className={b('penalty-btn', { 'active-dnf': penalty === 'dnf' })}
						{...tapProps(() => applyPenalty('dnf'))}
					>
						DNF
					</button>
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

			{/* Scramble — hide when round is active (someone solving). With a cube connected
			    this area doubles as the correction display: see scrambleBody above. */}
			{settings.showScramble && !roundActive && status !== 'TIMING' && !readyWithCube && (
				<div className={b('scramble')}>{scrambleBody}</div>
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

/** Small 3x3 grid, the same mark the scanning picker uses for a cube. */
function CubeGlyph({ size = 14 }: { size?: number }) {
	const gap = size * 0.13;
	const cell = (size - gap * 4) / 3;
	const cells: React.ReactNode[] = [];
	for (let r = 0; r < 3; r++) {
		for (let c = 0; c < 3; c++) {
			cells.push(
				<rect
					key={`${r}-${c}`}
					x={gap + c * (cell + gap)}
					y={gap + r * (cell + gap)}
					width={cell}
					height={cell}
					rx={cell * 0.18}
					fill="currentColor"
				/>
			);
		}
	}
	return (
		<svg width={size} height={size} style={{ pointerEvents: 'none' }}>
			{cells}
		</svg>
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
