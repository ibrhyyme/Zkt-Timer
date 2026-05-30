/**
 * useEfficiencyUrlSync — EfficiencyContext (view + config) ile URL arasinda cift yonlu senkron.
 * Sadece efficiency modu aktifken calisir; bu modun URL'ini tek yazici olarak bu hook yonetir.
 *
 * Path: `/trainer/efficiency` (trainer view) | `/trainer/efficiency/settings`.
 * Config query (sadece trainer view): `?type=&rot=&axis=&len=&slot=` (RubiksSolverDemo tarzi
 * paylasilabilir solver config). In-session scramble history transient — URL'e girmez.
 */
import {useEffect, useRef} from 'react';
import {useHistory, useLocation} from 'react-router-dom';
import {useEfficiencyContext} from './EfficiencyContext';
import {
	parseTrainerPath,
	efficiencySubToView,
	parseEfficiencyQuery,
	buildEfficiencySearch,
} from '../../../util/trainer/url/trainer_url';

export function useEfficiencyUrlSync() {
	const {state, dispatch, setEfficiencyView} = useEfficiencyContext();
	const history = useHistory();
	const location = useLocation();

	const stateRef = useRef(state);
	stateRef.current = state;
	const locRef = useRef(location);
	locRef.current = location;
	const writeMountRef = useRef(false);

	// ── URL → view + config ─────────────────────────────────────────
	useEffect(() => {
		const {mode, sub} = parseTrainerPath(location.pathname);
		if (mode !== 'efficiency') return; // modtan cikiliyor → ana hook ele alir

		const desired = efficiencySubToView(sub);
		if (!desired) {
			history.replace('/trainer/efficiency'); // bilinmeyen sub → trainer
			return;
		}
		if (stateRef.current.view !== desired) setEfficiencyView(desired);

		// Config hidrasyonu sadece trainer view'da ve URL'de config varsa
		if (desired === 'trainer') {
			const q = parseEfficiencyQuery(location.search);
			const s = stateRef.current.session;
			const stateSearch = buildEfficiencySearch(s.type, s.rotation, s.eoAxis, s.targetLength, s.xcrossSlot);
			if (q.type && location.search !== stateSearch) {
				dispatch({
					type: 'HYDRATE_CONFIG',
					payload: {
						type: q.type ?? undefined,
						rotation: q.rot ?? undefined,
						eoAxis: q.axis ?? undefined,
						targetLength: q.len ?? undefined,
						xcrossSlot: q.slot ?? undefined,
					},
				});
			}
		}
	}, [location.pathname, location.search, history, setEfficiencyView, dispatch]);

	// ── view + config → URL ─────────────────────────────────────────
	useEffect(() => {
		const {view, session} = state;
		const targetPath = view === 'settings' ? '/trainer/efficiency/settings' : '/trainer/efficiency';
		const targetSearch =
			view === 'settings'
				? ''
				: buildEfficiencySearch(session.type, session.rotation, session.eoAxis, session.targetLength, session.xcrossSlot);
		const target = targetPath + targetSearch;
		const current = locRef.current.pathname + locRef.current.search;

		if (target !== current) {
			const pathChanged = targetPath !== locRef.current.pathname;
			if (!writeMountRef.current) {
				// mount: deep-link ise replace (canonicalize), landing'den giris ise push
				const onEffPath = parseTrainerPath(locRef.current.pathname).mode === 'efficiency';
				if (onEffPath) history.replace(target);
				else history.push(target);
			} else if (pathChanged) {
				history.push(target); // view navigasyonu
			} else {
				history.replace(target); // config tweak (history spam yok)
			}
		}
		writeMountRef.current = true;
	}, [
		state.view,
		state.session.type,
		state.session.rotation,
		state.session.eoAxis,
		state.session.targetLength,
		state.session.xcrossSlot,
		history,
	]);
}
