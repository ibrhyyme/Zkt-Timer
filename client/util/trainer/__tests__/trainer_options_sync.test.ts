import {
	DEFAULT_TRAINER_OPTIONS,
	parseTrainerOptionsBlob,
	resolveTrainerOptions,
	sameTrainerOptions,
	sanitizeTrainerOptions,
	serializeTrainerOptions,
	trainerOptionsDeviceKey,
} from '../trainer_options_sync';

const aufOff = {...DEFAULT_TRAINER_OPTIONS, randomizeAUF: false};

describe('sanitizeTrainerOptions', () => {
	it('fills missing keys from defaults', () => {
		expect(sanitizeTrainerOptions({randomizeAUF: false})).toEqual(aufOff);
	});

	it('drops unknown keys, wrong types and invalid enum values', () => {
		const out = sanitizeTrainerOptions({
			randomizeAUF: 'no',
			bogus: 1,
			topFace: 'X',
			frontFace: 'R',
			backView: 'upside-down',
			cubeSize: 'big',
		});
		expect(out).toEqual({...DEFAULT_TRAINER_OPTIONS, frontFace: 'R'});
		expect((out as any).bogus).toBeUndefined();
	});

	it('lastMode (trainer-sets 2.3) keeps standard or smart and drops anything else', () => {
		expect(DEFAULT_TRAINER_OPTIONS.lastMode).toBe('standard');
		expect(sanitizeTrainerOptions({lastMode: 'smart'}).lastMode).toBe('smart');
		expect(sanitizeTrainerOptions({lastMode: 'recognition'}).lastMode).toBe('standard');
		expect(sanitizeTrainerOptions({lastMode: 3}).lastMode).toBe('standard');
	});

	it('a blob from a client that predates lastMode reads as standard', () => {
		const old = JSON.stringify({v: 1, ts: 10, options: {randomizeAUF: false}});
		expect(parseTrainerOptionsBlob(old)?.options.lastMode).toBe('standard');
	});

	it('a lastMode change counts as a change (it is synced across devices)', () => {
		expect(sameTrainerOptions(DEFAULT_TRAINER_OPTIONS, {...DEFAULT_TRAINER_OPTIONS, lastMode: 'smart'})).toBe(false);
	});

	it('clamps slider values to the ranges the settings modal offers', () => {
		const out = sanitizeTrainerOptions({autoLearnThreshold: 99, cubeSize: 20});
		expect(out.autoLearnThreshold).toBe(10);
		expect(out.cubeSize).toBe(180);
	});
});

describe('parseTrainerOptionsBlob', () => {
	it('reads the versioned blob', () => {
		const blob = serializeTrainerOptions(aufOff, 1234);
		expect(parseTrainerOptionsBlob(blob)).toEqual({ts: 1234, options: aufOff});
	});

	it('reads the legacy plain object the trainer used to write, with ts 0', () => {
		expect(parseTrainerOptionsBlob(JSON.stringify({randomizeAUF: false}))).toEqual({ts: 0, options: aufOff});
	});

	it('returns null for empty or broken input', () => {
		expect(parseTrainerOptionsBlob(null)).toBeNull();
		expect(parseTrainerOptionsBlob('')).toBeNull();
		expect(parseTrainerOptionsBlob('{not json')).toBeNull();
		expect(parseTrainerOptionsBlob('[1,2]')).toBeNull();
	});
});

describe('resolveTrainerOptions', () => {
	it('uses defaults when nothing is stored', () => {
		expect(resolveTrainerOptions(null, null)).toEqual({
			options: DEFAULT_TRAINER_OPTIONS,
			ts: 0,
			source: 'default',
			pushLocal: false,
		});
	});

	it('the 2.8-b case: a toggle switched off on another device shows off here', () => {
		const local = serializeTrainerOptions(DEFAULT_TRAINER_OPTIONS, 100);
		const remote = serializeTrainerOptions(aufOff, 200);
		const r = resolveTrainerOptions(local, remote);
		expect(r.options.randomizeAUF).toBe(false);
		expect(r.source).toBe('remote');
		expect(r.pushLocal).toBe(false);
	});

	it('an offline change (newer device copy) wins and is marked for upload', () => {
		const local = serializeTrainerOptions(aufOff, 300);
		const remote = serializeTrainerOptions(DEFAULT_TRAINER_OPTIONS, 200);
		const r = resolveTrainerOptions(local, remote);
		expect(r.options).toEqual(aufOff);
		expect(r.source).toBe('local');
		expect(r.pushLocal).toBe(true);
	});

	it('a legacy device copy is migrated up when the server has nothing yet', () => {
		const r = resolveTrainerOptions(JSON.stringify({randomizeAUF: false}), null);
		expect(r.options).toEqual(aufOff);
		expect(r.pushLocal).toBe(true);
	});

	it('any real server copy beats a legacy device copy', () => {
		const remote = serializeTrainerOptions({...DEFAULT_TRAINER_OPTIONS, cubeSize: 400}, 50);
		const r = resolveTrainerOptions(JSON.stringify({randomizeAUF: false}), remote);
		expect(r.options.cubeSize).toBe(400);
		expect(r.options.randomizeAUF).toBe(true);
		expect(r.source).toBe('remote');
	});

	it('on a tie the server wins and nothing is uploaded', () => {
		const local = serializeTrainerOptions(aufOff, 500);
		const remote = serializeTrainerOptions(DEFAULT_TRAINER_OPTIONS, 500);
		const r = resolveTrainerOptions(local, remote);
		expect(r.source).toBe('remote');
		expect(r.pushLocal).toBe(false);
	});

	it('a newer device copy equal to the server copy is not uploaded again', () => {
		const r = resolveTrainerOptions(serializeTrainerOptions(aufOff, 900), serializeTrainerOptions(aufOff, 100));
		expect(r.pushLocal).toBe(false);
	});
});

describe('helpers', () => {
	it('device key is per account', () => {
		expect(trainerOptionsDeviceKey('u1')).toBe('trainer_options:u1');
		expect(trainerOptionsDeviceKey(null)).toBe('trainer_options:_anon');
	});

	it('sameTrainerOptions compares every option', () => {
		expect(sameTrainerOptions(DEFAULT_TRAINER_OPTIONS, {...DEFAULT_TRAINER_OPTIONS})).toBe(true);
		expect(sameTrainerOptions(DEFAULT_TRAINER_OPTIONS, aufOff)).toBe(false);
	});
});
