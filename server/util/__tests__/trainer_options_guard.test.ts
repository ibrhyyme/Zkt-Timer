import {isOlderTrainerOptions, trainerOptionsTs} from '../trainer_options_guard';

const blob = (ts: number) => JSON.stringify({v: 1, ts, options: {randomizeAUF: false}});

describe('trainer_options server guard', () => {
	it('reads the change time of a blob', () => {
		expect(trainerOptionsTs(blob(1700))).toBe(1700);
		expect(trainerOptionsTs(null)).toBe(0);
		expect(trainerOptionsTs('not json')).toBe(0);
		// Legacy plain options object, no ts.
		expect(trainerOptionsTs(JSON.stringify({randomizeAUF: false}))).toBe(0);
	});

	it('skips an older copy so a newer one from another device survives', () => {
		expect(isOlderTrainerOptions(blob(1000), blob(2000))).toBe(true);
	});

	it('writes a newer or equal copy, and any copy when the server has none', () => {
		expect(isOlderTrainerOptions(blob(3000), blob(2000))).toBe(false);
		expect(isOlderTrainerOptions(blob(2000), blob(2000))).toBe(false);
		expect(isOlderTrainerOptions(blob(0), null)).toBe(false);
	});
});
