/**
 * useTrainerUrlSync: two-way sync between TrainerContext and the URL for the Algorithm Trainer
 * (trainer-sets 2.5, 6.1).
 *
 * URL scope:
 *   /trainer                       hub (two cards)
 *   /trainer/modes                 the Trainers page
 *   /trainer/algorithms            selection, `?cat=<slug>`, `&mode=smart`
 *   /trainer/algorithms/train      training, `?cat=<slug>` or `?set=<code>`, `&mode=smart`
 *   /trainer/sets                  My Sets
 *   /trainer/community             Community Sets (its own query belongs to that page)
 *   /trainer/sets/:code[/add]      set page / its picker (the URL owns these, state follows)
 *   legacy /trainer/standard*, /trainer/smart*, /trainer/algorithms/{sets,community}: rewritten
 *   to the new address, query kept.
 * Subset and algorithm checks stay out of the URL (a ZBLL selection would make it huge); a set
 * study is fully described by `?set=`.
 *
 * Study mode: `?mode=` asks for one, else the current mode, else the remembered `lastMode`.
 * Smart falls back to Standard quietly for a Basic user (a shared link never opens the Pro
 * screen); the cube tracking lock itself stays in TrainingArea.
 *
 * Cold `?set=` open: the set is loaded (device cache first, then network, see
 * lib/alg_sets/types.ts loadSetForStudy) and START_SET_STUDY starts the session. A set that cannot
 * be opened sends the user to its page, which says why.
 *
 * OWNERSHIP: while the mode is recognition / efficiency / ollcp this hook writes no URL (their
 * own hooks do); it still reads the entry segment. Anti-echo: idempotent diffs.
 */
import {useEffect, useRef} from 'react';
import {useHistory, useLocation} from 'react-router-dom';
import {useTrainerContext} from '../TrainerContext';
import {useAlgorithmData, getBestTime} from './useAlgorithmData';
import {
	ALGORITHMS_BASE,
	COMMUNITY_PATH,
	HUB_PATH,
	MODES_PATH,
	MY_SETS_PATH,
	buildAlgorithmsPath,
	buildSetPath,
	legacyAlgorithmsTarget,
	parseTrainerPath,
	parseTrainerSearch,
	trainerViewForPath,
} from '../../../util/trainer/url/trainer_url';
import {categoryToSlug, slugToCategory} from '../../../util/trainer/url/category_slug';
import {resolveStudyMode, smartModeAllowed} from '../../../util/trainer/study_mode';
import {startSetStudyPayload} from '../../../util/trainer/set_queue';
import {loadSetForStudy} from '../../../lib/alg_sets/types';
import {useMe} from '../../../util/hooks/useMe';
import {isPro, isProEnabled} from '../../../lib/pro';
import type {StudyMode, TrainerSessionState} from '../types';

function isStudyModeState(mode: TrainerSessionState['mode']): mode is StudyMode {
	return mode === 'standard' || mode === 'smart';
}

