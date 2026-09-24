// Shared types for magnet lift-to-start ("Kaldırınca Başlat").
//
// The native MagnetDetector plugin only streams raw magnetometer samples; every
// decision (plateaus, near/far, lift onset) is made in TypeScript so it can be
// tested against real recordings. See .claude/skills/magnet-start/SKILL.md.

export type Vec3 = [number, number, number];

export type MagnetPlatform = 'ios' | 'android';

/** One raw magnetometer reading. `t` is epoch milliseconds, fields are in microtesla. */
export interface MagnetSample {
	t: number;
	x: number;
	y: number;
	z: number;
}

/**
 * unknown:     no trusted far baseline for the current reading (session start, after a
 *              gap or resize, or the phone's surroundings changed). Never becomes near
 *              from a static reading.
 * far:         the cube is away from the magnetometer (anything beyond a few cm).
 * near:        the cube rests at the magnetometer hot spot (rear camera edge).
 * lifting:     the field left the near plateau; waiting to confirm a real lift.
 * unsupported: the sensor delivers too slowly for a trustworthy onset.
 */
export type DetectorPhase = 'unknown' | 'far' | 'near' | 'lifting' | 'unsupported';

/** unknown: move the cube away and re-learn the baseline. closer: the cube is near but not at the hot spot. */
export type MagnetHint = 'none' | 'unknown' | 'closer';

export type DetectorEvent =
	| { type: 'phase'; t: number; phase: DetectorPhase }
	| {
		type: 'near';
		t: number;
		delta: number;
		/** The cube moved along the edge and settled again; not a fresh placement. */
		replaced: boolean;
		/** Start of the far phase that preceded this placement (null for a re-placement). */
		farSince: number | null;
	}
	| {
		type: 'lift';
		/** Backdated start: the last sample still on the near plateau. */
		onset: number;
		/** Sample time at which the lift was confirmed. */
		t: number;
		/** When the plateau the cube left was confirmed (for the dwell check). */
		nearSince: number;
		/** |R - F| of the plateau the cube left. */
		delta: number;
		sigma: number;
		trigger: number;
		latencyMs: number;
	}
	| { type: 'reject'; t: number; reason: 'spike' | 'moved' | 'timeout'; peak: number }
	| { type: 'far_learned'; t: number; shift: number; source: 'adopt' | 'relearn' }
	| { type: 'hint'; t: number; hint: MagnetHint; delta: number | null }
	| { type: 'gap'; t: number; ms: number }
	| { type: 'unsupported'; t: number; rateHz: number };

export interface DetectorSnapshot {
	phase: DetectorPhase;
	hint: MagnetHint;
	far: Vec3 | null;
	/** |B - F| of the latest sample, null while no baseline is known. */
	delta: number | null;
	/** |R - F| of the current near plateau. */
	nearDelta: number | null;
	/** Sample time the current near plateau was confirmed. */
	nearSince: number | null;
	/** Sample time the current far phase began. */
	farSince: number | null;
	sigma: number | null;
	lastT: number | null;
	rateHz: number | null;
}

/** Wire format of one native `samples` event: flat [t, x, y, z, t, x, y, z, ...]. */
export interface MagnetSamplesPayload {
	v: number;
	/** Which clock the native side used to turn sensor timestamps into epoch ms. */
	clk: 'boot' | 'uptime' | 'arrival';
	d: number[];
}

export interface MagnetCapabilities {
	version: number;
	available: boolean;
	uncalibrated: boolean;
	minDelayUs?: number;
	maxRange?: number;
	resolution?: number;
	name?: string;
	vendor?: string;
}

/** Decodes the flat wire array. Malformed tails are dropped, never guessed. */
export function decodeSamples(d: number[] | undefined | null): MagnetSample[] {
	if (!Array.isArray(d)) return [];
	const out: MagnetSample[] = [];
	for (let i = 0; i + 3 < d.length; i += 4) {
		const t = d[i];
		const x = d[i + 1];
		const y = d[i + 2];
		const z = d[i + 3];
		if (!Number.isFinite(t) || !Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) continue;
		out.push({ t, x, y, z });
	}
	return out;
}
