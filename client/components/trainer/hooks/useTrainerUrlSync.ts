/**
 * useTrainerUrlSync — TrainerContext (mode + standard/smart view) ile URL arasinda
 * cift yonlu senkronizasyon.
 *
 * OWNERSHIP: Bu hook SADECE mode + standard/smart view'i (landing/selection/training) yonetir.
 * mode 'recognition'/'efficiency' iken URL YAZMAZ — o modlarin alt-view URL'ini
 * ilgili sub-hook (useRecognitionUrlSync / useEfficiencyUrlSync) yazar. Boylece iki yazici
 * carpismaz. Bu hook yine de mode segmentini OKUR (state.mode'u set etmek icin).
 *
 * Anti-echo: idempotent diff — her iki yon de mevcut deger hedefe esitse erken doner,
 * dolayisiyla URL→state→URL dongusu 1 adimda biter.
 */
import {useEffect, useRef} from 'react';
import {useHistory, useLocation} from 'react-router-dom';
import {useTrainerContext} from '../TrainerContext';
import {parseTrainerPath, buildTrainerPath} from '../../../util/trainer/url/trainer_url';

export function useTrainerUrlSync() {
	const {state, dispatch} = useTrainerContext();
	const history = useHistory();
	const location = useLocation();

	// Stale-closure'dan kacinmak icin: URL→state effect'i sadece pathname'e bagli,
	// guncel state'i ref'ten okur.
	const stateRef = useRef(state);
	stateRef.current = state;
	const locRef = useRef(location);
	locRef.current = location;

	const urlInitRef = useRef(false);
	const reducerMountRef = useRef(false);

	// ── URL → reducer ────────────────────────────────────────────────
	useEffect(() => {
		const s = stateRef.current;
		const {mode, sub, unknownMode} = parseTrainerPath(location.pathname);

		// Guard: /trainer/foo gibi bilinmeyen mod → landing'e geri al
		if (unknownMode) {
			history.replace('/trainer');
			return;
		}

		// İlk mount: bare /trainer ama localStorage'da kayitli mod varsa canonical URL'e tasi
		if (!urlInitRef.current) {
			urlInitRef.current = true;
			if (mode === null && s.mode) {
				history.replace(buildTrainerPath(s.mode));
				return;
			}
		}

		// Landing (bare /trainer)
		if (mode === null) {
			if (s.view !== 'landing') dispatch({type: 'SET_VIEW', payload: 'landing'});
			return;
		}

		// Bilinen mod — state.mode'u hizala (SET_MODE view'i 'selection' yapar)
		if (s.mode !== mode) {
			dispatch({type: 'SET_MODE', payload: mode});
		}

		// Standard/smart view'i sub segmentinden hizala (recognition/efficiency'yi sub-hook yapar)
		if (mode === 'standard' || mode === 'smart') {
			if (sub === 'train') {
				// Guard: secili algoritma yoksa training kurulamaz → selection'a canonical'la
				if (s.checkedAlgorithms.length === 0) {
					history.replace(buildTrainerPath(mode));
				} else if (s.view !== 'training') {
					dispatch({type: 'SET_VIEW', payload: 'training'});
				}
			} else if (s.mode === mode && s.view !== 'selection') {
				dispatch({type: 'SET_VIEW', payload: 'selection'});
			}
		}
	}, [location.pathname, dispatch, history]);

	// ── reducer → URL ────────────────────────────────────────────────
	// Sadece kullanici aksiyonlarinda (mount sonrasi) yazar. Mount'taki hizalama
	// URL→state tarafinda yapilir, burada degil (cift navigasyon onleme).
	useEffect(() => {
		if (!reducerMountRef.current) {
			reducerMountRef.current = true;
			return;
		}
		// recognition/efficiency: URL'i sub-hook yazar
		if (state.mode === 'recognition' || state.mode === 'efficiency') return;

		let target: string;
		if (!state.mode || state.view === 'landing') {
			target = '/trainer';
		} else {
			target = buildTrainerPath(state.mode, state.view === 'training' ? 'train' : null);
		}

		if (target !== locRef.current.pathname) {
			history.push(target);
		}
	}, [state.mode, state.view, history]);
}
