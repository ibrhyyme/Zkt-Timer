import { parseMove, type ParsedMove } from './notation';
import type { CubeModel, Cubie } from './cube_model';

/**
 * Plays turns one after another, each on a damped spring: the layer overshoots its slot by
 * a few degrees and settles, which is what makes it read as plastic clicking into place
 * rather than a diagram sliding.
 *
 * The view mirrors a real cube, so it must never fall behind it. Three rules keep it level:
 *  - a backlog stiffens the spring of the next turn, so queued turns play faster;
 *  - while turns are waiting, the current one hands over as soon as it first reaches its
 *    slot instead of playing out its settle;
 *  - past MAX_BACKLOG, the oldest turns are applied instantly.
 */

/** Damping ratio: below 1 overshoots. 0.7 gives about a 5% overshoot that settles in one swing. */
const ZETA = 0.7;
/** Natural frequency (rad/s) of an unhurried quarter turn: first reaches its slot in ~90 ms. */
const BASE_OMEGA = 49;
/** Half turns cover twice the angle; a slightly softer spring keeps them from looking snapped. */
const HALF_TURN_OMEGA_SCALE = 0.8;
const BACKLOG_STIFFEN = 0.6;
const MAX_BACKLOG = 6;
/** Below this envelope the remaining wobble is under a tenth of a degree. */
const SETTLE_ENVELOPE = 0.002;

export interface ActiveTurn {
	move: ParsedMove;
	cubies: Cubie[];
	/** Full angle of the turn, radians. */
	target: number;
	/** Current angle, radians. */
	angle: number;
	start: number;
	omega: number;
}

/** Fraction of the turn done at `t` seconds: 0 at the start, oscillating about 1 afterwards. */
export function springProgress(t: number, omega: number, zeta = ZETA): number {
	if (t <= 0) return 0;
	const wd = omega * Math.sqrt(1 - zeta * zeta);
	const env = Math.exp(-zeta * omega * t);
	return 1 - env * (Math.cos(wd * t) + ((zeta * omega) / wd) * Math.sin(wd * t));
}

const peakTime = (omega: number) => Math.PI / (omega * Math.sqrt(1 - ZETA * ZETA));
const settleTime = (omega: number) => -Math.log(SETTLE_ENVELOPE) / (ZETA * omega);

export class TurnAnimator {
	private queue: ParsedMove[] = [];
	active: ActiveTurn | null = null;

	constructor(private model: CubeModel) {}

	get busy(): boolean {
		return !!this.active || this.queue.length > 0;
	}

	/** Queue a turn. Unknown notation and turns that move nothing are dropped. */
	push(text: string): boolean {
		const move = parseMove(text);
		if (!move || !move.quarters) return false;
		this.queue.push(move);
		return true;
	}

	/** Drop everything pending, leaving the model where it is (mid-turn turns are not applied). */
	clear() {
		this.queue = [];
		this.active = null;
	}

	/** Apply the current and all queued turns at once. */
	flush() {
		if (this.active) this.finish();
		while (this.queue.length) {
			const move = this.queue.shift() as ParsedMove;
			this.model.commit(move.axis, move.quarters, this.model.select(move));
		}
	}

	/**
	 * Advance to `now` (ms). Returns true when something moved, so the caller knows to draw.
	 * Cubies of the active turn are not yet committed: their drawn transform is the model's
	 * plus `active.angle` about the turn axis.
	 */
	update(now: number): boolean {
		let moved = false;
		while (this.queue.length > MAX_BACKLOG) {
			if (this.active) this.finish();
			const move = this.queue.shift() as ParsedMove;
			this.model.commit(move.axis, move.quarters, this.model.select(move));
			moved = true;
		}

		if (this.active) {
			const a = this.active;
			const t = (now - a.start) / 1000;
			if (t >= settleTime(a.omega) || (this.queue.length > 0 && t >= peakTime(a.omega))) {
				this.finish();
			} else {
				a.angle = a.target * springProgress(t, a.omega);
			}
			moved = true;
		}

		if (!this.active && this.queue.length) {
			const move = this.queue.shift() as ParsedMove;
			let omega = BASE_OMEGA * (1 + BACKLOG_STIFFEN * this.queue.length);
			if (Math.abs(move.quarters) === 2) omega *= HALF_TURN_OMEGA_SCALE;
			this.active = {
				move,
				cubies: this.model.select(move),
				target: (move.quarters * Math.PI) / 2,
				angle: 0,
				start: now,
				omega,
			};
			moved = true;
		}
		return moved;
	}

	private finish() {
		const a = this.active;
		if (!a) return;
		this.model.commit(a.move.axis, a.move.quarters, a.cubies);
		this.active = null;
	}
}
