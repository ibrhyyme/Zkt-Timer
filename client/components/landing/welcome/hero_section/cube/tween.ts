/**
 * Animation engine + Tween + Easing.
 * Direct port of Dev-tanay/Rubik-Cube (script.js lines 1-92, 937-1117).
 *
 * Hierarchy:
 *   AnimationEngine (singleton) — RAF loop, tracks active animations
 *   Animation (base)            — start()/stop() lifecycle, override update(delta)
 *   Tween extends Animation     — interpolates over duration, supports target/from/to,
 *                                 onUpdate, onComplete, easing, yoyo, delay
 */

export type EasingFn = (t: number) => number;

// ============================================
// AnimationEngine — singleton RAF driver
// ============================================

let uniqueID = 0;

class AnimationEngine {
	private ids: number[] = [];
	private animations: Record<number, Animation> = {};
	private raf = 0;
	private time = 0;

	private update = () => {
		const now = performance.now();
		const delta = now - this.time;
		this.time = now;

		let i = this.ids.length;
		this.raf = i ? requestAnimationFrame(this.update) : 0;

		while (i--) {
			if (this.animations[this.ids[i]]) this.animations[this.ids[i]].update(delta);
		}
	};

	add(animation: Animation) {
		(animation as any).id = uniqueID++;

		this.ids.push((animation as any).id);
		this.animations[(animation as any).id] = animation;

		if (this.raf !== 0) return;

		this.time = performance.now();
		this.raf = requestAnimationFrame(this.update);
	}

	remove(animation: Animation) {
		const id = (animation as any).id;
		const index = this.ids.indexOf(id);
		if (index < 0) return;

		this.ids.splice(index, 1);
		delete this.animations[id];
	}
}

export const animationEngine = new AnimationEngine();

// ============================================
// Animation — base class
// ============================================

export class Animation {
	constructor(start?: boolean) {
		if (start === true) this.start();
	}

	start() {
		animationEngine.add(this);
	}

	stop() {
		animationEngine.remove(this);
	}

	update(_delta: number) {
		/* override */
	}
}

// ============================================
// Easing
// ============================================

export const Easing = {
	Power: {
		In: (power?: number) => {
			const p = Math.round(power || 1);
			return (t: number) => Math.pow(t, p);
		},
		Out: (power?: number) => {
			const p = Math.round(power || 1);
			return (t: number) => 1 - Math.abs(Math.pow(t - 1, p));
		},
		InOut: (power?: number) => {
			const p = Math.round(power || 1);
			return (t: number) =>
				t < 0.5
					? Math.pow(t * 2, p) / 2
					: (1 - Math.abs(Math.pow((t * 2 - 1) - 1, p))) / 2 + 0.5;
		},
	},
	Sine: {
		In: () => (t: number) => 1 + Math.sin((Math.PI / 2) * t - Math.PI / 2),
		Out: () => (t: number) => Math.sin((Math.PI / 2) * t),
		InOut: () => (t: number) => (1 + Math.sin(Math.PI * t - Math.PI / 2)) / 2,
	},
	Back: {
		Out: (s?: number) => {
			const sv = s || 1.70158;
			return (t: number) => {
				t -= 1;
				return t * t * ((sv + 1) * t + sv) + 1;
			};
		},
		In: (s?: number) => {
			const sv = s || 1.70158;
			return (t: number) => t * t * ((sv + 1) * t - sv);
		},
	},
	Elastic: {
		Out: (amplitude?: number, period?: number) => {
			const PI2 = Math.PI * 2;
			const p1 = amplitude !== undefined && amplitude >= 1 ? amplitude : 1;
			let p2 = (period || 0.3) / (amplitude !== undefined && amplitude < 1 ? amplitude : 1);
			const p3 = (p2 / PI2) * (Math.asin(1 / p1) || 0);
			p2 = PI2 / p2;

			return (t: number) => p1 * Math.pow(2, -10 * t) * Math.sin((t - p3) * p2) + 1;
		},
	},
};

// ============================================
// Tween
// ============================================

export interface TweenOptions {
	duration?: number;
	easing?: EasingFn;
	onUpdate?: (tween: Tween) => void;
	onComplete?: (tween: Tween) => void;
	delay?: number | false;
	yoyo?: boolean;
	target?: any;
	from?: Record<string, number>;
	to?: Record<string, number>;
}

export class Tween extends Animation {
	duration: number;
	easing: EasingFn;
	onUpdate: (tween: Tween) => void;
	onComplete: (tween: Tween) => void;

	delay: number | false;
	yoyo: boolean | null;

	progress = 0;
	value = 0;
	delta = 0;

	target: any = null;
	from: Record<string, number> = {};
	to: Record<string, number> | null = null;
	values: string[] | null = null;

	constructor(options: TweenOptions) {
		super(false);

		this.duration = options.duration || 500;
		this.easing = options.easing || ((t: number) => t);
		this.onUpdate = options.onUpdate || (() => { /* noop */ });
		this.onComplete = options.onComplete || (() => { /* noop */ });

		this.delay = options.delay || false;
		this.yoyo = options.yoyo ? false : null;

		this.progress = 0;
		this.value = 0;
		this.delta = 0;

		this.getFromTo(options);

		if (this.delay) setTimeout(() => super.start(), this.delay as number);
		else super.start();

		this.onUpdate(this);
	}

	update(delta: number) {
		const old = this.value * 1;
		const direction = this.yoyo === true ? -1 : 1;

		this.progress += (delta / this.duration) * direction;

		this.value = this.easing(this.progress);
		this.delta = this.value - old;

		if (this.values !== null) this.updateFromTo();

		if (this.yoyo !== null) this.updateYoyo();
		else if (this.progress <= 1) this.onUpdate(this);
		else {
			this.progress = 1;
			this.value = 1;
			this.onUpdate(this);
			this.onComplete(this);
			super.stop();
		}
	}

	private updateYoyo() {
		if (this.progress > 1 || this.progress < 0) {
			this.value = this.progress = this.progress > 1 ? 1 : 0;
			this.yoyo = !this.yoyo;
		}

		this.onUpdate(this);
	}

	private updateFromTo() {
		if (!this.values || !this.target || !this.to) return;
		this.values.forEach((key) => {
			this.target[key] = this.from[key] + (this.to![key] - this.from[key]) * this.value;
		});
	}

	private getFromTo(options: TweenOptions) {
		if (!options.target || !options.to) {
			this.values = null;
			return;
		}

		this.target = options.target;
		this.from = options.from || {};
		this.to = options.to;
		this.values = [];

		if (Object.keys(this.from).length < 1) {
			Object.keys(this.to).forEach((key) => {
				this.from[key] = this.target[key];
			});
		}

		Object.keys(this.to).forEach((key) => this.values!.push(key));
	}
}
