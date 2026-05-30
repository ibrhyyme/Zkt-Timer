/**
 * useRecognitionUrlSync — RecognitionContext view'i ile `/trainer/recognition/{sub}`
 * URL'i arasinda cift yonlu senkron. Sadece recognition modu aktifken (RecognitionProvider
 * icinde) calisir; bu modun URL'ini TEK yazici olarak bu hook yonetir (ana hook recognition'da
 * URL yazmaz — bkz. useTrainerUrlSync ownership notu).
 *
 * mount yazimi: deep-link ise replace (canonicalize), landing'den giris ise push (geri tusu
 * landing'e donsun); sonraki nav'lar push.
 */
import {useEffect, useRef} from 'react';
import {useHistory, useLocation} from 'react-router-dom';
import {useRecognitionContext} from './RecognitionContext';
import {parseTrainerPath, recognitionSubToView, recognitionViewToSub} from '../../../util/trainer/url/trainer_url';

export function useRecognitionUrlSync() {
	const {state, setRecognitionView} = useRecognitionContext();
	const history = useHistory();
	const location = useLocation();

	const stateRef = useRef(state);
	stateRef.current = state;
	const locRef = useRef(location);
	locRef.current = location;
	const writeMountRef = useRef(false);

	// ── URL → view ──────────────────────────────────────────────────
	useEffect(() => {
		const {mode, sub} = parseTrainerPath(location.pathname);
		if (mode !== 'recognition') return; // modtan cikiliyor → ana hook ele alir
		const desired = recognitionSubToView(sub);
		if (!desired) {
			history.replace('/trainer/recognition'); // bilinmeyen sub → home
			return;
		}
		const s = stateRef.current;
		// buildInitialState ile AYNI data guard: canli veri olmayan view URL'i home'a canonical'la.
		// Yoksa initializer view'i 'home'a indirir ama bu effect URL'den 'results'/'trainer'i geri
		// dispatch eder → home<->results oscillation + junk history push. (review #4)
		if (
			(desired === 'results' && s.session.results.length === 0) ||
			(desired === 'trainer' && s.session.queue.length === 0)
		) {
			if (locRef.current.pathname !== '/trainer/recognition') history.replace('/trainer/recognition');
			return;
		}
		if (s.view !== desired) setRecognitionView(desired);
	}, [location.pathname, history, setRecognitionView]);

	// ── view → URL ──────────────────────────────────────────────────
	useEffect(() => {
		const sub = recognitionViewToSub(state.view);
		const target = sub ? `/trainer/recognition/${sub}` : '/trainer/recognition';
		if (target !== locRef.current.pathname) {
			if (!writeMountRef.current) {
				// mount: zaten recognition path'indeysek deep-link → replace; degilse (landing'den
				// giris) → push, boylece geri tusu landing'e doner.
				const onRecogPath = parseTrainerPath(locRef.current.pathname).mode === 'recognition';
				if (onRecogPath) history.replace(target);
				else history.push(target);
			} else {
				history.push(target);
			}
		}
		writeMountRef.current = true;
	}, [state.view, history]);
}
