/**
 * Minimal animation/tween engine for Rubik's cube layer rotations.
 * Ported and cleaned up from Dev-tanay/Rubik-Cube, adapted for TypeScript.
 */

export type EasingFn = (t: number) => number;

// ============================================
// Easing Functions
// ============================================

export const Easing = {
	Power: {
		Out: (power = 3): EasingFn => (t) => 1 - Math.abs(Math.pow(t - 1, power)),
		In: (power = 3): EasingFn => (t) => Math.pow(t, power),
		InOut: (power = 3): EasingFn => (t) =>
			t < 0.5
				? Math.pow(t * 2, power) / 2
				: (1 - Math.abs(Math.pow(t * 2 - 2, power))) / 2 + 0.5,
	},
	Sine: {
		Out: (): EasingFn => (t) => Math.sin((Math.PI / 2) * t),
		In: (): EasingFn => (t) => 1 + Math.sin((Math.PI / 2) * t - Math.PI / 2),
	},
	Back: {
		Out: (s = 1.70158): EasingFn => (t) => {
			t -= 1;
			return t * t * ((s + 1) * t + s) + 1;
		},
	},
};

// ============================================
// Animation Engine (singleton)
// ============================================

interface ActiveTween {
	update(delta: number): void;
}

class AnimationEngine {
	private tweens = new Map<number, ActiveTween>();
	private nextId = 0;
	private raf = 0;
	private lastTime = 0;

	add(tween: ActiveTween): number {
		const id = this.nextId++;
		this.tweens.set(id, tween);
		if (!this.raf) {
			this.lastTime = performance.now();
			this.raf = requestAnimationFrame(this.tick);
		}
		return id;
	}

	remove(id: number) {
		this.tweens.delete(id);
	}

	private tick = () => {
		const now = performance.now();
		const delta = now - this.lastTime;
		this.lastTime = now;

		this.tweens.forEach((tw) => tw.update(delta));

		this.raf = this.tweens.size > 0 ? requestAnimationFrame(this.tick) : 0;
	};
}

const engine = new AnimationEngine();

// ============================================
// Tween
// ============================================

export class Tween {
	private id: number;
	private progress = 0;
	private value = 0;

	constructor(
		private duration: number,
		private easing: EasingFn,
		private onUpdate: (delta: number) => void,
		private onComplete: () => void,
	) {
		this.id = engine.add(this);
	}

	update(delta: number) {
		const old = this.value;
		this.progress += delta / this.duration;

		if (this.progress >= 1) {
			this.progress = 1;
			this.value = 1;
			this.onUpdate(this.value - old);
			this.onComplete();
			engine.remove(this.id);
		} else {
			this.value = this.easing(this.progress);
			this.onUpdate(this.value - old);
		}
	}

	stop() {
		engine.remove(this.id);
	}
}
