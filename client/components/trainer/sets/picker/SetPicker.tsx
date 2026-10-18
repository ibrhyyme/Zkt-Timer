/**
 * SetPicker: "Add algorithms" for a set, /trainer/sets/:code/add (trainer-sets 5).
 *
 * Three steps, as the owner described it: groups (categories under their puzzle) → subsets →
 * cases. The selection survives the steps, so cases from OLL, PLL and 2x2 CLL go in with one
 * "Add". On a phone each step is its own history entry (`?group=&sub=`), so the back gesture
 * goes one step up before it leaves the picker; on a desktop (from $bp-lg) the categories stay
 * in a list on the left and the subsets are chips above the cases.
 *
 * Each case carries a variant (5.4): by default the algorithm the user already runs for it on
 * this device, else the library one; long press or the "Algorithm" chip picks another one from
 * the library and the shared pool (VariantSheet, the set page's sheet). The server only accepts
 * library and pool texts: a refused default variant falls back to the library algorithm once
 * (5.5) instead of losing the selection.
 *
 * Owner only: anybody else is sent to the set page. The shell (Trainer.tsx) draws the header and
 * gives this screen a non scrolling column; the picker scrolls its own body so the bar stays put.
 */
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useDispatch} from 'react-redux';
import {Prompt, useHistory, useLocation} from 'react-router-dom';
import {useTranslation} from 'react-i18next';
import {ArrowLeft, CircleNotch, MagnifyingGlass, WifiSlash, X} from 'phosphor-react';
import block from '../../../../styles/bem';
import Button from '../../../common/button/Button';
import {openModal} from '../../../../actions/general';
import {fetchDefaultAlgs, readSavedAlgorithmTexts} from '../../hooks/useAlgorithmData';
import {useMe} from '../../../../util/hooks/useMe';
import {useOnlineStatus} from '../../../../util/hooks/useOnlineStatus';
import {useKeyboardInset} from '../../../../util/hooks/useKeyboardInset';
import {useTrainerDb} from '../../../../util/hooks/useTrainerDb';
import {useLLPatternsReady} from '../../../../util/trainer/ll_patterns';
import {usePuzzlePatternsReady} from '../../../../util/trainer/puzzle_patterns';
import {useIsometricPatternsReady} from '../../../../util/trainer/isometric_patterns';
import {hapticImpact} from '../../../../util/native-plugins';
import {toastError, toastInfo, toastSuccess} from '../../../../util/toast';
import {getGqlErrorMessage} from '../../../../util/gql-error';
import {buildSetPath, MY_SETS_PATH, parseSetPath} from '../../../../util/trainer/url/trainer_url';
import {buildCaseIndex, CASE_SEARCH_LIMIT, searchCases} from '../../../../util/trainer/case_search';
import {isHiddenSubset, subsetLabel} from '../../../../util/trainer/subset_label';
import {algSetCaseKey} from '../../../../../shared/trainer/alg_sets';
import {addItemsWithFallback} from '../add_items';
import {loadAlgSet, peekCachedAlgSet, rememberAlgSet} from '../../../../lib/alg_sets/loader';
import {upsertOwnSet} from '../../../../lib/alg_sets/store';
import VariantSheet from '../VariantSheet';
import {CaseCard, CategoryNavItem, CategoryTile, SubsetTile, usePatternFaces} from './PickerCards';
import {SelectionBar, SelectionPanel} from './SelectionBar';
import {
	addedItemIds,
	ALL_SUBSETS,
	buildPickerSearch,
	buildPickerTree,
	countByCategory,
	defaultVariant,
	groupSelectState,
	parentPickerStep,
	parsePickerStep,
	pickableCases,
	remainingSlots,
	resolvePickerStep,
	type AddItemInput,
	type PickerCase,
	type PickerCategory,
	type PickerSelectionItem,
	type PickerStep,
} from './picker_model';
import type {AlgorithmSubset} from '../../types';
import type {AlgSetData} from '../../../../lib/alg_sets/types';
import './SetPicker.scss';

