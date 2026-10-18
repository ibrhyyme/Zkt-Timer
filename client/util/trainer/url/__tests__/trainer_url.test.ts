import {
	parseTrainerPath,
	buildTrainerPath,
	parseSetPath,
	trainerViewForPath,
	parseTrainerSearch,
	buildAlgorithmsPath,
	buildSetPath,
	legacyAlgorithmsTarget,
	recognitionSubToView,
	recognitionViewToSub,
	efficiencySubToView,
	efficiencyViewToSub,
	MY_SETS_PATH,
	COMMUNITY_PATH,
	MODES_PATH,
} from '../trainer_url';

const viewOf = (path: string) => trainerViewForPath(parseTrainerPath(path));

describe('parseTrainerPath', () => {
	it('non-trainer path', () => {
		expect(parseTrainerPath('/stats')).toMatchObject({isTrainer: false, entry: null, mode: null, sub: null, unknownMode: false});
	});

	it('bare /trainer = hub', () => {
		expect(parseTrainerPath('/trainer')).toMatchObject({isTrainer: true, entry: null, mode: null, sub: null, unknownMode: false});
		expect(parseTrainerPath('/trainer/')).toMatchObject({isTrainer: true, entry: null, mode: null, unknownMode: false});
	});

	it('entries that are their own mode', () => {
		expect(parseTrainerPath('/trainer/recognition')).toMatchObject({entry: 'recognition', mode: 'recognition', sub: null});
		expect(parseTrainerPath('/trainer/efficiency')).toMatchObject({entry: 'efficiency', mode: 'efficiency', sub: null});
		expect(parseTrainerPath('/trainer/ollcp/train')).toMatchObject({entry: 'ollcp', mode: 'ollcp', sub: 'train'});
		expect(parseTrainerPath('/trainer/recognition/setup')).toMatchObject({mode: 'recognition', sub: 'setup'});
		expect(parseTrainerPath('/trainer/efficiency/settings')).toMatchObject({mode: 'efficiency', sub: 'settings'});
	});

	it('algorithm trainer: the path carries no study mode', () => {
		expect(parseTrainerPath('/trainer/algorithms')).toMatchObject({entry: 'algorithms', mode: null, sub: null, legacyMode: null});
		expect(parseTrainerPath('/trainer/algorithms/train')).toMatchObject({entry: 'algorithms', sub: 'train'});
		expect(parseTrainerPath('/trainer/algorithms/community')).toMatchObject({entry: 'algorithms', sub: 'community'});
	});

	it('the Trainers page and Community Sets are entries of their own', () => {
		expect(parseTrainerPath('/trainer/modes')).toMatchObject({entry: 'modes', mode: null, unknownMode: false});
		expect(parseTrainerPath('/trainer/community')).toMatchObject({entry: 'community', mode: null, unknownMode: false});
		expect(parseTrainerPath('/trainer/modes/extra')).toMatchObject({entry: null, unknownMode: true});
		expect(parseTrainerPath('/trainer/community/extra')).toMatchObject({entry: null, unknownMode: true});
	});

	it('legacy /trainer/standard and /trainer/smart parse as the algorithm trainer', () => {
		expect(parseTrainerPath('/trainer/standard')).toMatchObject({entry: 'algorithms', mode: null, legacyMode: 'standard', sub: null});
		expect(parseTrainerPath('/trainer/smart/train')).toMatchObject({entry: 'algorithms', legacyMode: 'smart', sub: 'train'});
	});

	it('set pages', () => {
		expect(parseTrainerPath('/trainer/sets/Ab3dE6gH9k')).toMatchObject({entry: 'sets', setCode: 'Ab3dE6gH9k', sub: null});
		expect(parseTrainerPath('/trainer/sets/Ab3dE6gH9k/add')).toMatchObject({entry: 'sets', setCode: 'Ab3dE6gH9k', sub: 'add'});
		expect(parseTrainerPath('/trainer/sets')).toMatchObject({entry: 'sets', setCode: null, unknownMode: false});
	});

	it('unknown entry → unknownMode flag', () => {
		expect(parseTrainerPath('/trainer/foo')).toMatchObject({isTrainer: true, entry: null, mode: null, unknownMode: true});
	});
});

