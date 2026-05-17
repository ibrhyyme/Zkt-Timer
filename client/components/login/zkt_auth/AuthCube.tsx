import React, { useCallback, useEffect, useRef, useState } from 'react';
import block from '../../../styles/bem';

const b = block('zkt-auth');

/**
 * Sabit auth scramble — her ziyarette ayni cube state'i.
 * 20 hamle, tum face'leri kullanir, gorsel olarak yeterince karisik.
 * Login (2 alan) → her alan 10 hamle cozer.
 * Signup (5 alan) → her alan 4 hamle cozer.
 * Tum alanlar dolunca cube tamamen solved olur, submit sadece slide-up.
 */
const AUTH_SCRAMBLE = [
	'R', 'U', "R'", 'F', "L'", 'D2',
	'B', "R'", "U'", 'F2', 'L', "B'",
	'U', "D'", 'R2', 'F', "U'", 'L2', "B'", 'R',
] as const;

const SCRAMBLE_LENGTH = AUTH_SCRAMBLE.length;
const DRAIN_POLL_MS = 80;

interface AuthCubeProps {
	/** 0 (fully solved) .. 1 (max scrambled). useChoreography'den gelir. */
	chaos?: number;
	/** Submit success bayragi. true olunca kalan tum hamleler tamamlanir. */
	solvedGlow?: boolean;
	/** Mode switch / reset tetikleyici. Her artisinda cube rescramble olur. */
	resetSignal?: number;
	/** Cube canvas piksel boyutu (kare). */
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

// Solve sequence = scramble'i ters siraya alip her hamleyi inverse et
const AUTH_SOLVE = AUTH_SCRAMBLE.slice().reverse().map(invertMove);

export default function AuthCube({
	chaos = 1,
	size = 460,
	solvedGlow = false,
	resetSignal = 0,
}: AuthCubeProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const gameRef = useRef<any>(null);

	// pendingTargetRef = chaos diff'inden hesaplanan hedef solve hamle sayisi.
	// appliedSolveCountRef = gercekten kuyruga gonderilmis hamle sayisi.
	// pollingRef = animasyon dolu iken pending'i drain etmek icin interval id.
	// rescrambleNeededRef = resetSignal tarafindan setlenir, drain icinde tuketilir.
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

	// tryDrain: animasyon kuyrugunu surekli senkron tut. Cubey controls.scramble
	// doluysa polling kur, bos ise siradaki isi yap (rescramble veya solve chunk).
	// F1: dropped-moves race fix → applyMovesAnimated bail ederse polling devam
	// eder, animasyon bos kalir kalmaz chunk uygulanir.
	const tryDrain = useCallback(() => {
		const game = gameRef.current;
		if (!game) return;

		const ensurePolling = () => {
			if (!pollingRef.current) {
				pollingRef.current = setInterval(tryDrain, DRAIN_POLL_MS);
			}
		};

		// Animasyon dolu — bos kalana kadar bekle
		if (game.controls.scramble !== null) {
			ensurePolling();
			return;
		}

		// Rescramble bekliyorsa once onu yap (F3: mode switch)
		if (rescrambleNeededRef.current) {
			rescrambleNeededRef.current = false;
			appliedSolveCountRef.current = 0;
			pendingTargetRef.current = 0;
			game.applyMovesAnimated(AUTH_SCRAMBLE.slice());
			ensurePolling();
			return;
		}

		// Solve chunk uygula
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
		// Mobilde Three.js init etme — parent CSS display:none ile zaten gizliyor,
		// bundle/perf tasarrufu icin WebGL canvas yaratmiyoruz.
		if (typeof window !== 'undefined' && window.innerWidth <= 768) return;

		let disposed = false;

		import('../../landing/welcome/hero_section/cube/game').then(({ CubeGame }) => {
			if (disposed) return;
			const game = new CubeGame(container);
			gameRef.current = game;

			// Drag YOK — auth cube sadece otomatik animasyon
			game.controls.disable();

			// Kisa gecikme: kullanici once solved cube'u gorur, sonra scramble baslar
			setTimeout(() => {
				if (disposed) return;
				game.applyMovesAnimated(AUTH_SCRAMBLE.slice());
				appliedSolveCountRef.current = 0;
				pendingTargetRef.current = 0;
				// F2: ready state'i set et → chaos useEffect re-fire eder, init
				// sirasinda kacirilmis chaos degisikliklerini drain ile yakalar.
				setReady(true);
			}, 600);
		}).catch((err) => {
			console.warn('[AuthCube] CubeGame yuklenemedi:', err);
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

	// chaos prop degisiminde — hedef solve count'u guncelle + drain.
	// F1: applyMovesAnimated bail ederse appliedSolveCountRef sicramaz, polling
	// drain bittiginde dogru chunk'i uygular.
	// F2: ready dependency'sine eklendi → init bittiginde missed chaos catch-up.
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

	// solvedGlow → kalan tum solve hamlelerini uygula (yedek hat)
	useEffect(() => {
		if (!ready || !solvedGlow) return;
		pendingTargetRef.current = SCRAMBLE_LENGTH;
		tryDrain();
	}, [solvedGlow, ready, tryDrain]);

	// F3: resetSignal degisiminde rescramble tetikle. Initial value 0 → skip.
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
