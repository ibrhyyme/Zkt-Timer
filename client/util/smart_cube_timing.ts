/**
 * Smart cube timing correction.
 *
 * The implementation moved to shared/util/solve/cube_timing.ts so the server runs the
 * same fit when it verifies an Online Battle solve. This file only re-exports it, so the
 * existing callers (solve engine, timer page, trainer) did not change.
 */

export {
	cubeTimestampLinearFit,
	fillMissingTimestamps,
	MISSING_TIMESTAMP_STEP_MS,
} from '../../shared/util/solve/cube_timing';
export type { TimestampedMove, CorrectedMove, LinearFitResult } from '../../shared/util/solve/cube_timing';