describe('parseSetPath', () => {
	it('code and picker', () => {
		expect(parseSetPath('/trainer/sets/abc123')).toEqual({code: 'abc123', add: false});
		expect(parseSetPath('/trainer/sets/abc123/add')).toEqual({code: 'abc123', add: true});
		expect(parseSetPath('/trainer/sets/abc123/')).toEqual({code: 'abc123', add: false});
	});

	it('anything else is not a set path', () => {
		expect(parseSetPath('/trainer/sets')).toBeNull();
		expect(parseSetPath('/trainer/sets/abc/edit')).toBeNull();
		expect(parseSetPath('/trainer/sets/abc/add/more')).toBeNull();
		expect(parseSetPath('/trainer/algorithms/sets')).toBeNull();
		expect(parseSetPath('/trainer/sets/%E0%A4%A')).toBeNull(); // broken escape
		expect(parseSetPath('/trainer/sets/' + 'x'.repeat(65))).toBeNull();
	});
});

describe('trainerViewForPath', () => {
	it('hub, Trainers page, algorithm trainer and set views', () => {
		expect(viewOf('/trainer')).toBe('landing');
		expect(viewOf('/trainer/modes')).toBe('modes');
		expect(viewOf('/trainer/algorithms')).toBe('selection');
		expect(viewOf('/trainer/algorithms/train')).toBe('training');
		expect(viewOf('/trainer/sets')).toBe('sets');
		expect(viewOf('/trainer/community')).toBe('community');
		expect(viewOf('/trainer/sets/abc')).toBe('set');
		expect(viewOf('/trainer/sets/abc/add')).toBe('set-add');
	});

	it('the old tabs have no view of their own (rewritten first)', () => {
		expect(viewOf('/trainer/algorithms/sets')).toBeNull();
		expect(viewOf('/trainer/algorithms/community')).toBeNull();
	});

	it('legacy paths map to selection and training only', () => {
		expect(viewOf('/trainer/standard')).toBe('selection');
		expect(viewOf('/trainer/smart/train')).toBe('training');
		expect(viewOf('/trainer/standard/sets')).toBeNull();
	});

	it('unknown sub-views and other entries → null', () => {
		expect(viewOf('/trainer/algorithms/foo')).toBeNull();
		expect(viewOf('/trainer/sets/abc/edit')).toBeNull();
		expect(viewOf('/trainer/recognition')).toBeNull();
		expect(viewOf('/trainer/foo')).toBeNull();
		expect(viewOf('/stats')).toBeNull();
	});
});

describe('parseTrainerSearch', () => {
	it('reads cat, set and mode', () => {
		expect(parseTrainerSearch('?cat=pll&mode=smart')).toEqual({cat: 'pll', set: null, mode: 'smart'});
		expect(parseTrainerSearch('?set=Ab3dE6gH9k')).toEqual({cat: null, set: 'Ab3dE6gH9k', mode: null});
		expect(parseTrainerSearch('?mode=standard')).toMatchObject({mode: 'standard'});
	});

	it('an unknown mode is not set', () => {
		expect(parseTrainerSearch('?mode=recognition').mode).toBeNull();
		expect(parseTrainerSearch('').mode).toBeNull();
		expect(parseTrainerSearch(null)).toEqual({cat: null, set: null, mode: null});
	});
});

