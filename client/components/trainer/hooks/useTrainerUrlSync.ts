/**
 * useTrainerUrlSync — TrainerContext (mode + standard/smart view + KATEGORI) ile URL arasinda
 * cift yonlu senkronizasyon.
 *
 * URL kapsami: mode (path) + view (path: selection/train) + kategori (`?cat=<slug>`).
 * Subset ve algoritma secimi URL'e GIRMEZ — ZBLL gibi buyuk kategorilerde URL'i devasa/paylasilamaz
 * yapardi; secim session-local'dir.
 *
 * OWNERSHIP: mode 'recognition'/'efficiency' iken URL yazmaz (sub-hook'lar yazar); mode segmentini
 * yine de okur. Anti-echo: idempotent diff.
 */
import {useEffect, useRef} from 'react';
import {useHistory, useLocation} from 'react-router-dom';
import {useTrainerContext} from '../TrainerContext';
import {useAlgorithmData} from './useAlgorithmData';
import {parseTrainerPath, buildTrainerPath} from '../../../util/trainer/url/trainer_url';
import {categoryToSlug, slugToCategory} from '../../../util/trainer/url/category_slug';

/** Kategori → `?cat=<slug>` (bos kategori → bos search). */
function catSearch(category: string): string {
	return category ? '?cat=' + encodeURIComponent(categoryToSlug(category)) : '';
}

export function useTrainerUrlSync() {
	const {state, dispatch} = useTrainerContext();
	const {categories} = useAlgorithmData();
	const history = useHistory();
	const location = useLocation();

	const stateRef = useRef(state);
	stateRef.current = state;
	const locRef = useRef(location);
	locRef.current = location;
	const catsRef = useRef(categories);
	catsRef.current = categories;
	const reducerMountRef = useRef(false);

	// ── URL → reducer ────────────────────────────────────────────────
	useEffect(() => {
		const s = stateRef.current;
		const {mode, sub, unknownMode} = parseTrainerPath(location.pathname);

		if (unknownMode) {
			history.replace('/trainer'); // bilinmeyen mod → landing
			return;
		}

		if (mode === null) {
			if (s.view !== 'landing') dispatch({type: 'SET_VIEW', payload: 'landing'});
			return;
		}

		if (s.mode !== mode) dispatch({type: 'SET_MODE', payload: mode});

		// recognition/efficiency: alt-view'i kendi sub-hook'lari yonetir
		if (mode !== 'standard' && mode !== 'smart') return;

		// ── Kategori (?cat=) ──
		const urlCat = new URLSearchParams(location.search).get('cat');
		let category: string | null = null;
		if (urlCat) {
			const cats = catsRef.current;
			if (cats.length === 0) return; // kategoriler yuklenmedi — categories.length dep'i ile tekrar calisir
			category = slugToCategory(urlCat, cats);
			if (!category) {
				history.replace(buildTrainerPath(mode)); // cozulemeyen slug → selection
				return;
			}
			// SADECE gercekten farkliysa dispatch et (SET_CATEGORY subset/secimi sifirlar — case-mismatch'te tetiklenmesin)
			if (s.selectedCategory !== category) dispatch({type: 'SET_CATEGORY', payload: category});
		}

		// ── View (train / selection) ──
		if (sub === 'train') {
			if (s.checkedAlgorithms.length === 0) {
				// Soguk /train (secim yok, alg URL'de tutulmuyor) → selection'a dus, kategoriyi koru
				history.replace(buildTrainerPath(mode) + catSearch(category || s.selectedCategory));
			} else if (s.view !== 'training') {
				dispatch({type: 'SET_VIEW', payload: 'training'});
			}
		} else if (s.view !== 'selection') {
			dispatch({type: 'SET_VIEW', payload: 'selection'});
		}
	}, [location.pathname, location.search, categories.length, dispatch, history]);

	// ── reducer → URL ────────────────────────────────────────────────
	useEffect(() => {
		if (!reducerMountRef.current) {
			reducerMountRef.current = true;
			return;
		}
		const s = state;
		if (s.mode === 'recognition' || s.mode === 'efficiency' || s.mode === 'ollcp') return;

		let path: string;
		let search = '';
		if (!s.mode || s.view === 'landing') {
			path = '/trainer';
		} else {
			path = buildTrainerPath(s.mode, s.view === 'training' ? 'train' : null);
			search = catSearch(s.selectedCategory);
		}
		const target = path + search;
		const current = locRef.current.pathname + locRef.current.search;
		if (target !== current) {
			if (path !== locRef.current.pathname) history.push(target);
			else history.replace(target);
		}
	}, [state.mode, state.view, state.selectedCategory, history]);
}
