import type { DetectorConfig } from './config';
import type {
	DetectorEvent,
	DetectorPhase,
	DetectorSnapshot,
	MagnetHint,
	MagnetSample,
	Vec3,
} from './types';

interface WindowStats {
	mean: Vec3;
	maxDev: number;
	/** Root mean square of the vector deviation from the mean. */
	rms: number;
	stable: boolean;
}

interface LiftInProgress {
	onset: number;
	triggerT: number;
	nearSince: number;
	ref: Vec3;
	sigma: number;
	nearDelta: number;
	trigger: number;
	band: number;
	peak: number;
	hold: number;
	returnSince: number | null;
}

interface FarCandidate {
	mean: Vec3;
	since: number;
	lastSeen: number;
}

// Trimming the history array is amortised: indices are dropped from the front only
// once this many stale entries have piled up.
const COMPACT_AFTER = 512;

export function distVV(a: Vec3, b: Vec3): number {
	const dx = a[0] - b[0];
	const dy = a[1] - b[1];
	const dz = a[2] - b[2];
	return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

export function distSV(s: MagnetSample, v: Vec3): number {
	const dx = s.x - v[0];
	const dy = s.y - v[1];
	const dz = s.z - v[2];
	return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Pure magnet lift detector. Feed it raw samples in time order; it returns what
 * happened. No DOM, no timers, no store: the same code runs on the phone and in Jest
 * against the recorded fixtures.
 *
 * Rules, all measured on vectors (a cube can shrink the field magnitude while moving
 * the vector by tens of uT):
 * - F is the far baseline, R the near plateau.
 * - "near" is only ever entered from "far": a static reading taken while the cube
 *   already rests at the phone can never be told apart from a changed baseline.
 * - A lift starts when the field leaves R by the trigger, is backdated to the last
 *   sample still on R, and is confirmed only once the field has travelled most of the
 *   way back to F. A deviation that falls back onto R was a spike (vibration, speaker);
 *   one that settles on a new near plateau was a re-placement.
 */
export class MagnetDetector {
	private readonly cfg: DetectorConfig;

	private buf: MagnetSample[] = [];
	private head = 0;

	private phase: DetectorPhase = 'unknown';
	private hint: MagnetHint = 'none';

	private far: Vec3 | null = null;
	private anchor: Vec3 | null = null;
	private candidate: FarCandidate | null = null;

	private ref: Vec3 | null = null;
	private refSigma = 0;
	private nearDelta: number | null = null;
	private nearSince: number | null = null;
	private farSince: number | null = null;
	private lift: LiftInProgress | null = null;

	private lastT: number | null = null;
	private lastSample: MagnetSample | null = null;
	private lastSigma: number | null = null;

	private rateFirstT: number | null = null;
	private rateCount = 0;
	private rateHz: number | null = null;

	private muteUntil = -Infinity;
	private pending: DetectorEvent[] = [];

	constructor(cfg: DetectorConfig, far?: Vec3 | null) {
		this.cfg = cfg;
		if (far) {
			this.far = [far[0], far[1], far[2]];
			this.anchor = [far[0], far[1], far[2]];
		}
	}

	getConfig(): DetectorConfig {
		return this.cfg;
	}

	getFar(): Vec3 | null {
		return this.far ? [this.far[0], this.far[1], this.far[2]] : null;
	}

	/** Replaces the far baseline and its anchor, and forgets the current state. */
	setFar(far: Vec3 | null): void {
		this.far = far ? [far[0], far[1], far[2]] : null;
		this.anchor = far ? [far[0], far[1], far[2]] : null;
		this.candidate = null;
		this.toUnknown(this.lastT ?? 0, false);
	}

	/**
	 * Forgets everything except the far baseline: stream restart, resize, fold. The next
	 * reading has to prove itself again, and the delivery rate is measured again.
	 */
	reset(): void {
		this.clearBuffer();
		this.lastT = null;
		this.lastSample = null;
		this.lastSigma = null;
		this.rateHz = null;
		this.muteUntil = -Infinity;
		this.phase = 'unknown';
		this.hint = 'none';
		this.dropNearState();
		this.farSince = null;
		this.candidate = null;
		this.pending = [];
	}

	/** Ignore lift triggers until this sample time (our own vibration shakes the field). */
	mute(untilT: number): void {
		this.muteUntil = Math.max(this.muteUntil, untilT);
	}

	/**
	 * Takes the current steady reading as the far baseline. The caller promises the cube
	 * is away. Returns false when the reading is not steady long enough to trust.
	 */
	relearnFar(): { ok: boolean; events: DetectorEvent[] } {
		if (this.phase === 'unsupported' || this.lastT === null || this.buf.length - this.head === 0) {
			return { ok: false, events: [] };
		}
		const st = this.stats(this.buf.length - 1, this.cfg.relearnMs, 0);
		if (!st || !st.stable) return { ok: false, events: [] };

		const shift = this.far ? distVV(st.mean, this.far) : 0;
		this.far = st.mean;
		this.anchor = [st.mean[0], st.mean[1], st.mean[2]];
		this.candidate = null;
		this.pending.push({ type: 'far_learned', t: this.lastT, shift, source: 'relearn' });
		this.enterFar(this.lastT);
		return { ok: true, events: this.drain() };
	}

	snapshot(): DetectorSnapshot {
		return {
			phase: this.phase,
			hint: this.hint,
			far: this.getFar(),
			delta: this.lastSample && this.far ? distSV(this.lastSample, this.far) : null,
			nearDelta: this.nearDelta,
			nearSince: this.nearSince,
			farSince: this.farSince,
			sigma: this.lastSigma,
			lastT: this.lastT,
			rateHz: this.rateHz,
		};
	}

	push(samples: MagnetSample[]): DetectorEvent[] {
		for (const s of samples) this.step(s);
		return this.drain();
	}

	private drain(): DetectorEvent[] {
		const out = this.pending;
		this.pending = [];
		return out;
	}

	private step(s: MagnetSample): void {
		if (this.phase === 'unsupported') return;

		if (this.lastT !== null) {
			// Out-of-order or duplicate samples carry no new information and would break
			// every time window below.
			if (!(s.t > this.lastT)) return;
			const dt = s.t - this.lastT;
			if (dt > this.cfg.gapUnknownMs) {
				this.pending.push({ type: 'gap', t: s.t, ms: dt });
				this.clearBuffer();
				this.toUnknown(s.t, true);
			} else if (dt > this.cfg.gapResetMs) {
				this.pending.push({ type: 'gap', t: s.t, ms: dt });
				this.clearBuffer();
			}
		}

		this.lastT = s.t;
		this.lastSample = s;
		this.buf.push(s);
		this.trimHistory(s.t);

		if (!this.probeRate(s)) return;

		const idx = this.buf.length - 1;
		switch (this.phase) {
			case 'unknown':
				this.onUnknown(idx, s);
				break;
			case 'far':
				this.onFar(idx, s);
				break;
			case 'near':
				this.onNear(idx, s);
				break;
			case 'lifting':
				this.onLifting(idx, s);
				break;
		}
	}

	/** Returns false once the device has been found too slow to use. */
	private probeRate(s: MagnetSample): boolean {
		if (this.rateHz !== null) return true;
		if (this.rateFirstT === null) this.rateFirstT = s.t;
		this.rateCount++;
		if (this.rateCount < this.cfg.rateProbeSamples) return true;

		const span = s.t - this.rateFirstT;
		this.rateHz = span > 0 ? ((this.rateCount - 1) * 1000) / span : 0;
		if (this.rateHz < this.cfg.minRateHz) {
			this.pending.push({ type: 'unsupported', t: s.t, rateHz: this.rateHz });
			this.setPhase('unsupported', s.t);
			this.dropNearState();
			return false;
		}
		return true;
	}

	private onUnknown(idx: number, s: MagnetSample): void {
		const st = this.stats(idx, this.cfg.plateauMs, 0);
		if (!st || !st.stable) return;
		this.lastSigma = st.rms;

		if (this.far && distVV(st.mean, this.far) < this.cfg.farMax) {
			this.enterFar(s.t);
			this.trackFar(st, s.t);
			return;
		}
		this.setHint('unknown', s.t, this.far ? distVV(st.mean, this.far) : null);
	}

	private onFar(idx: number, s: MagnetSample): void {
		const far = this.far as Vec3;
		const st = this.stats(idx, this.cfg.plateauMs, 0);
		if (!st || !st.stable) {
			// A shift is only adopted if it persists without interruption.
			if (this.candidate && s.t - this.candidate.lastSeen > this.cfg.plateauMs) this.candidate = null;
			return;
		}
		this.lastSigma = st.rms;

		const d = distVV(st.mean, far);
		if (d >= this.cfg.nearMin) {
			this.enterNear(st, d, s.t, false);
			return;
		}
		if (d < this.cfg.farMax) {
			this.setHint('none', s.t, d);
			this.trackFar(st, s.t);
			return;
		}
		this.candidate = null;
		this.setHint('closer', s.t, d);
	}

	private onNear(idx: number, s: MagnetSample): void {
		const ref = this.ref as Vec3;
		// Our own READY vibration moves the field for a few samples. Skipping the check
		// (and the reference refresh) delays a real lift a little but cannot lose it: the
		// onset is backtracked from the buffer once the mute ends.
		if (s.t < this.muteUntil) return;

		const trigger = Math.max(this.cfg.platformMin, this.cfg.triggerSigma * this.refSigma);
		const dev = distSV(s, ref);
		if (dev > trigger) {
			this.startLift(idx, s, ref, trigger, dev);
			return;
		}

		// Let R follow slow drift, but never from the newest samples: a lift that is just
		// starting must not drag its own reference along.
		const st = this.stats(idx, this.cfg.plateauMs, this.cfg.excludeRecentMs);
		if (st && st.stable && distVV(st.mean, ref) <= trigger) {
			this.ref = st.mean;
			this.refSigma = st.rms;
			this.lastSigma = st.rms;
			this.nearDelta = distVV(st.mean, this.far as Vec3);
		}
	}

	private startLift(idx: number, s: MagnetSample, ref: Vec3, trigger: number, dev: number): void {
		const band = Math.max(this.cfg.bandFloor, this.cfg.bandSigma * this.refSigma);
		const minT = s.t - this.cfg.maxOnsetLookbackMs;

		// Onset = the last sample still on the plateau. If the whole lookback is already
		// off it (a slow start), the earliest sample in the lookback is the best bound.
		let onset = s.t;
		for (let i = idx - 1; i >= this.head && this.buf[i].t >= minT; i--) {
			onset = this.buf[i].t;
			if (distSV(this.buf[i], ref) <= band) break;
		}

		this.lift = {
			onset,
			triggerT: s.t,
			nearSince: this.nearSince as number,
			ref: [ref[0], ref[1], ref[2]],
			sigma: this.refSigma,
			nearDelta: distVV(ref, this.far as Vec3),
			trigger,
			band,
			peak: dev,
			hold: 0,
			returnSince: null,
		};
		this.setPhase('lifting', s.t);
		this.onLifting(idx, s);
	}

	private onLifting(idx: number, s: MagnetSample): void {
		const L = this.lift as LiftInProgress;
		const far = this.far as Vec3;
		const devR = distSV(s, L.ref);
		const dF = distSV(s, far);
		if (devR > L.peak) L.peak = devR;

		// A real lift carries the field most of the way back to the far baseline and
		// out of the near zone. Tipping or sliding the cube along the edge does not.
		const progress = L.nearDelta > 0 ? 1 - dF / L.nearDelta : 0;
		if (progress >= this.cfg.confirmProgress && dF < this.cfg.nearMin) {
			L.hold++;
			if (L.hold >= this.cfg.confirmHoldSamples) {
				this.confirmLift(s.t);
				return;
			}
		} else {
			L.hold = 0;
		}

		if (devR <= L.band) {
			if (L.returnSince === null) L.returnSince = s.t;
			if (s.t - L.returnSince >= this.cfg.spikeReturnMs) {
				this.pending.push({ type: 'reject', t: s.t, reason: 'spike', peak: L.peak });
				this.lift = null;
				this.setPhase('near', s.t);
				return;
			}
		} else {
			L.returnSince = null;
		}

		if (s.t - L.triggerT >= this.cfg.plateauMs) {
			const st = this.stats(idx, this.cfg.plateauMs, 0);
			if (st && st.stable) {
				const d = distVV(st.mean, far);
				if (d >= this.cfg.nearMin) {
					// Re-placed: the dwell starts over from the new plateau.
					this.lift = null;
					this.enterNear(st, d, s.t, true);
					return;
				}
				if (d >= this.cfg.farMax) {
					this.pending.push({ type: 'reject', t: s.t, reason: 'moved', peak: L.peak });
					this.lift = null;
					this.enterFar(s.t);
					this.setHint('closer', s.t, d);
					return;
				}
				// Settled in the far zone without meeting the progress rule: a lift off a
				// weak plateau. Late, but the backdated onset keeps the time right.
				this.confirmLift(s.t);
				return;
			}
		}

		if (s.t - L.onset > this.cfg.liftTimeoutMs) {
			this.pending.push({ type: 'reject', t: s.t, reason: 'timeout', peak: L.peak });
			this.lift = null;
			this.enterFar(s.t);
		}
	}

	private confirmLift(t: number): void {
		const L = this.lift as LiftInProgress;
		this.pending.push({
			type: 'lift',
			onset: L.onset,
			t,
			nearSince: L.nearSince,
			delta: L.nearDelta,
			sigma: L.sigma,
			trigger: L.trigger,
			latencyMs: t - L.onset,
		});
		this.lift = null;
		this.enterFar(t);
	}

	private trackFar(st: WindowStats, t: number): void {
		const far = this.far as Vec3;
		const shift = distVV(st.mean, far);
		const free = Math.max(this.cfg.freeTrackMin, this.cfg.freeTrackSigma * st.rms);

		if (shift <= free) {
			if (this.withinAnchor(st.mean)) this.far = st.mean;
			this.candidate = null;
			return;
		}

		if (!this.candidate || distVV(this.candidate.mean, st.mean) > free) {
			this.candidate = { mean: st.mean, since: t, lastSeen: t };
			return;
		}
		this.candidate.lastSeen = t;
		if (t - this.candidate.since >= this.cfg.adoptMs && this.withinAnchor(st.mean)) {
			this.far = st.mean;
			this.candidate = null;
			this.pending.push({ type: 'far_learned', t, shift, source: 'adopt' });
		}
	}

	private withinAnchor(v: Vec3): boolean {
		return !this.anchor || distVV(v, this.anchor) <= this.cfg.farMax;
	}

	private enterNear(st: WindowStats, d: number, t: number, replaced: boolean): void {
		const farSince = replaced ? null : this.farSince;
		this.ref = st.mean;
		this.refSigma = st.rms;
		this.lastSigma = st.rms;
		this.nearDelta = d;
		this.nearSince = t;
		this.candidate = null;
		this.setPhase('near', t);
		this.setHint('none', t, d);
		this.pending.push({ type: 'near', t, delta: d, replaced, farSince });
	}

	private enterFar(t: number): void {
		this.dropNearState();
		this.farSince = t;
		this.setPhase('far', t);
		this.setHint('none', t, null);
	}

	private toUnknown(t: number, emit: boolean): void {
		this.dropNearState();
		this.farSince = null;
		this.candidate = null;
		if (emit) {
			this.setPhase('unknown', t);
		} else {
			this.phase = this.phase === 'unsupported' ? 'unsupported' : 'unknown';
		}
		this.hint = 'none';
	}

	private dropNearState(): void {
		this.ref = null;
		this.refSigma = 0;
		this.nearDelta = null;
		this.nearSince = null;
		this.lift = null;
	}

	private setPhase(phase: DetectorPhase, t: number): void {
		if (this.phase === phase) return;
		this.phase = phase;
		this.pending.push({ type: 'phase', t, phase });
	}

	private setHint(hint: MagnetHint, t: number, delta: number | null): void {
		if (this.hint === hint) return;
		this.hint = hint;
		this.pending.push({ type: 'hint', t, hint, delta });
	}

	private clearBuffer(): void {
		this.buf = [];
		this.head = 0;
		if (this.rateHz === null) {
			// A gap inside the probe would read as a slow sensor.
			this.rateFirstT = null;
			this.rateCount = 0;
		}
	}

	private trimHistory(now: number): void {
		const cutoff = now - this.cfg.historyMs;
		while (this.head < this.buf.length && this.buf[this.head].t < cutoff) this.head++;
		if (this.head >= COMPACT_AFTER) {
			this.buf = this.buf.slice(this.head);
			this.head = 0;
		}
	}

	/**
	 * Statistics over the window (tEnd - spanMs, tEnd - excludeMs] where tEnd is the time
	 * of buf[endIdx]. Null when the window is not covered well enough to judge.
	 */
	private stats(endIdx: number, spanMs: number, excludeMs: number): WindowStats | null {
		const tEnd = this.buf[endIdx].t;
		const upper = tEnd - excludeMs;
		const lower = tEnd - spanMs;

		let hi = endIdx;
		while (hi >= this.head && this.buf[hi].t > upper) hi--;
		if (hi < this.head) return null;

		let lo = hi;
		while (lo - 1 >= this.head && this.buf[lo - 1].t > lower) lo--;

		const covered = this.buf[hi].t - this.buf[lo].t;
		const wanted = spanMs - excludeMs;
		const n = hi - lo + 1;
		const minN = Math.max(5, Math.floor((wanted * this.cfg.minRateHz) / 1000 * 0.8));
		if (n < minN || covered < wanted * 0.8) return null;

		let mx = 0;
		let my = 0;
		let mz = 0;
		for (let i = lo; i <= hi; i++) {
			mx += this.buf[i].x;
			my += this.buf[i].y;
			mz += this.buf[i].z;
		}
		const mean: Vec3 = [mx / n, my / n, mz / n];

		let maxDev = 0;
		let sq = 0;
		for (let i = lo; i <= hi; i++) {
			const d = distSV(this.buf[i], mean);
			if (d > maxDev) maxDev = d;
			sq += d * d;
		}
		return {
			mean,
			maxDev,
			rms: Math.sqrt(sq / n),
			stable: maxDev <= this.cfg.platformMin,
		};
	}
}
