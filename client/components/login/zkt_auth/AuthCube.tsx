import React, { useCallback, useEffect, useRef, useState } from 'react';
import block from '../../../styles/bem';

const b = block('zkt-auth');

/**
 * Fixed auth scramble — same cube state on every visit.
 * 20 moves, uses all faces, visually sufficiently scrambled.
 * Login (2 fields) → each field solves 10 moves.
 * Signup (5 fields) → each field solves 4 moves.
 * When all fields are filled, cube is completely solved, submit is just slide-up.
 */
const AUTH_SCRAMBLE = [
	'R', 'U', "R'", 'F', "L'", 'D2',
	'B', "R'", "U'", 'F2', 'L', "B'",
	'U', "D'", 'R2', 'F', "U'", 'L2', "B'", 'R',
] as const;

const SCRAMBLE_LENGTH = AUTH_SCRAMBLE.length;
const DRAIN_POLL_MS = 80;

interface AuthCubeProps {
	/** 0 (fully solved) .. 1 (max scrambled). Comes from useChoreography. */
	chaos?: number;
	/** Submit success flag. When true, all remaining moves are completed. */
	solvedGlow?: boolean;
	/** Mode switch / reset trigger. Cube rescrambles on each increment. */
	resetSignal?: number;
	/** Cube canvas pixel size (square). */
	size?: number;
}

function invertMove(move: string): string {
	const face = move[0];
	const mod = move[1];
	if (!mod) return face + "'";
	if (mod === "'") return face;
	if (mod === '2') return move; // self-inverse
	return move;
}

// Solve sequence = reverse scramble order and invert each move
const AUTH_SOLVE = AUTH_SCRAMBLE.slice().reverse().map(invertMove);

export default function AuthCube({
	chaos = 1,
	size = 460,
	solvedGlow = false,
	resetSignal = 0,
}: AuthCubeProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const gameRef = useRef<any>(null);

	// pendingTargetRef = target solve move count calculated from chaos diff.
	// appliedSolveCountRef = actual move count sent to queue.
	// pollingRef = interval id to drain pending moves while animation queue is full.
	// rescrambleNeededRef = set by resetSignal, consumed in drain.
	const appliedSolveCountRef = useRef<number>(0);
	const pendingTargetRef = useRef<number>(0);
	const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
	const rescrambleNeededRef = useRef<boolean>(false);
	const [ready, setReady] = useState<boolean>(false);

	const stopPolling = useCallback(() => {
		if (pollingRef.current) {
			clearInterval(pollingRef.current);
			pollingRef.current = null;
		}
	}, []);

	// tryDrain: keep animation queue continuously in sync. If Cube controls.scramble
	// is full, set up polling; if empty, do next task (rescramble or solve chunk).
	// F1: dropped-moves race fix → if applyMovesAnimated bails, polling continues,
	// chunk applies as soon as animation empties.
	const tryDrain = useCallback(() => {
		const game = gameRef.current;
		if (!game) return;

		const ensurePolling = () => {
			if (!pollingRef.current) {
				pollingRef.current = setInterval(tryDrain, DRAIN_POLL_MS);
			}
		};

		// Animation queue full — wait until empty
		if (game.controls.scramble !== null) {
			ensurePolling();
			return;
		}

		// If rescramble pending, do it first (F3: mode switch)
		if (rescrambleNeededRef.current) {
			rescrambleNeededRef.current = false;
			appliedSolveCountRef.current = 0;
			pendingTargetRef.current = 0;
			game.applyMovesAnimated(AUTH_SCRAMBLE.slice());
			ensurePolling();
			return;
		}

		// Apply solve chunk
		if (pendingTargetRef.current <= appliedSolveCountRef.current) {
			stopPolling();
			return;
		}

		const prev = appliedSolveCountRef.current;
		const target = pendingTargetRef.current;
		const chunk = AUTH_SOLVE.slice(prev, target);

		if (chunk.length === 0) {
			stopPolling();
			return;
		}

		appliedSolveCountRef.current = target;
		game.applyMovesAnimated(chunk);
		ensurePolling();
	}, [stopPolling]);

	// Mount: instantiate CubeGame, disable drag, initial scramble
	useEffect(() => {
		const container = containerRef.current;
		if (!container) return;
		// Don't init Three.js on mobile — parent CSS display:none already hides it,
		// we skip WebGL canvas creation for bundle/perf savings.
		if (typeof window !== 'undefined' && window.innerWidth <= 768) return;

		let disposed = false;

		import('../../landing/welcome/hero_section/cube/game').then(({ CubeGame }) => {
			if (disposed) return;
			const game = new CubeGame(container);
			gameRef.current = game;

			// No drag — auth cube is auto-animation only
			game.controls.disable();

			// Brief delay: user sees solved cube first, then scramble starts
			setTimeout(() => {
				if (disposed) return;
				game.applyMovesAnimated(AUTH_SCRAMBLE.slice());
				appliedSolveCountRef.current = 0;
				pendingTargetRef.current = 0;
				// F2: set ready state → chaos useEffect re-fires, drain catches
				// chaos changes missed during init.
				setReady(true);
			}, 600);
		}).catch((err) => {
			console.warn('[AuthCube] CubeGame failed to load:', err);
		});

		return () => {
			disposed = true;
			stopPolling();
			rescrambleNeededRef.current = false;
			gameRef.current?.dispose();
			gameRef.current = null;
			setReady(false);
		};
	}, [stopPolling]);

	// On chaos prop change — update target solve count + drain.
	// F1: if applyMovesAnimated bails, appliedSolveCountRef doesn't jump, polling
	// applies correct chunk when drain finishes.
	// F2: added to ready dependency → catch-up missed chaos at init end.
	useEffect(() => {
		if (!ready) return;
		const game = gameRef.current;
		if (!game) return;

		// progress = 1 - chaos. chaos 1.0 → 0 (mount → success)
		const progress = Math.max(0, Math.min(1, 1 - chaos));
		const targetSolveCount = Math.min(SCRAMBLE_LENGTH, Math.floor(progress * SCRAMBLE_LENGTH));

		if (targetSolveCount > pendingTargetRef.current) {
			pendingTargetRef.current = targetSolveCount;
		}
		tryDrain();
	}, [chaos, ready, tryDrain]);

	// solvedGlow → apply all remaining solve moves (fallback path)
	useEffect(() => {
		if (!ready || !solvedGlow) return;
		pendingTargetRef.current = SCRAMBLE_LENGTH;
		tryDrain();
	}, [solvedGlow, ready, tryDrain]);

	// F3: on resetSignal change, trigger rescramble. Initial value 0 → skip.
	useEffect(() => {
		if (resetSignal === 0) return;
		if (!ready) return;
		rescrambleNeededRef.current = true;
		tryDrain();
	}, [resetSignal, ready, tryDrain]);

	return (
		<div
			className={b('cube-stage', { solved: solvedGlow })}
			style={{ width: size, height: size }}
		>
			<div className={b('cube-halo')} />
			<div className={b('cube-halo', { inner: true })} />

			<div className={b('cube-sonar')} aria-hidden="true">
				<span style={{ animationDelay: '0s' }} />
				<span style={{ animationDelay: '1.2s' }} />
				<span style={{ animationDelay: '2.4s' }} />
			</div>

			<div
				ref={containerRef}
				className={b('cube-canvas')}
				style={{ width: size, height: size }}
			/>

			<div className={b('cube-shadow')} />
		</div>
	);
}
