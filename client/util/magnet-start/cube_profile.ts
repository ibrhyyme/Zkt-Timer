// Which cube the Magnet Timer runs with, and with which thresholds (design
// .feedback/designs/magnet-cubes.md 4.7, 5.6, 6.3). Pure: useMagnetStart feeds it the cube
// store, the timer bucket and this phone's model key, and hands the result to the service
// (setCubeProfile) and to the status store (the guide under the digits reads it).
//
// Calibration is mandatory for every cube, 3x3 included (owner decision 2026-10-05): a main
// cube without a calibration on this phone model never gets thresholds, so the timer cannot
// start and the guide shows the calibration card instead.
import { puzzleOfBucket } from '../../../shared/cube_puzzle';
import { deriveThresholdsFromRow } from '../../../shared/magnet_calibration';
import {
	calibrationFor,
	cubesForPuzzle,
	mainCubeFor,
	CubeState,
	SolveBucket,
} from '../../lib/cubes/active_cube';
import type { MagnetPlatform } from './types';

/**
 * loading:        the cube list or this phone's model key is not known yet
 * no_puzzle:      the timer bucket has no physical puzzle ('other')
 * no_cubes:       the account has no cube at all (guide #2)
 * no_puzzle_cube: no cube of this puzzle (guide #3)
 * no_main:        cubes of this puzzle, none chosen (guide #4)
 * no_calibration: the main cube was never calibrated on this phone model, or the current
 *                 formula rejects its stored measurement (guide #5)
 * ready:          thresholds known, the detector may run
 */
export type MagnetProfileStatus =
	| 'loading'
	| 'no_puzzle'
	| 'no_cubes'
	| 'no_puzzle_cube'
	| 'no_main'
	| 'no_calibration'
	| 'ready';

export interface MagnetCubeProfile {
	status: MagnetProfileStatus;
	/** Puzzle key of the timer bucket (shared/cube_puzzle.ts). */
	puzzle: string | null;
	/** The main cube of that puzzle, when there is one. */
	cubeId: string | null;
	cubeName: string | null;
	/** Phone model key the calibration is looked up under (device_model.ts). */
	deviceModel: string | null;
	/** Detector thresholds derived from the raw calibration with the current formula. */
	nearMin: number | null;
	farMax: number | null;
	quality: 'ok' | 'weak' | null;
	/** Raw calibration values, for the live bar scale. */
	restUt: number | null;
	peakUt: number | null;
	/** A stored calibration exists but the current formula finds it too weak: measure again. */
	recalibrate: boolean;
	/** The calibration in use was measured on this device and is not uploaded yet. */
	pending: boolean;
}

export interface ResolveProfileInput {
	/** Cube store state; `userId` null means not loaded (or nobody signed in). */
	state: CubeState & { userId?: string | null; fetchedAt?: number | null };
	bucket: SolveBucket;
	platform: MagnetPlatform | null;
	/** undefined while the model key is being read. */
	deviceModel: string | null | undefined;
}

function profile(status: MagnetProfileStatus, extra: Partial<MagnetCubeProfile> = {}): MagnetCubeProfile {
	return {
		status,
		puzzle: null,
		cubeId: null,
		cubeName: null,
		deviceModel: null,
		nearMin: null,
		farMax: null,
		quality: null,
		restUt: null,
		peakUt: null,
		recalibrate: false,
		pending: false,
		...extra,
	};
}

export function resolveMagnetProfile(input: ResolveProfileInput): MagnetCubeProfile {
	const { state, bucket, platform, deviceModel } = input;
	const puzzle = puzzleOfBucket(bucket.cube_type, bucket.scramble_subset);
	if (!puzzle) return profile('no_puzzle');

	// The store is empty until the account's local copy is read (first client render) and,
	// on a fresh device, until the first server read. "No cubes" then would be a false card.
	const anyCube = state.cubes.some((cube) => !cube.archived_at);
	if (state.userId === null || (!anyCube && !state.fetchedAt)) return profile('loading', { puzzle });
	if (!anyCube) return profile('no_cubes', { puzzle });
	if (!cubesForPuzzle(puzzle, state).length) return profile('no_puzzle_cube', { puzzle });

	const main = mainCubeFor(puzzle, state);
	if (!main) return profile('no_main', { puzzle });

	const base = { puzzle, cubeId: main.id, cubeName: main.name };
	if (!platform || deviceModel === undefined) return profile('loading', base);
	if (!deviceModel) return profile('no_calibration', base);

	const withModel = { ...base, deviceModel };
	const calibration = calibrationFor(state, main.id, platform, deviceModel);
	if (!calibration) return profile('no_calibration', withModel);

	const thresholds = deriveThresholdsFromRow(calibration);
	if (!thresholds || thresholds.quality === 'fail') {
		return profile('no_calibration', { ...withModel, recalibrate: true });
	}
	return profile('ready', {
		...withModel,
		nearMin: thresholds.nearMin,
		farMax: thresholds.farMax,
		quality: thresholds.quality,
		restUt: calibration.rest_ut,
		peakUt: calibration.peak_ut,
		pending: !!calibration.pending,
	});
}

export function sameMagnetProfile(a: MagnetCubeProfile | null, b: MagnetCubeProfile | null): boolean {
	if (a === b) return true;
	if (!a || !b) return false;
	return (Object.keys(a) as (keyof MagnetCubeProfile)[]).every((key) => a[key] === b[key]);
}

/**
 * Full scale of the live bar, uT (design 5.8): the cube's own rest value fills about 80 %.
 * Scaling to the peak would leave a cube resting where it belongs at a sliver of the bar (the
 * peak at the camera bump reaches six times the rest value).
 */
export function liveBarScaleUt(p: Pick<MagnetCubeProfile, 'nearMin' | 'restUt' | 'peakUt'>): number | null {
	if (!p.nearMin) return null;
	if (p.restUt && p.restUt > 0) return Math.max(1.25 * p.restUt, 2 * p.nearMin);
	if (p.peakUt && p.peakUt > 0) return Math.max(Math.min(1.25 * p.peakUt, 4 * p.nearMin), 2 * p.nearMin);
	return 2 * p.nearMin;
}