const b = block('set-picker');

/** Cards drawn per slice in long lists (ZBLL 472, SQ1 OBL 185); more come at the scroll end (5.6). */
const WINDOW = 60;
const F2L_SLOTS = ['Front Right', 'Front Left', 'Back Right', 'Back Left'];
const WIDE_QUERY = '(min-width: 1024px)'; // $bp-lg: desktop layout, as the design's 5.8

type LoadStatus = 'loading' | 'ready' | 'not_found' | 'offline' | 'error';

interface PickerHistoryState {
	/** Picker steps pushed above the picker's first entry (back gesture pops them one by one). */
	pickerDepth?: number;
}

function useWideLayout(): boolean {
	const [wide, setWide] = useState(false);
	useEffect(() => {
		if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
		const mq = window.matchMedia(WIDE_QUERY);
		const update = () => setWide(mq.matches);
		update();
		if (typeof mq.addEventListener === 'function') {
			mq.addEventListener('change', update);
			return () => mq.removeEventListener('change', update);
		}
		mq.addListener(update);
		return () => mq.removeListener(update);
	}, []);
	return wide;
}

/** First `limit` cards and a sentinel that asks for the next slice when it scrolls into view. */
function useWindowed(total: number, resetKey: string) {
	const [limit, setLimit] = useState(WINDOW);
	const sentinel = useRef<HTMLDivElement | null>(null);

	useEffect(() => {
		setLimit(WINDOW);
	}, [resetKey]);

	useEffect(() => {
		if (limit >= total) return;
		const el = sentinel.current;
		if (!el || typeof IntersectionObserver === 'undefined') {
			setLimit(total);
			return;
		}
		const io = new IntersectionObserver(
			(entries) => {
				if (entries.some((e) => e.isIntersecting)) setLimit((l) => l + WINDOW);
			},
			{rootMargin: '400px 0px'}
		);
		io.observe(el);
		return () => io.disconnect();
	}, [limit, total]);

	return {limit, sentinel};
}

