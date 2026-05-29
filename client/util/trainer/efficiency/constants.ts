/**
 * Efficiency Trainer sabitleri.
 */
import type {EfficiencyType, EoAxis} from '../../../components/trainer/efficiency/types';
import {CUBE_ORIENTATIONS} from '../../cross-solver/types';

// localStorage key'leri
export const LS_SESSION = 'trainer_efficiency_session';
export const LS_SETTINGS = 'trainer_efficiency_settings';
export const LS_VIEW = 'trainer_efficiency_view';

export const EFFICIENCY_TYPES: EfficiencyType[] = ['cross', 'xcross', 'eocross'];
export const EO_AXES: EoAxis[] = ['LR', 'FB'];

// Faz 3 — hedef-uzunluk secici aralilari (ture gore tam aralik, 1'den max'a)
export const LENGTH_RANGES: Record<EfficiencyType, number[]> = {
	cross: [1, 2, 3, 4, 5, 6, 7, 8],
	xcross: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
	eocross: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
};

// Nadir/yavas uzunluk uyarisi — SADECE uret-ve-ele kullanan kombinasyonlar yavas.
// cross + xcross(1-9): getEasyCross (full pruning) ile ANINDA → uyari yok.
// xcross 10 + tum eocross: uret-ve-ele → nadir uzunluklarda yavas/timeout.
export const RARE_LENGTHS: Record<EfficiencyType, number[]> = {
	cross: [],
	xcross: [10],
	eocross: [1, 2, 3, 4, 5, 6, 10],
};

/**
 * XCross F2L slot secenekleri. UI gorsel sirasi BL,BR,FR,FL (referans xcross_trainer
 * ile ayni). idx = solveXCross slot index = cstimer corner numaralandirmasi:
 * c1[idx] (cross-solver.ts) -> corner pozisyon idx+4 -> idx0=DFR(FR), idx1=DLF(FL),
 * idx2=DBL(BL), idx3=DRB(BR). Bu yuzden isim<->idx: BL=2, BR=3, FR=0, FL=1
 * (kullanici BL secince gercekten BL pair'i cozulur).
 */
export const XCROSS_SLOTS: Array<{idx: number; name: string}> = [
	{idx: 2, name: 'BL'},
	{idx: 3, name: 'BR'},
	{idx: 0, name: 'FR'},
	{idx: 1, name: 'FL'},
];

// Rotation/orientation secenekleri — kup tutus acisi. '' = None (varsayilan).
// cross-solver CUBE_ORIENTATIONS (24: '', z2, z, z', x, x', y kombinasyonlari).
export const ROTATION_OPTIONS: string[] = CUBE_ORIENTATIONS;

// Back navigasyonu icin tutulacak max scramble gecmisi
export const HISTORY_CAP = 30;
