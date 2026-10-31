import {
	isWcaV1Id,
	normalizeRecordTag,
	parseV1CompId,
	parseV1PersonId,
	parseV1RoundId,
	v1CompId,
	v1Competitors,
	v1OverviewEvents,
	v1PersonId,
	v1Podiums,
	v1RecordsFromRounds,
	v1RegistrationToCompetitorResults,
	v1RoundId,
	v1RoundMap,
	v1RoundToWcaLiveResults,
	v1RoundsWithResults,
} from '../WcaV1LiveAdapter';

const COMP = 'NewAgeTurkey2026';

// Shaped like GET /api/v1/competitions/<id>/live/rounds: 333 runs three rounds
// (r1 open, r2 ready, r3 pending), 222-r1 and 222-r2 are dual rounds feeding
// the 222 final, clock is a single locked round.
const fromRegistrations = {participationSource: {type: 'registrations'}, reservedPlaces: null};
const rounds = [
	{id: 'clock-r1', format: 'a', timeLimit: {centiseconds: 6000, cumulativeRoundIds: []}, participationRuleset: fromRegistrations, state: 'locked', total_competitors: 20},
	{
		id: '333-r1',
		format: 'a',
		timeLimit: {centiseconds: 30000, cumulativeRoundIds: []},
		cutoff: {numberOfAttempts: 2, resultValue: 12000},
		participationRuleset: fromRegistrations,
		state: 'open',
		total_competitors: 58,
		completed_competitors: 40,
	},
	{
		id: '333-r2',
		format: 'a',
		participationRuleset: {
			participationSource: {type: 'round', roundId: '333-r1', resultCondition: {type: 'percent', scope: 'average', value: 75}},
		},
		state: 'ready',
	},
	{
		id: '333-r3',
		format: 'a',
		participationRuleset: {
			participationSource: {type: 'round', roundId: '333-r2', resultCondition: {type: 'ranking', scope: 'average', value: 8}},
		},
		state: 'pending',
	},
	{id: '222-r1', format: 'a', participationRuleset: fromRegistrations, state: 'locked', total_competitors: 44},
	{id: '222-r2', format: 'a', participationRuleset: fromRegistrations, state: 'open', total_competitors: 30, completed_competitors: 0},
	{
		id: '222-r3',
		format: 'm',
		participationRuleset: {
			participationSource: {
				type: 'linkedRounds',
				roundIds: ['222-r1', '222-r2'],
				resultCondition: {type: 'resultAchieved', scope: 'average', value: 500},
			},
		},
		state: 'pending',
	},
];

const wcif = {
	name: 'New Age Turkey 2026',
	events: [{id: '333'}, {id: '222'}, {id: 'clock'}],
	persons: [
		{registrantId: 1, name: 'AJ Nicholls', wcaId: '2015NICH04', registration: {wcaRegistrationId: 1421281, status: 'accepted'}},
		{registrantId: 2, name: 'Newcomer Person', wcaId: null, registration: {wcaRegistrationId: 1421284, status: 'accepted'}},
		{registrantId: 3, name: 'Staff Only', wcaId: '2010STAF01', registration: null},
	],
};

const clockPayload = {
	id: 'clock-r1',
	format: 'a',
	competitors: [
		{id: 10, name: 'First', country_iso2: 'TR', wca_id: '2020FIRS01'},
		{id: 11, name: 'Second', country_iso2: 'IR', wca_id: '2020SECO01'},
		{id: 12, name: 'Third', country_iso2: 'GB', wca_id: '2020THIR01'},
		{id: 13, name: 'Fourth', country_iso2: 'TR', wca_id: null},
	],
	results: [
		{local_pos: 4, global_pos: 4, registration_id: 13, best: 900, average: 1000, attempts: []},
		{
			local_pos: 1,
			global_pos: 1,
			registration_id: 10,
			best: 500,
			average: 600,
			single_record_tag: 'ER',
			average_record_tag: 'NR',
			advancing: true,
			advancing_questionable: false,
			attempts: [
				{attempt_number: 2, value: 700},
				{attempt_number: 1, value: 500},
				{attempt_number: 3, value: -1},
			],
		},
		{local_pos: 3, global_pos: 3, registration_id: 12, best: 800, average: 850, single_record_tag: 'PR', attempts: []},
		{local_pos: 2, global_pos: 2, registration_id: 11, best: 600, average: 700, attempts: []},
	],
};

