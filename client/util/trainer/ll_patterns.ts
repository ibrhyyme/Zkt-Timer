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

export function getLLPattern(algorithm: string): string | null {
	return cache?.[algorithm] ?? null;
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
		loadLLPatterns().then(() => setReady(true));
	}, [ready]);

	return ready;
}