export default function SetPicker() {
	const {t} = useTranslation();
	const history = useHistory();
	const location = useLocation<PickerHistoryState | undefined>();
	const reduxDispatch = useDispatch();
	const me = useMe();
	const online = useOnlineStatus();
	const keyboardInset = useKeyboardInset();
	const dbVersion = useTrainerDb();
	const wide = useWideLayout();
	useLLPatternsReady();
	usePuzzlePatternsReady();
	useIsometricPatternsReady();

	const code = parseSetPath(location.pathname)?.code || '';

	// ── Set ─────────────────────────────────────────────────────────────
	const [set, setSet] = useState<AlgSetData | null>(() => peekCachedAlgSet(code));
	const [status, setStatus] = useState<LoadStatus>(() => (peekCachedAlgSet(code) ? 'ready' : 'loading'));
	const [reloadKey, setReloadKey] = useState(0);
	const ownCodeChange = useRef<string | null>(null);

	useEffect(() => {
		if (!code) return;
		if (ownCodeChange.current === code) {
			ownCodeChange.current = null;
			return;
		}
		let alive = true;
		const cached = peekCachedAlgSet(code);
		setSet(cached);
		setStatus(cached ? 'ready' : 'loading');
		loadAlgSet(code).then(({loaded, notFound}) => {
			if (!alive) return;
			if (loaded) {
				if (!loaded.set.is_owner) {
					history.replace(buildSetPath(loaded.set.code || code));
					return;
				}
				if (loaded.set.code && loaded.set.code !== code) {
					ownCodeChange.current = loaded.set.code;
					history.replace(buildSetPath(loaded.set.code, true) + (typeof window !== 'undefined' ? window.location.search : ''));
				}
				setSet(loaded.set);
				setStatus('ready');
				return;
			}
			if (cached && !notFound) return; // keep the device copy
			setSet(null);
			setStatus(notFound ? 'not_found' : typeof navigator !== 'undefined' && navigator.onLine === false ? 'offline' : 'error');
		});
		return () => {
			alive = false;
		};
	}, [code, me?.id, reloadKey, history]);

	// A cached copy of somebody else's set (saved) is not ours to edit either.
	useEffect(() => {
		if (set && !set.is_owner) history.replace(buildSetPath(set.code || code));
	}, [set, code, history]);

	// ── Library ─────────────────────────────────────────────────────────
	const [library, setLibrary] = useState<Record<string, AlgorithmSubset[]> | null>(null);
	const [libraryError, setLibraryError] = useState(false);
	useEffect(() => {
		let alive = true;
		fetchDefaultAlgs().then(
			(data) => alive && setLibrary(data),
			() => alive && setLibraryError(true)
		);
		return () => {
			alive = false;
		};
	}, []);

	// The algorithm the user runs per case on this device (re-read when the trainer data changes).
	const deviceTexts = useMemo(() => readSavedAlgorithmTexts(), [dbVersion]);

	const tree = useMemo(() => buildPickerTree(library), [library]);
	const categoryOrder = useMemo(() => tree.flatMap((p) => p.categories.map((c) => c.category)), [tree]);
	const index = useMemo(() => buildCaseIndex(library, t, categoryOrder), [library, t, categoryOrder]);
	const caseByKey = useMemo(() => {
		const map = new Map<string, PickerCase>();
		for (const puzzle of tree) for (const cat of puzzle.categories) for (const c of cat.cases) map.set(c.key, c);
		return map;
	}, [tree]);

	const faces = usePatternFaces();

	// ── Selection ───────────────────────────────────────────────────────
	const [selection, setSelection] = useState<Map<string, PickerSelectionItem>>(() => new Map());
	const [limitHit, setLimitHit] = useState(false);
	const [panelOpen, setPanelOpen] = useState(false);
	const [adding, setAdding] = useState(false);
	const leavingRef = useRef(false);

	const inSet = useMemo(() => new Set((set?.items || []).map((row) => algSetCaseKey(row.category, row.case_name))), [set]);
	const setItemCount = set ? Math.max(set.items.length, set.item_count) : 0;
	const inSetByCategory = useMemo(() => countByCategory(set?.items || []), [set]);
	const selectedByCategory = useMemo(() => countByCategory(selection.values()), [selection]);
	const selectedItems = useMemo(() => Array.from(selection.values()), [selection]);

	const variantOf = useCallback(
		(pc: PickerCase) => selection.get(pc.key)?.algorithm || defaultVariant(pc.libraryAlg, deviceTexts.get(pc.key)),
		[selection, deviceTexts]
	);

	const toItem = useCallback(
		(pc: PickerCase, algorithm?: string, explicit = false): PickerSelectionItem => ({
			key: pc.key,
			category: pc.category,
			case_name: pc.name,
			subset: pc.subset,
			algorithm: algorithm || defaultVariant(pc.libraryAlg, deviceTexts.get(pc.key)),
			explicit,
		}),
		[deviceTexts]
	);

	// The latest selection for handlers and sheets (a fast second tap, or a sheet opened earlier).
	const selectionRef = useRef(selection);
	selectionRef.current = selection;
	const commit = useCallback((next: Map<string, PickerSelectionItem>) => {
		selectionRef.current = next;
		setSelection(next);
	}, []);

	const toggleCase = useCallback(
		(pc: PickerCase) => {
			if (inSet.has(pc.key)) return;
			const prev = selectionRef.current;
			const next = new Map(prev);
			if (next.has(pc.key)) {
				next.delete(pc.key);
				setLimitHit(false);
			} else {
				if (remainingSlots(setItemCount, prev.size) <= 0) {
					setLimitHit(true);
					return;
				}
				next.set(pc.key, toItem(pc));
			}
			commit(next);
			hapticImpact('light');
		},
		[inSet, setItemCount, toItem, commit]
	);

	/** Selects every pickable case of a group, or clears them when all are selected already. */
	const toggleGroup = useCallback(
		(cases: PickerCase[]) => {
			const pickable = pickableCases(cases, inSet);
			if (!pickable.length) return;
			const prev = selectionRef.current;
			const next = new Map(prev);
			if (pickable.every((c) => prev.has(c.key))) {
				pickable.forEach((c) => next.delete(c.key));
				setLimitHit(false);
			} else {
				let room = remainingSlots(setItemCount, prev.size);
				let cut = false;
				for (const c of pickable) {
					if (next.has(c.key)) continue;
					if (room <= 0) {
						cut = true;
						break;
					}
					next.set(c.key, toItem(c));
					room--;
				}
				setLimitHit(cut);
			}
			commit(next);
			hapticImpact('light');
		},
		[inSet, setItemCount, toItem, commit]
	);

	const removeSelected = useCallback(
		(key: string) => {
			const prev = selectionRef.current;
			if (!prev.has(key)) return;
			const next = new Map(prev);
			next.delete(key);
			commit(next);
			setLimitHit(false);
		},
		[commit]
	);

	useEffect(() => {
		if (selection.size === 0) setPanelOpen(false);
	}, [selection.size]);

	// ── Variant window ──────────────────────────────────────────────────
	const openVariant = useCallback(
		(pc: PickerCase) => {
			const current = variantOf(pc);
			const pick = async (algorithm: string) => {
				const prev = selectionRef.current;
				if (!prev.has(pc.key) && remainingSlots(setItemCount, prev.size) <= 0) {
					setLimitHit(true);
					return;
				}
				const next = new Map(prev);
				next.set(pc.key, toItem(pc, algorithm, true));
				commit(next);
			};
			reduxDispatch(
				openModal(
					<VariantSheet
						category={pc.category}
						caseName={pc.name}
						current={current}
						signedIn={!!me}
						onPick={pick}
					/>,
					{title: `${pc.name} · ${t('trainer.sets.variant_title')}`, width: 460}
				)
			);
		},
		[variantOf, setItemCount, toItem, commit, reduxDispatch, me, t]
	);

	// ── Steps ───────────────────────────────────────────────────────────
	const step = parsePickerStep(location.search);
	const depth = location.state?.pickerDepth || 0;
	const resolved = resolvePickerStep(tree, step);
	// Desktop always shows a category: the first one when the address names none.
	const firstCategory = tree[0]?.categories[0] || null;
	const activeCategory: PickerCategory | null = resolved.category || (wide ? firstCategory : null);
	const activeSub = resolved.category ? resolved.sub : wide && firstCategory ? (firstCategory.singleSubset ? ALL_SUBSETS : null) : null;
	// On a desktop "no subset" means all cases (the chips pick one).
	const shownSub = wide && activeCategory && !activeSub ? ALL_SUBSETS : activeSub;

	const goStep = useCallback(
		(next: PickerStep, replace = false) => {
			const target = {pathname: location.pathname, search: buildPickerSearch(next)};
			if (replace) history.replace({...target, state: {pickerDepth: depth}});
			else history.push({...target, state: {pickerDepth: depth + 1}});
		},
		[history, location.pathname, depth]
	);

	const openCategory = useCallback((category: string) => goStep({group: category, sub: null}, wide), [goStep, wide]);

	const stepBack = useCallback(() => {
		if (depth > 0) history.goBack();
		else goStep(parentPickerStep(tree, step), true);
	}, [depth, history, goStep, tree, step]);

	const [query, setQuery] = useState('');
	const searching = query.trim().length > 0;
	const search = useMemo(() => (searching ? searchCases(index, query) : null), [searching, index, query]);

	const [slotFilter, setSlotFilter] = useState('all');
	useEffect(() => {
		setSlotFilter('all');
	}, [activeCategory?.category]);

	const scrollRef = useRef<HTMLDivElement | null>(null);
	useEffect(() => {
		if (scrollRef.current) scrollRef.current.scrollTop = 0;
	}, [activeCategory?.category, shownSub, searching]);

	// Cases of step 3 (or the desktop panel), F2L slot filter applied.
	const caseGroups = useMemo(() => {
		if (!activeCategory || !shownSub) return [];
		const subsets =
			shownSub === ALL_SUBSETS ? activeCategory.subsets : activeCategory.subsets.filter((s) => s.subset === shownSub);
		return subsets
			.map((s) => ({
				subset: s.subset,
				cases:
					activeCategory.category === 'F2L' && slotFilter !== 'all' ? s.cases.filter((c) => c.name.endsWith(slotFilter)) : s.cases,
			}))
			.filter((g) => g.cases.length > 0);
	}, [activeCategory, shownSub, slotFilter]);
	const visibleCases = useMemo(() => caseGroups.flatMap((g) => g.cases), [caseGroups]);

	const listKey = searching ? `q:${query}` : `${activeCategory?.category || ''}|${shownSub || ''}|${slotFilter}`;
	const listTotal = searching ? search?.results.length || 0 : visibleCases.length;
	const {limit, sentinel} = useWindowed(listTotal, listKey);

	// ── Add ─────────────────────────────────────────────────────────────
	const libraryAlgOf = useCallback((key: string) => caseByKey.get(key)?.libraryAlg || null, [caseByKey]);

	const finish = useCallback(
		(next: AlgSetData, before: string[], fallbackCount: number) => {
			const full: AlgSetData = {...next, is_owner: true};
			rememberAlgSet(full);
			upsertOwnSet(full);
			const addedIds = addedItemIds(before, full.items);
			leavingRef.current = true;
			const target = buildSetPath(full.code || code);
			const navState = {addedIds};
			if (depth > 0) {
				// Drop the picker's own steps from the history first, then swap the picker for the set page.
				const unlisten = history.listen(() => {
					unlisten();
					history.replace(target, navState);
				});
				history.go(-depth);
			} else {
				history.replace(target, navState);
			}
			if (fallbackCount > 0) toastInfo(t('trainer.sets.variant_fallback', {count: fallbackCount}));
			else toastSuccess(t('trainer.sets.picker.added', {count: addedIds.length || selectedItems.length}));
		},
		[code, depth, history, t, selectedItems.length]
	);

	const submit = useCallback(async () => {
		if (!set || adding || selection.size === 0 || !online) return;
		setAdding(true);
		const before = Array.from(inSet);
		const items: AddItemInput[] = selectedItems.map((s) => ({category: s.category, case_name: s.case_name, algorithm: s.algorithm}));
		try {
			// Refused default variants fall back to the library algorithm once (shared with "Add to set", T12).
			const {set: next, fallbackCount} = await addItemsWithFallback(set.id, items, libraryAlgOf);
			finish(next, before, fallbackCount);
		} catch (err) {
			setAdding(false);
			toastError(getGqlErrorMessage(err, t, 'trainer.sets.load_error'));
		}
	}, [set, adding, selection.size, online, inSet, selectedItems, libraryAlgOf, finish, t]);

	// Leaving with picked but not added cases asks first (5.5). Steps inside the picker do not.
	const promptMessage = useCallback(
		(next: {pathname: string}) => {
			if (leavingRef.current || next.pathname === location.pathname) return true;
			return t('trainer.sets.leave_unsaved');
		},
		[location.pathname, t]
	);

	// ── Render ──────────────────────────────────────────────────────────
	const rootStyle = {'--keyboard-h': `${keyboardInset}px`} as React.CSSProperties;

	function renderCards(cases: PickerCase[], withBadge: boolean) {
		return cases.map((pc) => (
			<CaseCard
				key={pc.key}
				pc={pc}
				algorithm={variantOf(pc)}
				selected={selection.has(pc.key)}
				inSet={inSet.has(pc.key)}
				faces={faces}
				badge={withBadge ? pc.category : null}
				onToggle={toggleCase}
				onVariant={openVariant}
			/>
		));
	}

	function renderSearch() {
		if (!search) return null;
		if (search.total === 0) return <p className={b('message')}>{t('trainer.sets.picker.no_results')}</p>;
		const shown = search.results.slice(0, limit).map((r) => caseByKey.get(r.key)).filter(Boolean) as PickerCase[];
		return (
			<>
				<ul className={b('cases')}>{renderCards(shown, true)}</ul>
				{limit < search.results.length ? <div ref={sentinel} className={b('sentinel')} /> : null}
				{search.total > CASE_SEARCH_LIMIT ? (
					<p className={b('message')}>{t('trainer.sets.picker.more_results', {count: CASE_SEARCH_LIMIT})}</p>
				) : null}
			</>
		);
	}

	function renderCategories() {
		return tree.map((puzzle) => (
			<section key={puzzle.cubeType} className={b('section')}>
				<h3 className={b('section-title')}>{puzzle.cubeType}</h3>
				<ul className={b('tiles')}>
					{puzzle.categories.map((cat) => (
						<CategoryTile
							key={cat.category}
							category={cat}
							inSet={inSetByCategory.get(cat.category) || 0}
							selected={selectedByCategory.get(cat.category) || 0}
							faces={faces}
							onOpen={openCategory}
						/>
					))}
				</ul>
			</section>
		));
	}

	function subsetCounts(cases: PickerCase[]) {
		let inSetCount = 0;
		let selected = 0;
		for (const c of cases) {
			if (inSet.has(c.key)) inSetCount++;
			else if (selection.has(c.key)) selected++;
		}
		return {inSetCount, selected};
	}

	function renderSubsets(cat: PickerCategory) {
		const all = subsetCounts(cat.cases);
		return (
			<ul className={b('tiles')}>
				<SubsetTile
					allCases
					label={t('trainer.sets.picker.all_cases')}
					cases={cat.cases}
					inSet={all.inSetCount}
					selected={all.selected}
					selectState={groupSelectState(cat.cases, inSet, selection)}
					faces={faces}
					onOpen={() => goStep({group: cat.category, sub: ALL_SUBSETS})}
					onToggleAll={null}
				/>
				{cat.subsets.map((s) => {
					const counts = subsetCounts(s.cases);
					return (
						<SubsetTile
							key={s.subset}
							label={subsetLabel(t, s.subset) || s.subset}
							cases={s.cases}
							inSet={counts.inSetCount}
							selected={counts.selected}
							selectState={groupSelectState(s.cases, inSet, selection)}
							faces={faces}
							onOpen={() => goStep({group: cat.category, sub: s.subset})}
							onToggleAll={() => toggleGroup(s.cases)}
						/>
					);
				})}
			</ul>
		);
	}

	/** `lead` goes left of "Select all" (the desktop subset chips). */
	function renderCases(cat: PickerCategory, lead: React.ReactNode = null) {
		const selectState = groupSelectState(visibleCases, inSet, selection);
		let left = limit;
		const showHeadings = shownSub === ALL_SUBSETS && caseGroups.length > 1;
		return (
			<>
				<div className={b('cases-tools')}>
					{cat.category === 'F2L' ? (
						<div className={b('chips')} role="group" aria-label={t('trainer.f2l_slot')}>
							{['all', ...F2L_SLOTS].map((slot) => (
								<button
									key={slot}
									type="button"
									className={b('chip', {active: slotFilter === slot})}
									aria-pressed={slotFilter === slot}
									onClick={() => setSlotFilter(slot)}
								>
									{slot === 'all' ? t('trainer.f2l_slot_all') : t(`trainer.f2l_slot_${slot.toLowerCase().replace(' ', '_')}`)}
								</button>
							))}
						</div>
					) : (
						lead || <span />
					)}
					<button
						type="button"
						className={b('select-all', {on: selectState === 'all' || selectState === 'some'})}
						onClick={() => toggleGroup(visibleCases)}
						disabled={selectState === 'done'}
						aria-pressed={selectState === 'all'}
					>
						{selectState === 'done' ? t('trainer.sets.picker.all_in_set') : t('trainer.sets.picker.select_all')}
					</button>
				</div>
				{caseGroups.map((group) => {
					if (left <= 0) return null;
					const cases = group.cases.slice(0, left);
					left -= cases.length;
					const label = subsetLabel(t, group.subset);
					return (
						<section key={group.subset} className={b('section')}>
							{showHeadings && label && !isHiddenSubset(group.subset) ? <h3 className={b('section-title')}>{label}</h3> : null}
							<ul className={b('cases')}>{renderCards(cases, false)}</ul>
						</section>
					);
				})}
				{limit < visibleCases.length ? <div ref={sentinel} className={b('sentinel')} /> : null}
			</>
		);
	}

	function renderSubsetChips(cat: PickerCategory) {
		if (cat.singleSubset) return null;
		return (
			<div className={b('chips', {subsets: true})} role="group" aria-label={t('trainer.subsets')}>
				<button
					type="button"
					className={b('chip', {active: shownSub === ALL_SUBSETS})}
					aria-pressed={shownSub === ALL_SUBSETS}
					onClick={() => goStep({group: cat.category, sub: null}, true)}
				>
					{t('trainer.sets.picker.all_cases')}
				</button>
				{cat.subsets.map((s) => (
					<button
						key={s.subset}
						type="button"
						className={b('chip', {active: shownSub === s.subset})}
						aria-pressed={shownSub === s.subset}
						onClick={() => goStep({group: cat.category, sub: s.subset}, true)}
					>
						{subsetLabel(t, s.subset) || s.subset}
					</button>
				))}
			</div>
		);
	}

	function stepTitle(): string {
		if (!activeCategory) return t('trainer.sets.add_algorithms');
		if (shownSub && shownSub !== ALL_SUBSETS) return `${activeCategory.shortName} · ${subsetLabel(t, shownSub) || shownSub}`;
		return activeCategory.category;
	}

	let body: React.ReactNode;
	if (status === 'loading' || (!library && !libraryError && status === 'ready')) {
		body = (
			<p className={b('message')}>
				<CircleNotch className="spin" size={18} aria-hidden="true" /> {t('trainer.sets.loading')}
			</p>
		);
	} else if (status === 'not_found' || status === 'offline' || status === 'error' || libraryError || !set) {
		const text =
			status === 'not_found'
				? t('alg_set_errors.not_found')
				: status === 'offline'
					? t('trainer.sets.offline_needed')
					: t('trainer.sets.load_error');
		body = (
			<div className={b('state')}>
				{status === 'offline' ? <WifiSlash size={28} aria-hidden="true" /> : null}
				<p className={b('message')}>{text}</p>
				{status === 'not_found' ? (
					<Button gray text={t('trainer.sets.my_sets')} to={MY_SETS_PATH} />
				) : (
					<Button
						gray
						text={t('trainer.sets.retry')}
						onClick={() => {
							setLibraryError(false);
							if (!library) fetchDefaultAlgs().then(setLibrary, () => setLibraryError(true));
							setReloadKey((k) => k + 1);
						}}
					/>
				)}
			</div>
		);
	} else if (searching) {
		body = renderSearch();
	} else if (wide) {
		body = activeCategory ? (
			activeCategory.category === 'F2L' ? (
				<>
					{renderSubsetChips(activeCategory)}
					{renderCases(activeCategory)}
				</>
			) : (
				renderCases(activeCategory, renderSubsetChips(activeCategory))
			)
		) : null;
	} else if (!activeCategory) {
		body = renderCategories();
	} else if (!shownSub) {
		body = renderSubsets(activeCategory);
	} else {
		body = renderCases(activeCategory);
	}

	const ready = status === 'ready' && !!set && !!library;

	// Phone: under the title. Wide: on top of the category list (the page has a breadcrumb, no title).
	const searchBox = (
		<label className={b('search')}>
			<MagnifyingGlass size={18} aria-hidden="true" />
			<input
				type="search"
				value={query}
				onChange={(e) => setQuery(e.target.value.slice(0, 60))}
				onKeyDown={(e) => {
					if (e.key === 'Escape') setQuery('');
				}}
				placeholder={t('trainer.sets.picker.search_placeholder')}
				aria-label={t('trainer.sets.picker.search_placeholder')}
				disabled={!ready}
				enterKeyHint="search"
			/>
			{query ? (
				<button type="button" className={b('icon-btn')} onClick={() => setQuery('')} aria-label={t('trainer.sets.clear_search')}>
					<X size={16} weight="bold" aria-hidden="true" />
				</button>
			) : null}
		</label>
	);
	const showStepBack = !wide && !searching && !!resolved.category;

	return (
		<div className={b({wide})} style={rootStyle}>
			<Prompt when={selection.size > 0} message={promptMessage} />
			{/* Phone only: on a wide screen the breadcrumb reads "Sets > set > Add algorithms" and the
			    search sits on top of the category list. The phone nav already says "Add algorithms",
			    so the first step names the set and later steps the category or group being browsed. */}
			{wide ? null : (
				<div className={b('head')}>
					<div className={b('title-row')}>
						{showStepBack ? (
							<button type="button" className={b('icon-btn')} onClick={stepBack} aria-label={t('trainer.sets.picker.back')}>
								<ArrowLeft size={20} weight="bold" aria-hidden="true" />
							</button>
						) : null}
						<div className={b('titles')}>
							{!resolved.category || searching ? (
								set ? <h2 className={b('title')}>{set.name}</h2> : null
							) : (
								<>
									<h2 className={b('title')}>{stepTitle()}</h2>
									{set ? <span className={b('subtitle')}>{set.name}</span> : null}
								</>
							)}
						</div>
					</div>
					{searchBox}
				</div>
			)}

			<div className={b('body')}>
				{wide && ready ? (
					<nav className={b('nav')} aria-label={t('trainer.category')}>
						<div className={b('nav-search')}>{searchBox}</div>
						{tree.map((puzzle) => (
							<div key={puzzle.cubeType} className={b('nav-group')}>
								<h3 className={b('nav-title')}>{puzzle.cubeType}</h3>
								<ul className={b('nav-list')}>
									{puzzle.categories.map((cat) => (
										<CategoryNavItem
											key={cat.category}
											category={cat}
											active={!searching && activeCategory?.category === cat.category}
											inSet={inSetByCategory.get(cat.category) || 0}
											selected={selectedByCategory.get(cat.category) || 0}
											onOpen={(category) => {
												setQuery('');
												openCategory(category);
											}}
										/>
									))}
								</ul>
							</div>
						))}
					</nav>
				) : null}
				<div className={b('scroll')} ref={scrollRef}>
					{wide && ready && activeCategory && !searching ? <h2 className={b('panel-heading')}>{stepTitle()}</h2> : null}
					{body}
				</div>
			</div>

			{panelOpen && selectedItems.length > 0 ? (
				<SelectionPanel items={selectedItems} onRemove={removeSelected} onClose={() => setPanelOpen(false)} />
			) : null}
			{ready ? (
				<SelectionBar
					items={selectedItems}
					panelOpen={panelOpen}
					onTogglePanel={() => setPanelOpen((open) => !open)}
					onClear={() => {
						commit(new Map());
						setLimitHit(false);
					}}
					onAdd={submit}
					adding={adding}
					online={online}
					limitHit={limitHit}
					wide={wide}
				/>
			) : null}
		</div>
	);
}
