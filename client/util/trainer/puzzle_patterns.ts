/**
 * 2D puzzle pattern verisi yukleyici.
 * puzzle-patterns.json'u bir kere yukler, sonra senkron erisim saglar.
 */

import {useState, useEffect} from 'react';

interface SQ1Pattern {
	t: number[];
	b: number[];
}

type PuzzlePatterns = Record<string, Record<string, string | SQ1Pattern>>;

let cache: PuzzlePatterns | null = null;
let loading: Promise<PuzzlePatterns> | null = null;

export function loadPuzzlePatterns(): Promise<PuzzlePatterns> {
	if (cache) return Promise.resolve(cache);
	if (!loading) {
		loading = fetch('/public/trainer/puzzle-patterns.json')
			.then((res) => res.json())
			.then((data) => {
				cache = data;
				return data;
			});
	}
	return loading;
}

export function getPuzzlePattern(puzzleType: string, algorithm: string, category?: string): string | SQ1Pattern | null {
	if (!cache || !cache[puzzleType]) return null;
	if (category) {
		const catKey = `${category}::${algorithm}`;
		if (cache[puzzleType][catKey] !== undefined) return cache[puzzleType][catKey];
	}
	return cache[puzzleType][algorithm] ?? null;
}

export function isPuzzlePatternsLoaded(): boolean {
	return cache !== null;
}

/**
 * Pattern'ler yuklendiginde re-render tetikleyen hook.
 */
export function usePuzzlePatternsReady(): boolean {
	const [ready, setReady] = useState(cache !== null);

	useEffect(() => {
		if (ready) return;
		loadPuzzlePatterns().then(() => setReady(true));
	}, [ready]);

	return ready;
}
