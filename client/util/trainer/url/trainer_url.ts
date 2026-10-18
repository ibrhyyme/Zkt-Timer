/**
 * Trainer URL vocabulary: pure (React free, testable) path and query parse/serialize.
 *
 * URL backbone: `/trainer/{entry}/{sub}`
 *   entry: modes | algorithms | sets | community | recognition | efficiency | ollcp  (none = hub)
 *   Hub (two cards, Trainers and Algorithm Sets):
 *     /trainer                           hub
 *     /trainer/modes                     Trainers: Algorithm Trainer, PLL Recognition, Cross and XCross
 *   Algorithm Trainer (trainer-sets 2.5):
 *     /trainer/algorithms                selection                   ?cat=<slug>&mode=smart
 *     /trainer/algorithms/train          training                    ?cat=<slug> | ?set=<code>, &mode=smart
 *   Algorithm Sets (their own section, not a tab of the Algorithm Trainer):
 *     /trainer/sets                      My Sets
 *     /trainer/community                 Community Sets              (?q, ?sort, ?puzzle owned by that page)
 *     /trainer/sets/:code                one set's page
 *     /trainer/sets/:code/add            its algorithm picker
 *   Legacy `/trainer/standard[/train]`, `/trainer/smart[/train]`, `/trainer/algorithms/sets` and
 *   `/trainer/algorithms/community` still parse so an old address inside the app is rewritten
 *   instead of breaking (legacyAlgorithmsTarget); the server answers them with a 301.
 *   The study mode (Standard / Smart Cube) is NOT a path segment: `?mode=smart`, else the
 *   remembered `lastMode` (see util/trainer/study_mode.ts).
 *   recognition / efficiency / ollcp: `sub` is their own sub-view segment.
 */
import type {StudyMode, TrainerMode, TrainerView} from '../../../components/trainer/types';
import type {RecognitionView} from '../../../components/trainer/recognition/types';
import type {EfficiencyView} from '../../../components/trainer/efficiency/types';

export type TrainerEntry = 'modes' | 'algorithms' | 'sets' | 'community' | 'recognition' | 'efficiency' | 'ollcp';

/** Entries that are their own TrainerMode (each manages its sub-views). */
const MODE_ENTRIES: readonly TrainerMode[] = ['recognition', 'efficiency', 'ollcp'];
const LEGACY_STUDY_ENTRIES: readonly StudyMode[] = ['standard', 'smart'];

export const HUB_PATH = '/trainer';
export const MODES_PATH = '/trainer/modes';
export const ALGORITHMS_BASE = '/trainer/algorithms';
export const SETS_BASE = '/trainer/sets';
/** My Sets is the bare sets address. */
export const MY_SETS_PATH = SETS_BASE;
export const COMMUNITY_PATH = '/trainer/community';

export type AlgorithmsSub = 'train';
const ALGORITHMS_SUBS: readonly AlgorithmsSub[] = ['train'];
/** Old Algorithm Trainer tabs that became pages of their own. */
const LEGACY_ALGORITHMS_SUBS = new Map<string, string>([
	['sets', MY_SETS_PATH],
	['community', COMMUNITY_PATH],
]);

export interface ParsedTrainerPath {
	/** pathname starts with `/trainer` */
	isTrainer: boolean;
	/** known entry segment, null on landing or non-trainer paths */
	entry: TrainerEntry | null;
	/**
	 * The TrainerMode the path fixes: recognition, efficiency, ollcp. Null for the Algorithm
	 * Trainer, whose study mode comes from `?mode=` / lastMode, not from the path.
	 */
	mode: TrainerMode | null;
	/** segment after the entry (sub-view); for /trainer/sets/:code the segment after the code */
	sub: string | null;
	/** `/trainer/foo`: unknown entry, for a guard redirect */
	unknownMode: boolean;
	/** `/trainer/standard*` or `/trainer/smart*`: the mode the old address meant */
	legacyMode: StudyMode | null;
	/** `/trainer/sets/:code[/add]`: the share code */
	setCode: string | null;
}

const NOT_TRAINER: ParsedTrainerPath = {
	isTrainer: false,
	entry: null,
	mode: null,
	sub: null,
	unknownMode: false,
	legacyMode: null,
	setCode: null,
};

function safeDecode(segment: string): string | null {
	try {
		return decodeURIComponent(segment);
	} catch {
		return null;
	}
}

/**
 * `/trainer/sets/:code` and `/trainer/sets/:code/add`. Any non-empty code is returned: the set
 * page itself says "not found" for a wrong one, which is clearer than a silent redirect.
 */
export function parseSetPath(pathname: string): {code: string; add: boolean} | null {
	const parts = (pathname || '').split('/').filter(Boolean);
	if (parts[0] !== 'trainer' || parts[1] !== 'sets' || !parts[2]) return null;
	if (parts.length > 4 || (parts[3] !== undefined && parts[3] !== 'add')) return null;
	const code = safeDecode(parts[2]);
	if (!code || code.length > 64) return null;
	return {code, add: parts[3] === 'add'};
}

