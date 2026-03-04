/**
 * Isometric pattern verisi yukleyici.
 * isometric-patterns.json'u bir kere yukler, sonra senkron erisim saglar.
 */

import { useState, useEffect } from 'react';

let cache: Record<string, string> | null = null;
let loading: Promise<Record<string, string>> | null = null;

export function loadIsometricPatterns(): Promise<Record<string, string>> {
	if (cache) return Promise.resolve(cache);
	if (!loading) {
		loading = fetch('/public/trainer/isometric-patterns.json')
			.then((res) => res.json())
			.then((data) => {
				cache = data;
				return data;
			});
	}
	return loading;
}

export function getIsometricPattern(algorithm: string): string | null {
	return cache?.[algorithm] ?? null;
}

export function isIsometricPatternsLoaded(): boolean {
	return cache !== null;
}

/**
 * Pattern'ler yuklendiginde re-render tetikleyen hook.
 */
export function useIsometricPatternsReady(): boolean {
	const [ready, setReady] = useState(cache !== null);

	useEffect(() => {
		if (ready) return;
		loadIsometricPatterns().then(() => setReady(true));
	}, [ready]);

	return ready;
}
