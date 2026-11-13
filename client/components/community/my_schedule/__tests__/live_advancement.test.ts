// Mirror of zekakuputurkiye-site lib/zkt/advancement.test.ts (G1-G9) and the
// client cases of advancement-wca.test.ts: the live colours must match the
// official table's, so the same vectors run against this copy of the math.
import {computeAdvancementStates, type AdvancementInput} from '../wca_live/live-advancement';

const full = (id: string, v: number): AdvancementInput => ({id, attempts: [v, v, v, v, v]});
const make = (count: number) => Array.from({length: count}, (_, i) => full(`c${i + 1}`, 1000 + (i + 1) * 100));

describe('computeAdvancementStates (site parity)', () => {
	it('G1: finished round, top 8 capped to 7 by Reg 9p1', () => {
		const m = computeAdvancementStates(make(10), 'RANKING', 8, 'AO5', null, null, true, 10);
		for (let i = 1; i <= 7; i++) expect(m.get(`c${i}`)).toEqual({advancing: true, questionable: false});
		for (let i = 8; i <= 10; i++) expect(m.get(`c${i}`)!.advancing).toBe(false);
	});

	it('G2: live with most of the field missing, everyone in is orange', () => {
		const m = computeAdvancementStates(make(5), 'RANKING', 8, 'AO5', null, null, false, 30);
		for (let i = 1; i <= 5; i++) expect(m.get(`c${i}`)).toEqual({advancing: true, questionable: true});
	});

	it('G3: live with everyone in, top 7 clinched', () => {
		const m = computeAdvancementStates(make(10), 'RANKING', 8, 'AO5', null, null, false, 10);
		for (let i = 1; i <= 7; i++) expect(m.get(`c${i}`)).toEqual({advancing: true, questionable: false});
		for (let i = 8; i <= 10; i++) expect(m.get(`c${i}`)!.advancing).toBe(false);
	});

	it('G4: one missing makes the last advancing slot orange', () => {
		const m = computeAdvancementStates(make(9), 'RANKING', 8, 'AO5', null, null, false, 10);
		for (let i = 1; i <= 6; i++) expect(m.get(`c${i}`)).toEqual({advancing: true, questionable: false});
		expect(m.get('c7')).toEqual({advancing: true, questionable: true});
		expect(m.get('c8')!.advancing).toBe(false);
		expect(m.get('c9')!.advancing).toBe(false);
	});

	it('G5: PERCENT 50 of 20 is 10', () => {
		const m = computeAdvancementStates(make(20), 'PERCENT', 50, 'AO5', null, null, true, 20);
		for (let i = 1; i <= 10; i++) expect(m.get(`c${i}`)).toEqual({advancing: true, questionable: false});
		for (let i = 11; i <= 20; i++) expect(m.get(`c${i}`)!.advancing).toBe(false);
	});

	it('G6: ATTEMPT_RESULT advances only results better than the level', () => {
		const rows = Array.from({length: 6}, (_, i) => full(`r${i + 1}`, (i + 1) * 1000));
		const m = computeAdvancementStates(rows, 'ATTEMPT_RESULT', 3500, 'AO5', null, null, true, 6);
		expect(m.get('r1')!.advancing).toBe(true);
		expect(m.get('r3')!.advancing).toBe(true);
		expect(m.get('r4')!.advancing).toBe(false);
		expect(m.get('r6')!.advancing).toBe(false);
	});

	it('G7: ATTEMPT_RESULT still capped at 75%', () => {
		const rows = Array.from({length: 4}, (_, i) => full(`c${i + 1}`, 1000 + i * 100));
		const m = computeAdvancementStates(rows, 'ATTEMPT_RESULT', 5000, 'AO5', null, null, true, 4);
		expect(['c1', 'c2', 'c3', 'c4'].filter((id) => m.get(id)!.advancing)).toHaveLength(3);
	});

	it('G8: a finished PERCENT round ignores registrants who never competed', () => {
		const m = computeAdvancementStates(make(18), 'PERCENT', 50, 'AO5', null, null, true, 21);
		for (let i = 1; i <= 9; i++) expect(m.get(`c${i}`)).toEqual({advancing: true, questionable: false});
		for (let i = 10; i <= 18; i++) expect(m.get(`c${i}`)!.advancing).toBe(false);
	});

	it('G9: a live round predicts the cut from the expected field', () => {
		const m = computeAdvancementStates(make(18), 'PERCENT', 50, 'AO5', null, null, false, 21);
		expect(m.get('c10')).toEqual({advancing: true, questionable: true});
		expect(m.get('c11')!.advancing).toBe(false);
	});

	it('drops a tie straddling the 75% cap as a group', () => {
		const rows = [1000, 1100, 1200, 1200].map((v, i) => ({id: `r${i + 1}`, attempts: [v]}));
		const m = computeAdvancementStates(rows, 'RANKING', 3, 'BO1', null, null, true, 4);
		expect(['r1', 'r2', 'r3', 'r4'].filter((id) => m.get(id)!.advancing)).toEqual(['r1', 'r2']);
	});

	it('caps a level above 75% of the field', () => {
		const rows = [1000, 1100, 1200, 1300].map((v, i) => ({id: `r${i + 1}`, attempts: [v]}));
		const m = computeAdvancementStates(rows, 'RANKING', 4, 'BO1', null, null, true, 4);
		expect(['r1', 'r2', 'r3', 'r4'].filter((id) => m.get(id)!.advancing)).toEqual(['r1', 'r2', 'r3']);
	});

	it('treats a short attempt list as incomplete, never as an average', () => {
		// Two of five in: no average yet, so not clinched even with everyone in.
		const m = computeAdvancementStates(
			[{id: 'a', attempts: [1000, 1000]}, ...make(3)],
			'RANKING',
			2,
			'AO5',
			null,
			null,
			false,
			4
		);
		expect(m.get('a')).toEqual({advancing: false, questionable: false});
		// Best case 'a' still overtakes c2, never c1.
		expect(m.get('c1')).toEqual({advancing: true, questionable: false});
		expect(m.get('c2')).toEqual({advancing: true, questionable: true});
	});

	it('counts a missed cutoff as finished', () => {
		// Cutoff 2 attempts under 10.00: 'm' missed it, so two attempts are all it gets.
		const rows = [
			{id: 'ok1', attempts: [800, 800, 800, 800, 800]},
			{id: 'ok2', attempts: [900, 900, 900, 900, 900]},
			{id: 'm', attempts: [1500, 1600]},
			{id: 'ok3', attempts: [950, 950, 950, 950, 950]},
		];
		const m = computeAdvancementStates(rows, 'RANKING', 2, 'AO5', 1000, 2, false, 4);
		expect(m.get('ok1')).toEqual({advancing: true, questionable: false});
		expect(m.get('m')!.advancing).toBe(false);
	});
});
