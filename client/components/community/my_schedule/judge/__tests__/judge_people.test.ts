import {chancesOf, groupsOfChance, shownCompetitors} from '../judge-people';
import {JudgeBoardCompetitor, JudgeBoardGroup} from '../../../../../../shared/zkt_judge';

const person = (key: string, name: string, number: number, station: number, self?: boolean): JudgeBoardCompetitor => ({
	key,
	name,
	number,
	station,
	card: null,
	...(self === undefined ? {} : {self}),
});

const group = [
	person('a', 'İsmail İlkay Turhan', 38, 1),
	person('b', 'Yağız Selim Turhan', 37, 2),
	person('c', 'Ömer Tuğra Sarıkaya', 12, 3, true),
	person('d', 'Ali Çelik', 3, 4, false),
];
const keys = (list: JudgeBoardCompetitor[]) => list.map((c) => c.key);

describe('the "Hakem ol" competitor list', () => {
	it('puts the viewer first, the rest in station order', () => {
		expect(keys(shownCompetitors(group, ''))).toEqual(['c', 'a', 'b', 'd']);
	});

	it('keeps the order of an older site answer without the flag', () => {
		const old = group.map(({self, ...rest}) => rest);
		expect(keys(shownCompetitors(old, ''))).toEqual(['a', 'b', 'c', 'd']);
	});

	it('digits match the competitor or station number exactly', () => {
		expect(keys(shownCompetitors(group, '38'))).toEqual(['a']);
		expect(keys(shownCompetitors(group, '3'))).toEqual(['c', 'd']);
		expect(keys(shownCompetitors(group, '99'))).toEqual([]);
	});

	it('anything else searches the name, ignoring case and Turkish letters', () => {
		expect(keys(shownCompetitors(group, 'omer'))).toEqual(['c']);
		expect(keys(shownCompetitors(group, 'ILKAY'))).toEqual(['a']);
		expect(keys(shownCompetitors(group, 'yagiz'))).toEqual(['b']);
		expect(keys(shownCompetitors(group, 'celik'))).toEqual(['d']);
		expect(keys(shownCompetitors(group, ' turhan '))).toEqual(['a', 'b']);
		expect(keys(shownCompetitors(group, 'sarıkaya'))).toEqual(['c']);
	});
});

describe('the "Hakem ol" groups of a Çift Şans round', () => {
	const g = (id: string, number: number, chance: number): JudgeBoardGroup => ({id, number, chance, judges: [], competitors: []});
	const groups = [g('a', 1, 1), g('b', 2, 1), g('c', 6, 2), g('d', 7, 2)];
	const ids = (list: JudgeBoardGroup[]) => list.map((x) => x.id);

	it('lists the chances once, in order', () => {
		expect(chancesOf([groups[3], groups[0], groups[2]])).toEqual([1, 2]);
	});

	it('shows nothing until a chance is picked, then only its groups', () => {
		expect(groupsOfChance(groups, true, null)).toEqual([]);
		expect(ids(groupsOfChance(groups, true, 1))).toEqual(['a', 'b']);
		expect(ids(groupsOfChance(groups, true, 2))).toEqual(['c', 'd']);
	});

	it('an ordinary round lists every group', () => {
		expect(ids(groupsOfChance(groups.slice(0, 2), false, null))).toEqual(['a', 'b']);
	});
});
