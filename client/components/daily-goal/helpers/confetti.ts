import confetti from 'canvas-confetti';
import { requestInAppReview } from '../../../util/native-plugins';

let lastGoalConfetti = 0;

export function triggerGoalConfetti() {
	const now = Date.now();
	if (now - lastGoalConfetti < 2000) return;
	lastGoalConfetti = now;

	const defaults = {
		startVelocity: 30,
		spread: 200,
		ticks: 80,
		zIndex: 10000,
		particleCount: 80,
		colors: ['#22c55e', '#4ade80', '#86efac', '#16a34a', '#ffffff'],
	};

	confetti({
		...defaults,
		origin: {x: 0.2, y: 0.6},
	});
	confetti({
		...defaults,
		origin: {x: 0.8, y: 0.6},
	});

	// Yuksek mutluluk ani — celebration animasyonu sonrasi review prompt.
	// requestInAppReview session-level dedup yapiyor (tek session'da bir kez).
	setTimeout(() => {
		requestInAppReview();
	}, 5000);
}