describe('buildAlgorithmsPath', () => {
	it('selection with category, smart only when smart', () => {
		expect(buildAlgorithmsPath(null)).toBe('/trainer/algorithms');
		expect(buildAlgorithmsPath(null, {cat: 'pll'})).toBe('/trainer/algorithms?cat=pll');
		expect(buildAlgorithmsPath(null, {cat: 'pll', mode: 'smart'})).toBe('/trainer/algorithms?cat=pll&mode=smart');
		expect(buildAlgorithmsPath(null, {cat: 'pll', mode: 'standard'})).toBe('/trainer/algorithms?cat=pll');
	});

	it('training: set wins over category', () => {
		expect(buildAlgorithmsPath('train', {set: 'Ab3dE6gH9k', cat: 'pll', mode: 'smart'})).toBe(
			'/trainer/algorithms/train?set=Ab3dE6gH9k&mode=smart'
		);
		expect(buildAlgorithmsPath('train', {cat: '2x2-cll'})).toBe('/trainer/algorithms/train?cat=2x2-cll');
	});

	it('set list addresses', () => {
		expect(MY_SETS_PATH).toBe('/trainer/sets');
		expect(COMMUNITY_PATH).toBe('/trainer/community');
		expect(MODES_PATH).toBe('/trainer/modes');
	});

	it('round trip through the parser', () => {
		const url = buildAlgorithmsPath('train', {set: 'Ab3dE6gH9k', mode: 'smart'});
		const [path, query] = url.split('?');
		expect(viewOf(path)).toBe('training');
		expect(parseTrainerSearch('?' + query)).toEqual({cat: null, set: 'Ab3dE6gH9k', mode: 'smart'});
	});
});

describe('buildSetPath', () => {
	it('page and picker, round trip', () => {
		expect(buildSetPath('Ab3dE6gH9k')).toBe('/trainer/sets/Ab3dE6gH9k');
		expect(buildSetPath('Ab3dE6gH9k', true)).toBe('/trainer/sets/Ab3dE6gH9k/add');
		expect(parseSetPath(buildSetPath('Ab3dE6gH9k', true))).toEqual({code: 'Ab3dE6gH9k', add: true});
	});
});

describe('legacyAlgorithmsTarget', () => {
	const target = (path: string, search = '') => legacyAlgorithmsTarget(parseTrainerPath(path), search);

	it('the four old addresses (2.5), query kept', () => {
		expect(target('/trainer/standard')).toBe('/trainer/algorithms');
		expect(target('/trainer/standard/train', '?cat=pll')).toBe('/trainer/algorithms/train?cat=pll');
		expect(target('/trainer/smart')).toBe('/trainer/algorithms?mode=smart');
		expect(target('/trainer/smart/train', '?cat=oll')).toBe('/trainer/algorithms/train?cat=oll&mode=smart');
	});

	it('a mode already in the query wins', () => {
		expect(target('/trainer/smart', '?mode=standard')).toBe('/trainer/algorithms?mode=standard');
	});

	it('the old set tabs move to their own pages, query kept', () => {
		expect(target('/trainer/algorithms/sets')).toBe('/trainer/sets');
		expect(target('/trainer/algorithms/community', '?q=oll&sort=new')).toBe('/trainer/community?q=oll&sort=new');
	});

	it('current addresses and prototype keys are not legacy', () => {
		expect(target('/trainer/algorithms')).toBeNull();
		expect(target('/trainer/algorithms/train', '?cat=pll')).toBeNull();
		expect(target('/trainer/algorithms/constructor')).toBeNull();
		expect(target('/trainer/sets')).toBeNull();
	});

	it('not a legacy path → null', () => {
		expect(target('/trainer/algorithms')).toBeNull();
		expect(target('/trainer/recognition')).toBeNull();
	});
});

describe('buildTrainerPath', () => {
	it('landing', () => expect(buildTrainerPath(null)).toBe('/trainer'));
	it('mode entries', () => {
		expect(buildTrainerPath('recognition')).toBe('/trainer/recognition');
		expect(buildTrainerPath('recognition', 'setup')).toBe('/trainer/recognition/setup');
		expect(buildTrainerPath('recognition', null)).toBe('/trainer/recognition');
	});
	it('standard and smart go to the algorithm trainer', () => {
		expect(buildTrainerPath('standard')).toBe('/trainer/algorithms');
		expect(buildTrainerPath('smart', 'train')).toBe('/trainer/algorithms/train');
	});
});

describe('round-trip: parse(build(x)) === x for mode entries', () => {
	const cases: Array<['recognition' | 'efficiency' | 'ollcp', string | null]> = [
		['recognition', null],
		['recognition', 'setup'],
		['recognition', 'glossary'],
		['efficiency', 'settings'],
		['ollcp', 'train'],
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