describe('WCA v1 live ids', () => {
	test('round trip and validation', () => {
		expect(parseV1CompId(v1CompId(COMP))).toBe(COMP);
		expect(parseV1RoundId(v1RoundId(COMP, '333oh-r2'))).toEqual({competitionId: COMP, roundWcifId: '333oh-r2'});
		expect(parseV1PersonId(v1PersonId(COMP, 1424438))).toEqual({competitionId: COMP, registrationId: '1424438'});
		expect(isWcaV1Id('957359')).toBe(false);
		expect(isWcaV1Id('zkt-istanbul')).toBe(false);
	});

	test('rejects anything that could escape the request path', () => {
		expect(parseV1RoundId(`wcav1:${COMP}:../../users`)).toBeNull();
		expect(parseV1RoundId('wcav1:Bad Comp:333-r1')).toBeNull();
		expect(parseV1RoundId(`wcav1:${COMP}:333-r1:extra`)).toBeNull();
		expect(parseV1PersonId(`wcav1:${COMP}:12a`)).toBeNull();
		expect(parseV1CompId(`wcav1:${COMP}:333-r1`)).toBeNull();
		expect(parseV1RoundId(`wcav1:${COMP}`)).toBeNull();
	});
});

describe('v1OverviewEvents', () => {
	const events = v1OverviewEvents(COMP, rounds, wcif);
	const round = (eventId: string, n: number) =>
		events.find((e: any) => e.eventId === eventId).rounds.find((r: any) => r.number === n);

	test('events follow the WCIF order, rounds their number', () => {
		expect(events.map((e: any) => e.eventId)).toEqual(['333', '222', 'clock']);
		expect(events[0].rounds.map((r: any) => r.number)).toEqual([1, 2, 3]);
	});

	test('lifecycle state maps onto open / active / finished', () => {
		expect(round('333', 1)).toMatchObject({open: true, active: true, finished: false, numEntered: 40, numResults: 58});
		expect(round('333', 2)).toMatchObject({open: false, active: false, finished: false, numResults: 0});
		expect(round('clock', 1)).toMatchObject({open: true, active: false, finished: true, numEntered: 20, numResults: 20});
	});

	test('names and the final flag', () => {
		expect(round('333', 1)).toMatchObject({name: 'First round', isFinal: false});
		expect(round('333', 3)).toMatchObject({name: 'Final', isFinal: true});
		expect(round('clock', 1).isFinal).toBe(true);
	});

	test('format, time limit and cutoff', () => {
		expect(round('333', 1).format).toEqual({numberOfAttempts: 5, sortBy: 'average'});
		expect(round('222', 3).format).toEqual({numberOfAttempts: 3, sortBy: 'average'});
		expect(round('333', 1).timeLimit).toEqual({centiseconds: 30000, cumulativeRoundWcifIds: []});
		expect(round('333', 1).cutoff).toEqual({attemptResult: 12000, numberOfAttempts: 2});
	});

	test('advancement comes from the round people advance to', () => {
		expect(round('333', 1).advancementCondition).toEqual({type: 'percent', level: 75});
		expect(round('333', 2).advancementCondition).toEqual({type: 'ranking', level: 8});
		expect(round('333', 3).advancementCondition).toBeUndefined();
		// Dual rounds share one condition; resultAchieved is WCIF v1's attemptResult.
		expect(round('222', 1).advancementCondition).toEqual({type: 'attemptResult', level: 500});
		expect(round('222', 2).advancementCondition).toEqual({type: 'attemptResult', level: 500});
	});

	test('live round ids are self-contained', () => {
		expect(round('333', 1).liveRoundId).toBe(`wcav1:${COMP}:333-r1`);
		expect(v1RoundMap(COMP, rounds)[1]).toEqual({activityCode: '333-r1', liveRoundId: `wcav1:${COMP}:333-r1`});
	});
});

test('v1Competitors keys people by registration id and skips non-registrants', () => {
	expect(v1Competitors(COMP, wcif)).toEqual([
		{wcaId: '2015NICH04', liveId: `wcav1:${COMP}:1421281`, name: 'AJ Nicholls'},
		{wcaId: null, liveId: `wcav1:${COMP}:1421284`, name: 'Newcomer Person'},
	]);
	expect(v1Competitors(COMP, null)).toEqual([]);
});

