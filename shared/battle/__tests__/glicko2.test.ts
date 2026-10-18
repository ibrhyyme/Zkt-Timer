import {
	conservativeRating,
	displayDelta,
	glicko2Update,
	inflateRd,
	initialRating,
	isProvisional,
	isProvisionalJump,
	prepareForMatch,
	previewDeltas,
	rateMatch,
	ratingAfterGame,
	scoreFor,
} from '../glicko2';
import { GlickoRating } from '../types';
import { INITIAL_RATING, INITIAL_RD, INITIAL_VOLATILITY, MAX_RD } from '../config';

const settled = (rating: number, rd = 60): GlickoRating => ({ rating, rd, volatility: 0.06 });
const fresh = (): GlickoRating => initialRating();

describe('glicko2Update', () => {
	it("reproduces Glickman's published example", () => {
		// Glickman, "Example of the Glicko-2 system": 1500/200/0.06 against three opponents.
		const result = glicko2Update(settled(1500, 200), [
			{ opponent: settled(1400, 30), score: 1 },
			{ opponent: settled(1550, 100), score: 0 },
			{ opponent: settled(1700, 300), score: 0 },
		]);
		expect(result.rating).toBeCloseTo(1464.06, 1);
		expect(result.rd).toBeCloseTo(151.52, 1);
		expect(result.volatility).toBeCloseTo(0.05999, 4);
	});

	it('only grows RD when the period has no games', () => {
		const result = glicko2Update(settled(1500, 60), []);
		expect(result.rating).toBe(1500);
		expect(result.rd).toBeGreaterThan(60);
	});

	it('starts new players at 1500 / 350 / 0.06', () => {
		expect(fresh()).toEqual({ rating: INITIAL_RATING, rd: INITIAL_RD, volatility: INITIAL_VOLATILITY });
	});
});

describe('design 4.4 table', () => {
	it('two new players: +162 / -162', () => {
		expect(previewDeltas(fresh(), fresh())).toMatchObject({ win: 162, loss: -162 });
		expect(Math.round(ratingAfterGame(fresh(), fresh(), 1).rating)).toBe(1662);
		expect(Math.round(ratingAfterGame(fresh(), fresh(), 0).rating)).toBe(1338);
	});

	it('new player against a settled 1500: +175 / -175', () => {
		expect(previewDeltas(fresh(), settled(1500))).toMatchObject({ win: 175, loss: -175 });
	});

	it('settled 1500 against a new player: +7 / -7', () => {
		expect(previewDeltas(settled(1500), fresh())).toMatchObject({ win: 7, loss: -7 });
	});

	it('settled against settled at 1500: +10 / -10', () => {
		expect(previewDeltas(settled(1500), settled(1500))).toEqual({ win: 10, draw: 0, loss: -10 });
	});

	it('settled 1600 against settled 1400: about +5 / -15', () => {
		const d = previewDeltas(settled(1600), settled(1400));
		expect(d.win).toBe(5);
		expect(Math.abs(d.loss + 15)).toBeLessThanOrEqual(1);
		const r = previewDeltas(settled(1400), settled(1600));
		expect(Math.abs(r.win - 15)).toBeLessThanOrEqual(1);
		expect(r.loss).toBe(-5);
	});

	it('a new account beating a settled 2000 jumps to 2042 (+542), the 2000 loses 12', () => {
		const strong = settled(2000);
		const result = rateMatch(fresh(), strong, 'A');
		expect(Math.round(result.a.rating)).toBe(2042);
		expect(displayDelta(1500, result.a.rating)).toBe(542);
		expect(displayDelta(2000, result.b.rating)).toBe(-12);
		// ...but the leaderboard key keeps it mid table (about 1400, RD about 320).
		expect(result.a.rd).toBeGreaterThan(300);
		expect(Math.round(conservativeRating(result.a.rating, result.a.rd))).toBeGreaterThan(1350);
		expect(Math.round(conservativeRating(result.a.rating, result.a.rd))).toBeLessThan(1450);
		expect(isProvisionalJump(0, 1500, result.a.rating)).toBe(true);
	});

	it('a new player alternating wins and losses around 1500 is no longer provisional by game 10', () => {
		let p = fresh();
		for (let game = 1; game <= 10; game++) {
			p = ratingAfterGame(p, settled(1500), game % 2);
			if (game < 10) expect(isProvisional(p.rd)).toBe(true);
		}
		expect(p.rd).toBeLessThan(110);
		expect(isProvisional(p.rd)).toBe(false);
	});
});

describe('inactivity', () => {
	it('90 idle days take RD from 50 to about 110', () => {
		expect(inflateRd(50, 0.06, 90)).toBeCloseTo(110.8, 0);
	});

	it('never grows RD past 350', () => {
		expect(inflateRd(300, 0.06, 100000)).toBe(MAX_RD);
	});

	it('prepareForMatch applies the idle days and leaves rating alone', () => {
		const day = 24 * 60 * 60 * 1000;
		const now = Date.UTC(2026, 9, 6);
		const prepared = prepareForMatch(settled(1700, 50), now - 90 * day, now);
		expect(prepared.rating).toBe(1700);
		expect(prepared.rd).toBeCloseTo(110.8, 0);
		expect(prepareForMatch(null, null, now)).toEqual(fresh());
		expect(prepareForMatch(settled(1700, 50), new Date(now), new Date(now)).rd).toBe(50);
	});
});

describe('preview equals the final result', () => {
	it('the delta written after the match is the previewed one', () => {
		const a = settled(1623, 74);
		const b = settled(1580, 95);
		const preview = previewDeltas(a, b);
		for (const winner of ['A', 'B', 'DRAW'] as const) {
			const after = rateMatch(a, b, winner).a.rating;
			const expected = winner === 'A' ? preview.win : winner === 'B' ? preview.loss : preview.draw;
			expect(displayDelta(a.rating, after)).toBe(expected);
		}
	});

	it('scores sides', () => {
		expect(scoreFor('A', 'A')).toBe(1);
		expect(scoreFor('A', 'B')).toBe(0);
		expect(scoreFor('DRAW', 'B')).toBe(0.5);
	});
});

describe('provisional jump flag', () => {
	it('only in the first five games and only above +300', () => {
		expect(isProvisionalJump(4, 1500, 1801)).toBe(true);
		expect(isProvisionalJump(5, 1500, 1801)).toBe(false);
		expect(isProvisionalJump(0, 1500, 1800)).toBe(false);
	});
});
