// The competitor list of the "Hakem ol" picker: what the search keeps and in
// which order. Pure, so it is unit tested (__tests__/judge_people.test.ts).

import {JudgeBoardCompetitor} from '../../../../../shared/zkt_judge';

/** Case and Turkish letters folded, so "omer" finds "Ömer" and "ILKAY" finds "İlkay". */
function fold(text: string): string {
	return text
		.toLocaleLowerCase('tr')
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
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
