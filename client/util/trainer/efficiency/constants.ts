/**
 * Efficiency Trainer constants.
 */
import type {EfficiencyType, EoAxis} from '../../../components/trainer/efficiency/types';
import {CUBE_ORIENTATIONS} from '../../cross-solver/types';

// localStorage keys
export const LS_SESSION = 'trainer_efficiency_session';
export const LS_SETTINGS = 'trainer_efficiency_settings';
export const LS_VIEW = 'trainer_efficiency_view';

export const EFFICIENCY_TYPES: EfficiencyType[] = ['cross', 'xcross', 'eocross'];
export const EO_AXES: EoAxis[] = ['LR', 'FB'];

// Phase 3 — target-length selector ranges (full range per type, 1 to max)
export const LENGTH_RANGES: Record<EfficiencyType, number[]> = {
	cross: [1, 2, 3, 4, 5, 6, 7, 8],
	xcross: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
	eocross: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
};

// Rare/slow length warning — ONLY combinations using generate-and-retry are slow.
// cross + xcross(1-9): with getEasyCross (full pruning) INSTANT → no warning.
// xcross 10 + all eocross: generate-and-retry → slow/timeout on rare lengths.
export const RARE_LENGTHS: Record<EfficiencyType, number[]> = {
	cross: [],
	xcross: [10],
	eocross: [1, 2, 3, 4, 5, 6, 10],
};

/**
 * XCross F2L slot options. UI visual order BL,BR,FR,FL (same as reference xcross_trainer).
 * idx = solveXCross slot index = cstimer corner numbering:
 * c1[idx] (cross-solver.ts) -> corner position idx+4 -> idx0=DFR(FR), idx1=DLF(FL),
 * idx2=DBL(BL), idx3=DRB(BR). Therefore name<->idx: BL=2, BR=3, FR=0, FL=1
 * (when user picks BL, actually solves BL pair).
 */
export const XCROSS_SLOTS: Array<{idx: number; name: string}> = [
	{idx: 2, name: 'BL'},
	{idx: 3, name: 'BR'},
	{idx: 0, name: 'FR'},
	{idx: 1, name: 'FL'},
];

// Rotation/orientation options — cube orientation angle. '' = None (default).
// cross-solver CUBE_ORIENTATIONS (24: '', z2, z, z', x, x', y combinations).
export const ROTATION_OPTIONS: string[] = CUBE_ORIENTATIONS;

// Max scramble history to keep for back navigation
export const HISTORY_CAP = 30;