export function useTrainerUrlSync() {
	const {state, dispatch} = useTrainerContext();
	const {categories} = useAlgorithmData();
	const history = useHistory();
	const location = useLocation();
	const me = useMe();
	const smartAllowed = smartModeAllowed(isProEnabled(), isPro(me || undefined));

	const stateRef = useRef(state);
	stateRef.current = state;
	const locRef = useRef(location);
	locRef.current = location;
	const catsRef = useRef(categories);
	catsRef.current = categories;
	const reducerMountRef = useRef(false);
	/** Code of the set whose load is in flight (one at a time; a newer one supersedes it). */
	const loadingSetRef = useRef<string | null>(null);
	const unmountedRef = useRef(false);

	useEffect(() => {
		unmountedRef.current = false;
		return () => {
			unmountedRef.current = true;
		};
	}, []);

	// ── URL → reducer ────────────────────────────────────────────────
	useEffect(() => {
		const s = stateRef.current;
		const parsed = parseTrainerPath(location.pathname);

		if (parsed.unknownMode) {
			history.replace('/trainer'); // unknown entry → landing
			return;
		}

		if (!parsed.entry) {
			if (s.view !== 'landing') dispatch({type: 'SET_VIEW', payload: 'landing'});
			return;
		}

		if (parsed.entry === 'modes') {
			if (s.view !== 'modes') dispatch({type: 'SET_VIEW', payload: 'modes'});
			return;
		}

		// recognition / efficiency / ollcp: their sub-views belong to their own hooks
		if (parsed.mode) {
			if (s.mode !== parsed.mode) dispatch({type: 'SET_MODE', payload: parsed.mode});
			return;
		}

		// ── Algorithm Trainer ──
		const legacy = legacyAlgorithmsTarget(parsed, location.search);
		if (legacy) {
			history.replace(legacy);
			return;
		}

		const view = trainerViewForPath(parsed);
		if (!view) {
			history.replace(parsed.entry === 'sets' ? MY_SETS_PATH : ALGORITHMS_BASE);
			return;
		}

		const query = parseTrainerSearch(location.search);

		// ── Study mode ──
		const inAlgorithms = isStudyModeState(s.mode);
		const mode = resolveStudyMode(query.mode, inAlgorithms ? (s.mode as StudyMode) : s.options.lastMode, smartAllowed);
		if (!inAlgorithms) {
			// Entering from the hub or another trainer.
			dispatch({type: 'SET_MODE', payload: mode});
		} else if (s.mode !== mode) {
			// A link or history entry asked for the other mode: follow it, without changing lastMode.
			dispatch({type: 'SET_STUDY_MODE', payload: mode, remember: false});
		}

		// ── Category (?cat=), selection and category training only ──
		let category: string | null = null;
		const needsCategory = view === 'selection' || (view === 'training' && !query.set);
		if (needsCategory && query.cat) {
			const cats = catsRef.current;
			if (cats.length === 0) return; // categories not loaded yet; the categories.length dep re-runs this
			category = slugToCategory(query.cat, cats);
			if (!category) {
				history.replace(buildAlgorithmsPath(null, {mode})); // unresolvable slug → selection
				return;
			}
			// ONLY when it really differs (SET_CATEGORY resets subsets and checks)
			if (s.selectedCategory !== category) dispatch({type: 'SET_CATEGORY', payload: category});
		}

		// ── View ──
		if (view === 'training') {
			if (query.set) {
				const code = query.set;
				if (s.activeSet && s.activeSet.code === code) {
					if (s.view !== 'training') dispatch({type: 'SET_VIEW', payload: 'training'});
				} else if (loadingSetRef.current !== code) {
					startSetLoad(code);
				}
				return;
			}
			if (s.checkedAlgorithms.length === 0 || s.activeSet) {
				// Cold /train with no selection (checks are not in the URL) → selection, keep the category
				const cat = category || s.selectedCategory;
				history.replace(buildAlgorithmsPath(null, {cat: cat ? categoryToSlug(cat) : null, mode}));
			} else if (s.view !== 'training') {
				dispatch({type: 'SET_VIEW', payload: 'training'});
			}
			return;
		}

		if (s.view !== view) dispatch({type: 'SET_VIEW', payload: view});

		function startSetLoad(code: string) {
			loadingSetRef.current = code;
			if (stateRef.current.pendingSetCode !== code) dispatch({type: 'SET_PENDING_SET', payload: code});

			const finish = (set: Awaited<ReturnType<typeof loadSetForStudy>>) => {
				if (loadingSetRef.current !== code) return; // superseded by another set
				loadingSetRef.current = null;
				if (unmountedRef.current) return;
				// Still wanted? The user may have left the loading screen.
				const loc = locRef.current;
				const stillHere =
					trainerViewForPath(parseTrainerPath(loc.pathname)) === 'training' &&
					parseTrainerSearch(loc.search).set === code;
				if (!stillHere) return;
				if (!set) {
					dispatch({type: 'SET_PENDING_SET', payload: null});
					history.replace(buildSetPath(code));
					return;
				}
				dispatch({type: 'START_SET_STUDY', payload: startSetStudyPayload(set, getBestTime)});
			};

			loadSetForStudy(code).then(finish, () => finish(null));
		}
		// smartAllowed: a login or a Pro purchase while on the page re-evaluates the mode.
	}, [location.pathname, location.search, categories.length, smartAllowed, dispatch, history]);

	// ── reducer → URL ────────────────────────────────────────────────
	useEffect(() => {
		if (!reducerMountRef.current) {
			reducerMountRef.current = true;
			return;
		}
		const s = state;
		if (s.mode === 'recognition' || s.mode === 'efficiency' || s.mode === 'ollcp') return;

		const loc = locRef.current;
		const mode: StudyMode | null = isStudyModeState(s.mode) ? s.mode : null;
		const cat = s.selectedCategory ? categoryToSlug(s.selectedCategory) : null;
		let target: string;
		if (s.view === 'modes') {
			target = MODES_PATH;
		} else if (!s.mode || s.view === 'landing') {
			target = HUB_PATH;
		} else {
			switch (s.view) {
				case 'selection':
					target = buildAlgorithmsPath(null, {cat, mode});
					break;
				case 'training': {
					const setCode = s.activeSet?.code || s.pendingSetCode;
					target = setCode
						? buildAlgorithmsPath('train', {set: setCode, mode})
						: buildAlgorithmsPath('train', {cat, mode});
					break;
				}
				case 'sets':
					target = MY_SETS_PATH;
					break;
				case 'community':
					// The community page owns its query (?q, ?sort, ?puzzle).
					target = loc.pathname === COMMUNITY_PATH ? COMMUNITY_PATH + loc.search : COMMUNITY_PATH;
					break;
				default:
					// set / set-add: the URL is the source (the code lives only there).
					return;
			}
		}

		const [targetPath] = target.split('?');
		const current = loc.pathname + loc.search;
		if (target !== current) {
			if (targetPath !== loc.pathname) history.push(target);
			else history.replace(target);
		}
	}, [state.mode, state.view, state.selectedCategory, state.activeSet?.code, state.pendingSetCode, history]);
}