describe('v1RoundToWcaLiveResults', () => {
	const out = v1RoundToWcaLiveResults(COMP, clockPayload, rounds[0], true);

	test('round header', () => {
		expect(out).toMatchObject({
			roundActivityCode: `wcav1:${COMP}:clock-r1`,
			roundName: 'Final',
			active: false,
			finished: true,
			numberOfAttempts: 5,
			sortBy: 'average',
		});
	});

	test('rows sorted by ranking, attempts by attempt number', () => {
		expect(out.results.map((r: any) => r.personName)).toEqual(['First', 'Second', 'Third', 'Fourth']);
		expect(out.results[0].attempts).toEqual([{result: 500}, {result: 700}, {result: -1}]);
		expect(out.results[0]).toMatchObject({
			ranking: 1,
			personWcaId: '2020FIRS01',
			personCountryIso2: 'TR',
			personLiveId: `wcav1:${COMP}:10`,
			singleRecordTag: 'CR',
			averageRecordTag: 'NR',
			advancing: true,
			advancingQuestionable: false,
		});
		expect(out.results[3].personWcaId).toBeUndefined();
	});

	test('an open round with no state entry is neither active nor finished', () => {
		const r = v1RoundToWcaLiveResults(COMP, clockPayload, undefined, false);
		expect(r).toMatchObject({active: false, finished: false, roundName: 'First round'});
	});
});

test('normalizeRecordTag folds continental records into CR', () => {
	expect(['AfR', 'AsR', 'ER', 'NAR', 'OcR', 'SAR'].map(normalizeRecordTag)).toEqual(Array(6).fill('CR'));
	expect(normalizeRecordTag('WR')).toBe('WR');
	expect(normalizeRecordTag(null)).toBeUndefined();
});

test('v1RecordsFromRounds keeps WR / CR / NR and drops PR', () => {
	const records = v1RecordsFromRounds([clockPayload]);
	expect(records).toEqual([
		expect.objectContaining({type: 'single', tag: 'CR', eventId: 'clock', attemptResult: 500, personName: 'First', personCountryIso2: 'TR', roundNumber: 1}),
		expect.objectContaining({type: 'average', tag: 'NR', eventId: 'clock', attemptResult: 600, personName: 'First'}),
	]);
});

test('v1RoundsWithResults reads only rounds that have results', () => {
	expect(v1RoundsWithResults(rounds).map((r: any) => r.id)).toEqual(['clock-r1', '333-r1', '222-r1', '222-r2']);
});

describe('v1Podiums', () => {
	test('top three of a locked final', () => {
		const podiums = v1Podiums(rounds, [clockPayload]);
		expect(podiums).toHaveLength(1);
		expect(podiums[0]).toMatchObject({eventId: 'clock', sortBy: 'average'});
		expect(podiums[0].entries.map((e: any) => [e.ranking, e.personName])).toEqual([
			[1, 'First'],
			[2, 'Second'],
			[3, 'Third'],
		]);
	});

	test('nothing for an open final or an earlier round', () => {
		const openFinal = rounds.map((r) => (r.id === 'clock-r1' ? {...r, state: 'open'} : r));
		expect(v1Podiums(openFinal, [clockPayload])).toEqual([]);
		expect(v1Podiums(rounds, [{...clockPayload, id: '222-r1'}])).toEqual([]);
	});
});

test('v1RegistrationToCompetitorResults', () => {
	const registration = {
		name: 'Hoomaan Motevalli Habibi',
		wcaId: '2022MOTE01',
		countryIso2: 'IR',
		results: [
			{round_wcif_id: '333-r1', local_pos: 1, global_pos: 1, best: 688, average: 765, average_record_tag: 'PR', advancing: true, advancing_questionable: true, attempts: [{attempt_number: 1, value: 688}]},
			{round_wcif_id: '222-r1', local_pos: 5, global_pos: 5, best: 211, average: 355, attempts: [{attempt_number: 1, value: -1}]},
			{round_wcif_id: 'clock-r1', local_pos: 1, global_pos: 1, best: 500, average: 600, single_record_tag: 'NR', attempts: []},
		],
	};
	const out = v1RegistrationToCompetitorResults(registration, rounds);
	expect(out).toMatchObject({personName: 'Hoomaan Motevalli Habibi', personWcaId: '2022MOTE01', personCountryIso2: 'IR'});
	expect(out.results.map((r: any) => `${r.eventId}-r${r.roundNumber}`)).toEqual(['222-r1', '333-r1', 'clock-r1']);
	expect(out.results[1]).toMatchObject({
		roundName: 'First round',
		ranking: 1,
		averageRecordTag: 'PR',
		advancing: true,
		advancingQuestionable: true,
		format: {numberOfAttempts: 5, sortBy: 'average'},
	});
	expect(out.results[2]).toMatchObject({roundName: 'Final', singleRecordTag: 'NR'});
	expect(v1RegistrationToCompetitorResults(null, rounds)).toBeNull();
});
