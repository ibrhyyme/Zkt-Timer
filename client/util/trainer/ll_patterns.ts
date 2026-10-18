/**
 * 2D-LL pattern verisi yükleyici.
 * ll-patterns.json'u bir kere yükler, sonra senkron erişim sağlar.
 */

import { useState, useEffect } from 'react';

let cache: Record<string, string> | null = null;
let loading: Promise<Record<string, string>> | null = null;

export function loadLLPatterns(): Promise<Record<string, string>> {
	if (cache) return Promise.resolve(cache);
	if (!loading) {
		loading = fetch('/public/trainer/ll-patterns.json')
			.then((res) => res.json())
			.then((data) => {
				cache = data;
				return data;
			});
	}
	return loading;
}

const CUSTOM_PATTERNS_KEY = 'trainer_customPatterns';

function getCustomPatterns(): Record<string, string> {
	try {
		return JSON.parse(localStorage.getItem(CUSTOM_PATTERNS_KEY) || '{}');
	} catch {
		return {};
	}
}

// Patterns made on this device for cases the file does not have (the newer library categories).
// null marks a text the generator could not read: those cases fall back to the 3D view.
const generated = new Map<string, string | null>();
const generating = new Map<string, Promise<string | null>>();

export function getLLPattern(algorithm: string): string | null {
	return cache?.[algorithm] ?? generated.get(algorithm) ?? getCustomPatterns()[algorithm] ?? null;
}

/** The pattern of `algorithm`, generated with cubing.js when the file lacks it. Kept for the session. */
export function ensureLLPattern(algorithm: string): Promise<string | null> {
	const known = getLLPattern(algorithm);
	if (known) return Promise.resolve(known);
	if (generated.has(algorithm)) return Promise.resolve(null);
	let pending = generating.get(algorithm);
	if (!pending) {
		pending = import('./pattern_utils')
			.then(({generateLLPattern}) => generateLLPattern(algorithm))
			.catch(() => null)
			.then((pattern) => {
				generated.set(algorithm, pattern);
				generating.delete(algorithm);
				return pattern;
			});
		generating.set(algorithm, pending);
	}
	return pending;
}

/**
 * The LL pattern of a case for a view. `pending` while a missing pattern is being generated
 * (the view shows an empty box, never a 3D player it would throw away a moment later).
 */
export function useLLPattern(algorithm: string, enabled: boolean): {pattern: string | null; pending: boolean} {
	const loaded = cache !== null;
	const pattern = enabled ? getLLPattern(algorithm) : null;
	const needed = enabled && loaded && !pattern && !generated.has(algorithm);
	const [, setTick] = useState(0);

	useEffect(() => {
		if (!needed) return;
		let alive = true;
		ensureLLPattern(algorithm).then(() => {
			if (alive) setTick((n) => n + 1);
		});
		return () => {
			alive = false;
		};
	}, [needed, algorithm]);

	return {pattern, pending: enabled && (!loaded || needed)};
}

export function isLLPatternsLoaded(): boolean {
	return cache !== null;
}

/**
 * Pattern'ler yüklendiğinde re-render tetikleyen hook.
 * Parent component'te kullanılır — children da re-render olur.
 */
export function useLLPatternsReady(): boolean {
	const [ready, setReady] = useState(cache !== null);

	useEffect(() => {
		if (ready) return;
		let cancelled = false;
		loadLLPatterns().then(() => {
			if (!cancelled) setReady(true);
		});
		return () => {
			cancelled = true;
		};
	}, [ready]);

	return ready;
}
