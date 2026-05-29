/**
 * useEfficiencyUrlSync — EfficiencyContext view'i ile `/trainer/efficiency[/settings]`
 * URL'i arasinda cift yonlu senkron. Sadece efficiency modu aktifken calisir; bu modun
 * URL'ini tek yazici olarak bu hook yonetir (ana hook efficiency'de URL yazmaz).
 *
 * Not (Faz 1): sadece view (trainer/settings) senkronize edilir. Config (type/rot/axis/len/slot)
 * Faz 4'te query param olarak eklenecek. In-session scramble history transient — URL'e girmez.
 */
import {useEffect, useRef} from 'react';
import {useHistory, useLocation} from 'react-router-dom';
import {useEfficiencyContext} from './EfficiencyContext';
import {parseTrainerPath, efficiencySubToView, efficiencyViewToSub} from '../../../util/trainer/url/trainer_url';

export function useEfficiencyUrlSync() {
	const {state, setEfficiencyView} = useEfficiencyContext();
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
		if (mode !== 'efficiency') return; // modtan cikiliyor → ana hook ele alir
		const desired = efficiencySubToView(sub);
		if (!desired) {
			history.replace('/trainer/efficiency'); // bilinmeyen sub → trainer view
			return;
		}
		if (stateRef.current.view !== desired) setEfficiencyView(desired);
	}, [location.pathname, history, setEfficiencyView]);

	// ── view → URL ──────────────────────────────────────────────────
	useEffect(() => {
		const sub = efficiencyViewToSub(state.view);
		const target = sub ? `/trainer/efficiency/${sub}` : '/trainer/efficiency';
		if (target !== locRef.current.pathname) {
			if (!writeMountRef.current) {
				const onEffPath = parseTrainerPath(locRef.current.pathname).mode === 'efficiency';
				if (onEffPath) history.replace(target); // deep-link canonicalize
				else history.push(target); // landing'den giris → geri tusu landing'e donsun
			} else {
				history.push(target);
			}
		}
		writeMountRef.current = true;
	}, [state.view, history]);
}
