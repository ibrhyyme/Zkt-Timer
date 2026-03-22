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

export function saveCustomPattern(algorithm: string, pattern: string) {
	const patterns = getCustomPatterns();
	patterns[algorithm] = pattern;
	localStorage.setItem(CUSTOM_PATTERNS_KEY, JSON.stringify(patterns));
}

export function getLLPattern(algorithm: string): string | null {
	return cache?.[algorithm] ?? getCustomPatterns()[algorithm] ?? null;
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
