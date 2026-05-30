/**
 * Trainer URL vocabulary — saf (React'siz, test edilebilir) path parse/serialize.
 *
 * URL omurgasi: `/trainer/{mode}/{sub}`
 *   mode: standard | smart | recognition | efficiency  (yok = landing)
 *   sub : moda ozgu alt-view segmenti (train | setup | results | settings | glossary | history)
 *
 * Query param'lari (cat/subsets/algs, efficiency config) Faz 2+ — burada degil.
 */
import type {TrainerMode} from '../../../components/trainer/types';
import type {RecognitionView} from '../../../components/trainer/recognition/types';
import type {EfficiencyView} from '../../../components/trainer/efficiency/types';

const TRAINER_MODES: readonly TrainerMode[] = ['standard', 'smart', 'recognition', 'efficiency'];

export interface ParsedTrainerPath {
	/** pathname `/trainer` ile basliyor mu */
	isTrainer: boolean;
	/** bilinen mod, yoksa null (landing veya non-trainer) */
	mode: TrainerMode | null;
	/** mod'dan sonraki segment (alt-view), yoksa null */
	sub: string | null;
	/** `/trainer/foo` gibi bilinmeyen mod segmenti → guard redirect icin */
	unknownMode: boolean;
}

/** pathname'i trainer omurgasina ayristirir. Query/hash yok sayilir. */
export function parseTrainerPath(pathname: string): ParsedTrainerPath {
	const parts = (pathname || '').split('/').filter(Boolean); // ['trainer','standard','train']
	if (parts[0] !== 'trainer') {
		return {isTrainer: false, mode: null, sub: null, unknownMode: false};
	}
	const modeSeg = parts[1];
	if (!modeSeg) {
		return {isTrainer: true, mode: null, sub: null, unknownMode: false}; // bare /trainer = landing
	}
	if (!TRAINER_MODES.includes(modeSeg as TrainerMode)) {
		return {isTrainer: true, mode: null, sub: null, unknownMode: true}; // /trainer/foo
	}
	return {isTrainer: true, mode: modeSeg as TrainerMode, sub: parts[2] ?? null, unknownMode: false};
}

/** mode + sub → canonical pathname */
export function buildTrainerPath(mode: TrainerMode | null, sub?: string | null): string {
	if (!mode) return '/trainer';
	return sub ? `/trainer/${mode}/${sub}` : `/trainer/${mode}`;
}

// ──────────────────── Recognition sub ↔ view ────────────────────
// URL segment 'train' ↔ recognition view 'trainer' (isim farki); null ↔ 'home'.

const RECOGNITION_SUB_TO_VIEW: Record<string, RecognitionView> = {
	setup: 'setup',
	train: 'trainer',
	results: 'results',
	settings: 'settings',
	history: 'history',
	glossary: 'glossary',
};

const RECOGNITION_VIEW_TO_SUB: Record<RecognitionView, string | null> = {
	home: null,
	setup: 'setup',
	trainer: 'train',
	results: 'results',
	settings: 'settings',
	history: 'history',
	glossary: 'glossary',
};

/** URL sub segmenti → recognition view. Bilinmeyen sub null doner (guard redirect). */
export function recognitionSubToView(sub: string | null): RecognitionView | null {
	if (sub === null) return 'home';
	return RECOGNITION_SUB_TO_VIEW[sub] ?? null;
}

export function recognitionViewToSub(view: RecognitionView): string | null {
	return RECOGNITION_VIEW_TO_SUB[view] ?? null;
}

// ──────────────────── Efficiency sub ↔ view ────────────────────
// null ↔ 'trainer'; 'settings' ↔ 'settings'.

/** URL sub segmenti → efficiency view. Bilinmeyen sub null doner (guard redirect). */
export function efficiencySubToView(sub: string | null): EfficiencyView | null {
	if (sub === null) return 'trainer';
	if (sub === 'settings') return 'settings';
	return null;
}

export function efficiencyViewToSub(view: EfficiencyView): string | null {
	return view === 'settings' ? 'settings' : null;
}

// ──────────────────── Efficiency config query (Faz 4) ────────────────────
// `?type=cross|xcross|eocross&rot=<orientation>&axis=LR|FB&len=<n>&slot=<0-3>`
// axis sadece eocross'ta, slot sadece xcross'ta anlamli. Reducer normalize eder.

export interface EfficiencyConfigQuery {
	type: string | null;
	rot: string | null;
	axis: string | null;
	len: number | null;
	slot: number | null;
}

export function parseEfficiencyQuery(search: string): EfficiencyConfigQuery {
	const p = new URLSearchParams(search);
	const lenRaw = p.get('len');
	const slotRaw = p.get('slot');
	const num = (v: string | null): number | null =>
		v !== null && v !== '' && Number.isFinite(Number(v)) ? Number(v) : null;
	return {type: p.get('type'), rot: p.get('rot'), axis: p.get('axis'), len: num(lenRaw), slot: num(slotRaw)};
}

export function buildEfficiencySearch(
	type: string,
	rotation: string,
	eoAxis: string,
	targetLength?: number,
	xcrossSlot?: number,
): string {
	const parts: string[] = ['type=' + type];
	if (rotation) parts.push('rot=' + encodeURIComponent(rotation));
	if (type === 'eocross') parts.push('axis=' + eoAxis);
	if (targetLength !== undefined) parts.push('len=' + targetLength);
	if (type === 'xcross' && xcrossSlot !== undefined) parts.push('slot=' + xcrossSlot);
	return '?' + parts.join('&');
}
