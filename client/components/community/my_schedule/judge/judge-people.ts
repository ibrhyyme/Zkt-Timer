// The competitor list of the "Hakem ol" picker: what the search keeps and in
// which order. Pure, so it is unit tested (__tests__/judge_people.test.ts).

import {JudgeBoardCompetitor, JudgeBoardGroup} from '../../../../../shared/zkt_judge';

/** Case and Turkish letters folded, so "omer" finds "Ömer" and "ILKAY" finds "İlkay". */
function fold(text: string): string {
	return text
		.toLocaleLowerCase('tr')
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.replace(/ı/g, 'i');
}

/**
 * The competitors the search keeps, the viewer's own line first: a judge who
 * competes in the group finds themselves at the top, as on the competitors page.
 * Digits match the competitor or station number exactly, anything else the name.
 */
export function shownCompetitors(competitors: JudgeBoardCompetitor[], query: string): JudgeBoardCompetitor[] {
	const q = query.trim();
	const kept = !q
		? competitors
		: /^\d+$/.test(q)
			? competitors.filter((c) => String(c.number ?? '') === q || String(c.station ?? '') === q)
			: competitors.filter((c) => fold(c.name).includes(fold(q)));
	return [...kept.filter((c) => c.self), ...kept.filter((c) => !c.self)];
}

/** The chances a Çift Şans round's groups belong to, in order (1, 2). */
export function chancesOf(groups: readonly JudgeBoardGroup[]): number[] {
	return [...new Set(groups.map((g) => g.chance))].sort((a, c) => a - c);
}

/**
 * The groups the picker offers. A Çift Şans round lists one chance at a time,
 * picked first (owner, 2026-11-14: "1 · Şans 1 … 10 · Şans 2" in one list
 * confused the judges); nothing until a chance is chosen. Any other round lists all.
 */
export function groupsOfChance(groups: readonly JudgeBoardGroup[], dualChance: boolean, chance: number | null): JudgeBoardGroup[] {
	if (!dualChance) return [...groups];
	return chance == null ? [] : groups.filter((g) => g.chance === chance);
}
