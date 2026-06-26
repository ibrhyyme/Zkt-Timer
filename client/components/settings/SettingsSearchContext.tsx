import {createContext, useContext} from 'react';

// Shared search state for the settings modal. Provided by SettingsModal,
// consumed by TimerSettingsGroup to filter rows/groups by the current query.
interface SettingsSearchValue {
	query: string;
}

const SettingsSearchContext = createContext<SettingsSearchValue>({query: ''});

export const SettingsSearchProvider = SettingsSearchContext.Provider;

export function useSettingsSearch(): SettingsSearchValue {
	return useContext(SettingsSearchContext);
}

// Turkish-aware, accent/case-insensitive normalization so that e.g.
// "gorunum" matches "Görünüm" and "sifirlama" matches "Sıfırlama".
function normalize(text: string | undefined): string {
	return (text || '')
		.replace(/[İIı]/g, 'i')
		.replace(/[Şş]/g, 's')
		.replace(/[Ğğ]/g, 'g')
		.replace(/[Çç]/g, 'c')
		.replace(/[Öö]/g, 'o')
		.replace(/[Üü]/g, 'u')
		.toLowerCase()
		.normalize('NFD')
		.replace(/\p{Diacritic}/gu, '')
		.trim();
}

// Returns true when the query is empty or matches any of the given texts.
export function matchesSearch(query: string, ...texts: (string | undefined)[]): boolean {
	const q = normalize(query);
	if (!q) return true;
	return texts.some((t) => normalize(t).includes(q));
}
