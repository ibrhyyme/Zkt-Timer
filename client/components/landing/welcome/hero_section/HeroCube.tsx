import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import block from '../../../../styles/bem';
import { triggerHeroCubeConfetti } from './cube/confetti';

const b = block('hero-cube');

type Phase = 'idle' | 'timing' | 'solved';

function formatCubeTimer(ms: number): string {
	const totalSeconds = ms / 1000;
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;
	if (minutes > 0) {
		return `${minutes}:${seconds.toFixed(2).padStart(5, '0')}`;
	}
	return seconds.toFixed(2);
}

export default function HeroCube() {
	const { t } = useTranslation();
	const containerRef = useRef<HTMLDivElement>(null);
	const gameRef = useRef<any>(null);
	const startTimeRef = useRef(0);
	const rafRef = useRef(0);

	const [phase, setPhase] = useState<Phase>('idle');
	const [elapsed, setElapsed] = useState(0);

	const tick = useCallback(() => {
		setElapsed(performance.now() - startTimeRef.current);
		rafRef.current = requestAnimationFrame(tick);
	}, []);

	useEffect(() => {
		if (phase === 'timing') {
			rafRef.current = requestAnimationFrame(tick);
			return () => cancelAnimationFrame(rafRef.current);
		}
		if (phase === 'solved') {
			cancelAnimationFrame(rafRef.current);
		}
	}, [phase, tick]);

	useEffect(() => {
		const container = containerRef.current;
		if (!container) return;

		let disposed = false;

		import('./cube/game').then(({ CubeGame }) => {
			if (disposed) return;
			const game = new CubeGame(container);
			gameRef.current = game;

			game.onFirstMove = () => {
				startTimeRef.current = performance.now();
				setPhase('timing');
			};

			game.onSolved = () => {
				setPhase('solved');
				triggerHeroCubeConfetti();
			};

			setTimeout(() => {
				if (!disposed) game.scramble(20);
			}, 1200);
		});

		return () => {
			disposed = true;
			cancelAnimationFrame(rafRef.current);
			gameRef.current?.dispose();
		};
	}, []);

	const handleRetry = useCallback(() => {
		const game = gameRef.current;
		if (!game) return;
		game.reset();
		setPhase('idle');
		setElapsed(0);
		game.scramble(20);
	}, []);

	return (
		<div ref={containerRef} className={b()}>
			<p className={b('hint', { phase })}>
				{phase === 'idle' && t('hero_cube.hint')}
				{phase === 'timing' && formatCubeTimer(elapsed)}
				{phase === 'solved' && (
					<>
						<span className={b('hint-time')}>{formatCubeTimer(elapsed)}</span>
						<button className={b('hint-retry')} onClick={handleRetry}>
							{t('hero_cube.try_again')}
						</button>
					</>
				)}
			</p>
		</div>
	);
}