/** Splits a pathname into the trainer backbone. Query and hash are ignored. */
export function parseTrainerPath(pathname: string): ParsedTrainerPath {
	const parts = (pathname || '').split('/').filter(Boolean); // ['trainer','algorithms','train']
	if (parts[0] !== 'trainer') return NOT_TRAINER;
	const seg = parts[1];
	if (!seg) return {...NOT_TRAINER, isTrainer: true}; // bare /trainer = hub

	if (seg === 'modes' || seg === 'community') {
		if (parts.length > 2) return {...NOT_TRAINER, isTrainer: true, unknownMode: true};
		return {...NOT_TRAINER, isTrainer: true, entry: seg};
	}
	if (seg === 'algorithms') {
		return {...NOT_TRAINER, isTrainer: true, entry: 'algorithms', sub: parts[2] ?? null};
	}
	if (seg === 'sets') {
		const set = parseSetPath(pathname);
		if (set) {
			return {...NOT_TRAINER, isTrainer: true, entry: 'sets', setCode: set.code, sub: set.add ? 'add' : null};
		}
		// `/trainer/sets` alone is My Sets; a malformed tail has no view and the caller redirects.
		return {...NOT_TRAINER, isTrainer: true, entry: 'sets', sub: parts[3] ?? null};
	}
	if (LEGACY_STUDY_ENTRIES.includes(seg as StudyMode)) {
		return {...NOT_TRAINER, isTrainer: true, entry: 'algorithms', legacyMode: seg as StudyMode, sub: parts[2] ?? null};
	}
	if (MODE_ENTRIES.includes(seg as TrainerMode)) {
		return {...NOT_TRAINER, isTrainer: true, entry: seg as TrainerEntry, mode: seg as TrainerMode, sub: parts[2] ?? null};
	}
	return {...NOT_TRAINER, isTrainer: true, unknownMode: true}; // /trainer/foo
}

/**
 * The view a parsed path shows: the hub, the Trainers page, the Algorithm Trainer and the set
 * pages. Null when the path belongs to another trainer or its sub-view is unknown
 * (`/trainer/algorithms/foo`, `/trainer/sets/abc/edit`): the caller redirects. The old
 * `/trainer/algorithms/sets` and `/community` tabs are null too; legacyAlgorithmsTarget rewrites
 * them first.
 */
export function trainerViewForPath(parsed: ParsedTrainerPath): TrainerView | null {
	if (!parsed.isTrainer || parsed.unknownMode) return null;
	if (parsed.entry === null) return 'landing';
	if (parsed.entry === 'modes') return 'modes';
	if (parsed.entry === 'community') return 'community';
	if (parsed.entry === 'algorithms') {
		if (parsed.sub === null) return 'selection';
		if (parsed.sub === 'train') return 'training';
		return null;
	}
	if (parsed.entry === 'sets') {
		if (!parsed.setCode) return parsed.sub === null ? 'sets' : null;
		if (parsed.sub === null) return 'set';
		if (parsed.sub === 'add') return 'set-add';
	}
	return null;
}

export interface TrainerSearch {
	/** category slug (`?cat=`) */
	cat: string | null;
	/** set share code (`?set=`) */
	set: string | null;
	/** study mode (`?mode=`) */
	mode: StudyMode | null;
}

export function parseTrainerSearch(search: string | null | undefined): TrainerSearch {
	const p = new URLSearchParams(search || '');
	const mode = p.get('mode');
	return {
		cat: p.get('cat') || null,
		set: p.get('set') || null,
		mode: mode === 'smart' || mode === 'standard' ? mode : null,
	};
}

/**
 * Algorithm Trainer address. `set` wins over `cat` (a set study has no selector category).
 * Only Smart is written to the URL; Standard is the default and keeps links short.
 */
export function buildAlgorithmsPath(
	sub: AlgorithmsSub | null,
	query: {cat?: string | null; set?: string | null; mode?: StudyMode | null} = {}
): string {
	const path = sub && ALGORITHMS_SUBS.includes(sub) ? `${ALGORITHMS_BASE}/${sub}` : ALGORITHMS_BASE;
	const parts: string[] = [];
	if (query.set) parts.push('set=' + encodeURIComponent(query.set));
	else if (query.cat) parts.push('cat=' + encodeURIComponent(query.cat));
	if (query.mode === 'smart') parts.push('mode=smart');
	return parts.length ? `${path}?${parts.join('&')}` : path;
}

/** `/trainer/sets/<code>` or its picker `/trainer/sets/<code>/add`. */
export function buildSetPath(code: string, add = false): string {
	const base = `${SETS_BASE}/${encodeURIComponent(code)}`;
	return add ? `${base}/add` : base;
}

/**
 * New address for a legacy path, keeping its query: `/trainer/standard*` or `/trainer/smart*`
 * (`?cat` survives; a `mode` already in the query wins over the one the old path meant), and the
 * old `/trainer/algorithms/sets` and `/trainer/algorithms/community` tabs.
 */
export function legacyAlgorithmsTarget(parsed: ParsedTrainerPath, search: string): string | null {
	const movedTab = parsed.entry === 'algorithms' && !parsed.legacyMode && parsed.sub ? LEGACY_ALGORITHMS_SUBS.get(parsed.sub) : undefined;
	if (movedTab) {
		const qs = (search || '').replace(/^\?/, '');
		return qs ? `${movedTab}?${qs}` : movedTab;
	}
	if (!parsed.legacyMode) return null;
	const params = new URLSearchParams(search || '');
	if (!params.get('mode') && parsed.legacyMode === 'smart') params.set('mode', 'smart');
	const qs = params.toString();
	const path = parsed.sub === 'train' ? `${ALGORITHMS_BASE}/train` : ALGORITHMS_BASE;
	return qs ? `${path}?${qs}` : path;
}

/**
 * mode + sub to a pathname. For recognition, efficiency and ollcp the mode is the path segment;
 * standard and smart map to the Algorithm Trainer (the study mode is a query, see above).
 */
export function buildTrainerPath(mode: TrainerMode | null, sub?: string | null): string {
	if (!mode) return '/trainer';
	if (mode === 'standard' || mode === 'smart') {
		return sub === 'train' ? `${ALGORITHMS_BASE}/train` : ALGORITHMS_BASE;
	}
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
