import confetti from 'canvas-confetti';

let lastHeroConfetti = 0;

export function triggerHeroCubeConfetti() {
	const now = Date.now();
	if (now - lastHeroConfetti < 3000) return;
	lastHeroConfetti = now;

	const colors = ['#b71234', '#0046ad', '#009b48', '#ffd500', '#ff5800', '#ffffff'];

	confetti({
		particleCount: 100,
		spread: 160,
		startVelocity: 35,
		ticks: 100,
		zIndex: 10000,
		origin: { x: 0.5, y: 0.5 },
		colors,
	});
}
