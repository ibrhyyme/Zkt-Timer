import {
	parseTrainerPath,
	buildTrainerPath,
	recognitionSubToView,
	recognitionViewToSub,
	efficiencySubToView,
	efficiencyViewToSub,
} from '../trainer_url';

describe('parseTrainerPath', () => {
	it('non-trainer path', () => {
		expect(parseTrainerPath('/stats')).toEqual({isTrainer: false, mode: null, sub: null, unknownMode: false});
	});

	it('bare /trainer = landing', () => {
		expect(parseTrainerPath('/trainer')).toEqual({isTrainer: true, mode: null, sub: null, unknownMode: false});
		expect(parseTrainerPath('/trainer/')).toEqual({isTrainer: true, mode: null, sub: null, unknownMode: false});
	});

	it('known mode, no sub', () => {
		expect(parseTrainerPath('/trainer/standard')).toMatchObject({mode: 'standard', sub: null, unknownMode: false});
		expect(parseTrainerPath('/trainer/recognition')).toMatchObject({mode: 'recognition', sub: null});
		expect(parseTrainerPath('/trainer/efficiency')).toMatchObject({mode: 'efficiency', sub: null});
	});

	it('known mode + sub', () => {
		expect(parseTrainerPath('/trainer/standard/train')).toMatchObject({mode: 'standard', sub: 'train'});
		expect(parseTrainerPath('/trainer/recognition/setup')).toMatchObject({mode: 'recognition', sub: 'setup'});
		expect(parseTrainerPath('/trainer/efficiency/settings')).toMatchObject({mode: 'efficiency', sub: 'settings'});
	});

	it('unknown mode → unknownMode flag', () => {
		expect(parseTrainerPath('/trainer/foo')).toEqual({isTrainer: true, mode: null, sub: null, unknownMode: true});
	});
});

describe('buildTrainerPath', () => {
	it('landing', () => expect(buildTrainerPath(null)).toBe('/trainer'));
	it('mode only', () => expect(buildTrainerPath('standard')).toBe('/trainer/standard'));
	it('mode + sub', () => expect(buildTrainerPath('standard', 'train')).toBe('/trainer/standard/train'));
	it('null sub = mode only', () => expect(buildTrainerPath('recognition', null)).toBe('/trainer/recognition'));
});

describe('round-trip: parse(build(x)) === x', () => {
	const cases: Array<['standard' | 'smart' | 'recognition' | 'efficiency', string | null]> = [
		['standard', null],
		['standard', 'train'],
		['recognition', 'setup'],
		['recognition', 'glossary'],
		['efficiency', 'settings'],
	];
	cases.forEach(([mode, sub]) => {
		it(`${mode}/${sub}`, () => {
			const parsed = parseTrainerPath(buildTrainerPath(mode, sub));
			expect(parsed.mode).toBe(mode);
			expect(parsed.sub).toBe(sub);
		});
	});
});

describe('recognition sub ↔ view', () => {
	it('null ↔ home', () => {
		expect(recognitionSubToView(null)).toBe('home');
		expect(recognitionViewToSub('home')).toBeNull();
	});
	it('train ↔ trainer (isim farki)', () => {
		expect(recognitionSubToView('train')).toBe('trainer');
		expect(recognitionViewToSub('trainer')).toBe('train');
	});
	it('identik isimler', () => {
		(['setup', 'results', 'settings', 'history', 'glossary'] as const).forEach((v) => {
			expect(recognitionSubToView(v)).toBe(v);
			expect(recognitionViewToSub(v)).toBe(v);
		});
	});
	it('bilinmeyen sub → null', () => {
		expect(recognitionSubToView('bogus')).toBeNull();
	});
});

describe('efficiency sub ↔ view', () => {
	it('null ↔ trainer', () => {
		expect(efficiencySubToView(null)).toBe('trainer');
		expect(efficiencyViewToSub('trainer')).toBeNull();
	});
	it('settings ↔ settings', () => {
		expect(efficiencySubToView('settings')).toBe('settings');
		expect(efficiencyViewToSub('settings')).toBe('settings');
	});
	it('bilinmeyen sub → null', () => {
		expect(efficiencySubToView('bogus')).toBeNull();
	});
});
