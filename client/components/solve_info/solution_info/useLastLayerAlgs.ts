import { useEffect, useState } from 'react';
import { fetchLibraryCategory } from '../../../util/trainer/trainer_library';
import { prepareAlgs, PreparedAlg } from '../../../../shared/smart_cube/ll_alg_match';
import type { AlgorithmSubset } from '../../trainer/types';

export interface LastLayerAlgs {
	oll: PreparedAlg[];
	pll: PreparedAlg[];
}

let loading: Promise<LastLayerAlgs> | null = null;

function texts(subsets: AlgorithmSubset[]): string[] {
	return subsets.flatMap((s) => s.algorithms.flatMap((a) => [a.algorithm, ...(a.alternatives || [])]));
}

/**
 * The trainer library's OLL and PLL algorithms, mains and alternatives, for writing a smart
 * solve's last layer as the algorithm it was (ll_alg_match.ts). Loaded once per page from the
 * library the trainer keeps on the device; null until then, and the table reads the turns plainly.
 */
export function useLastLayerAlgs(enabled: boolean): LastLayerAlgs | null {
	const [algs, setAlgs] = useState<LastLayerAlgs | null>(null);
	useEffect(() => {
		if (!enabled) return;
		let cancelled = false;
		if (!loading) {
			loading = Promise.all([fetchLibraryCategory('OLL'), fetchLibraryCategory('PLL')]).then(([oll, pll]) => ({
				oll: prepareAlgs(texts(oll)),
				pll: prepareAlgs(texts(pll)),
			}));
			// Offline with nothing kept: try again on the next solve opened.
			loading.catch(() => {
				loading = null;
			});
		}
		loading.then((loaded) => !cancelled && setAlgs(loaded)).catch(() => {});
		return () => {
			cancelled = true;
		};
	}, [enabled]);
	return algs;
}
