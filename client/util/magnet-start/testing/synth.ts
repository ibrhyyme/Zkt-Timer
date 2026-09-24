// Seeded synthetic magnetometer signals for the detector tests. Test-only.
import type { MagnetSample, Vec3 } from '../types';

function mulberry32(seed: number): () => number {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

export interface SynthOptions {
	rateHz?: number;
	/** Per-axis Gaussian noise, uT. iPhone ~0.15, Fold ~0.8. */
	noise?: number;
	seed?: number;
	t0?: number;
}

export const IOS_NOISE = 0.15;
export const ANDROID_NOISE = 0.8;

export class SignalBuilder {
	private readonly dt: number;
	private readonly noise: number;
	private readonly rand: () => number;
	private t: number;
	private cur: Vec3;
	private out: MagnetSample[] = [];
	private spare: number | null = null;

	constructor(start: Vec3, opts: SynthOptions = {}) {
		this.dt = 1000 / (opts.rateHz ?? 100);
		this.noise = opts.noise ?? IOS_NOISE;
		this.rand = mulberry32(opts.seed ?? 1);
		this.t = opts.t0 ?? 1_790_000_000_000;
		this.cur = [start[0], start[1], start[2]];
	}

	/** Current simulated time (time of the next sample). */
	now(): number {
		return this.t;
	}

	/** Time of the last emitted sample. */
	lastT(): number {
		return this.out.length ? this.out[this.out.length - 1].t : this.t;
	}

	hold(ms: number): this {
		const n = Math.round(ms / this.dt);
		for (let i = 0; i < n; i++) this.emit(this.cur);
		return this;
	}

	/** Sigmoid (smooth) move from the current vector to `to` over `ms`. */
	moveTo(to: Vec3, ms: number): this {
		const from = this.cur;
		const n = Math.max(1, Math.round(ms / this.dt));
		for (let i = 1; i <= n; i++) {
			const x = i / n;
			const k = 1 / (1 + Math.exp(-12 * (x - 0.5)));
			const k0 = 1 / (1 + Math.exp(6));
			const k1 = 1 / (1 + Math.exp(-6));
			const f = (k - k0) / (k1 - k0);
			this.emit([from[0] + (to[0] - from[0]) * f, from[1] + (to[1] - from[1]) * f, from[2] + (to[2] - from[2]) * f]);
		}
		this.cur = [to[0], to[1], to[2]];
		return this;
	}

	/** A short excursion by `offset` that returns to the current vector (vibration, speaker). */
	spike(offset: Vec3, ms: number): this {
		const n = Math.max(1, Math.round(ms / this.dt));
		for (let i = 0; i < n; i++) {
			const f = Math.sin((Math.PI * (i + 1)) / (n + 1));
			this.emit([this.cur[0] + offset[0] * f, this.cur[1] + offset[1] * f, this.cur[2] + offset[2] * f]);
		}
		return this;
	}

	/** Skips time without samples (a stall in delivery). */
	gap(ms: number): this {
		this.t += ms;
		return this;
	}

	samples(): MagnetSample[] {
		return this.out.slice();
	}

	private emit(v: Vec3): void {
		this.out.push({ t: this.t, x: v[0] + this.gauss(), y: v[1] + this.gauss(), z: v[2] + this.gauss() });
		this.t += this.dt;
	}

	private gauss(): number {
		if (this.noise === 0) return 0;
		if (this.spare !== null) {
			const s = this.spare;
			this.spare = null;
			return s * this.noise;
		}
		let u = 0;
		let v = 0;
		while (u === 0) u = this.rand();
		while (v === 0) v = this.rand();
		const mag = Math.sqrt(-2 * Math.log(u));
		this.spare = mag * Math.sin(2 * Math.PI * v);
		return mag * Math.cos(2 * Math.PI * v) * this.noise;
	}
}

export function add(a: Vec3, b: Vec3): Vec3 {
	return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}
