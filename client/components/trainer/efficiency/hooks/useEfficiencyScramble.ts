/**
 * Scramble uretip cozum hazirlar.
 * - reqId guard: stale-request korumasi
 * - stateRef: next() stable referans (deps sadece dispatch) -> useEffect sonsuz dongu yok
 * - targetLength + rotation yok -> getEasyCross (aninda). getEasy patlarsa/null -> uret-ve-ele.
 * - Tum yollar throw-safe: ekran her durumda dolar (en kotu random scramble).
 */
import {useCallback, useRef} from 'react';
import {useEfficiencyContext} from '../EfficiencyContext';
import {generateAndSolve, generateEasyScramble} from '../../../../util/trainer/efficiency/generation';
import {selectSolution} from '../../../../util/trainer/efficiency/solution_select';
import {isCrossSolverAvailable} from '../../../../util/cross-solver/worker-manager';
import {getNewScramble} from '../../../timer/helpers/scramble';

const MAX_ATTEMPTS = 50;
const TIMEOUT_MS = 2500;

export function useEfficiencyScramble() {
	const {state, dispatch} = useEfficiencyContext();
	const reqIdRef = useRef(0);
	const stateRef = useRef(state);
	stateRef.current = state;

	const next = useCallback(async () => {
		if (!isCrossSolverAvailable()) {
			dispatch({type: 'SCRAMBLE_READY', payload: {scramble: getNewScramble('333'), results: []}});
			return;
		}

		const reqId = ++reqIdRef.current;
		dispatch({type: 'SCRAMBLE_LOADING'});

		const {type, eoAxis, targetLength, xcrossSlot, rotation} = stateRef.current.session;
		const deadline = Date.now() + TIMEOUT_MS;

		try {
			// targetLength + rotation yok -> getEasyCross (full pruning, aninda + tam uzunluk).
			// getEasy patlarsa/null donerse sessizce uret-ve-ele'ye dus (ekran bos kalmasin).
			if (targetLength !== undefined) {
				let easy: {scramble: string; results: import('../../../../util/cross-solver/types').SolverResult[]} | null = null;
				try {
					easy = await generateEasyScramble(type, targetLength, xcrossSlot, rotation);
				} catch {
					easy = null;
				}
				if (easy) {
					if (reqIdRef.current === reqId) dispatch({type: 'SCRAMBLE_READY', payload: easy});
					return;
				}
			}

			// Uret-ve-ele / random fallback
			let chosen = await generateAndSolve(type, xcrossSlot, rotation);

			if (targetLength !== undefined) {
				// timeout/limit'te hedefe EN YAKIN sonucu tut — rastgele dondurme yok
				let best = chosen;
				let bestDist = Infinity;
				for (let i = 0; i < MAX_ATTEMPTS; i++) {
					const sel = selectSolution(chosen.results, type, eoAxis);
					const dist = sel ? Math.abs(sel.moveCount - targetLength) : Infinity;
					if (dist < bestDist) {
						bestDist = dist;
						best = chosen;
					}
					if (dist === 0) break; // tam hedef
					if (Date.now() > deadline) break; // timeout -> best (en yakin) kullanilir
					if (reqIdRef.current !== reqId) return; // stale
					chosen = await generateAndSolve(type, xcrossSlot, rotation);
				}
				chosen = best;
			}

			if (reqIdRef.current === reqId) {
				dispatch({type: 'SCRAMBLE_READY', payload: chosen});
			}
		} catch {
			if (reqIdRef.current === reqId) {
				dispatch({type: 'SCRAMBLE_READY', payload: {scramble: '', results: []}});
			}
		}
	}, [dispatch]);

	return {next};
}
