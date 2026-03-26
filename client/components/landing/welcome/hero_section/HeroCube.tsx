import React, { useEffect, useRef } from 'react';
import block from '../../../../styles/bem';

const b = block('hero-cube');

export default function HeroCube() {
	const containerRef = useRef<HTMLDivElement>(null);
	const gameRef = useRef<any>(null);

	useEffect(() => {
		const container = containerRef.current;
		if (!container) return;

		let disposed = false;

		// Dynamic import to avoid SSR issues (Three.js needs DOM)
		import('./cube/game').then(({ CubeGame }) => {
			if (disposed) return;
			const game = new CubeGame(container);
			gameRef.current = game;

			// Auto-scramble after a short delay
			setTimeout(() => {
				if (!disposed) game.scramble(20);
			}, 1200);
		});

		return () => {
			disposed = true;
			gameRef.current?.dispose();
		};
	}, []);

	return (
		<div ref={containerRef} className={b()}>
			<p className={b('hint')}>Küpü sürükleyerek çözmeye çalışın</p>
		</div>
	);
}
