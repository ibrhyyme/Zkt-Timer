import {
	averageFarBelowRecord,
	cardAverage,
	dnsBeforeValid,
	farBelowRecord,
	formatJudgeAverage,
	cutoffMissed,
	digitsToCentiseconds,
	draftFromText,
	draftValue,
	EMPTY_DRAFT,
	exceedsTimeLimit,
	formatDraft,
	formatJudgeLine,
	formatJudgeValue,
	inconsistentWithCard,
	judgeEntryMode,
	KeypadDraft,
	KeypadKey,
	outcomeLanded,
	parseJudgeApproveToken,
	pressKey,
} from '../zkt_judge';

function type(keys: KeypadKey[], mode: 'time' | 'moves' = 'time'): KeypadDraft {
	return keys.reduce((draft, key) => pressKey(draft, key, mode), EMPTY_DRAFT);
}

const round = {
	eventId: '333',
	attemptCount: 5,
	cutoffCs: 3000,
	cutoffAttempts: 2,
	timeLimitCs: 6000,
	timeLimitCumulative: false,
};

describe('keypad', () => {
	it('reads digits positionally, like the desk', () => {
		expect(digitsToCentiseconds('1224')).toBe(1224);
		expect(digitsToCentiseconds('12345')).toBe(8345);
		expect(digitsToCentiseconds('5')).toBe(5);
		expect(digitsToCentiseconds('')).toBeNull();
		// 75 "seconds" is not a time.
		expect(digitsToCentiseconds('7500')).toBeNull();
	});

	it('builds value = reading + penalty', () => {
		const draft = type(['1', '2', '2', '4', '+2']);
		expect(draftValue(draft)).toEqual({value: 1424, rawValue: 1224, penalty: 200});
		expect(formatDraft(draft)).toBe('12.24');
	});

	it('ignores +2 with nothing typed, and caps it at +16', () => {
		expect(type(['+2'])).toEqual(EMPTY_DRAFT);
		const many = type(['9', '0', '0', '+2', '+2', '+2', '+2', '+2', '+2', '+2', '+2', '+2', '+2']);
		expect(many.penalty).toBe(1600);
	});

	it('delete takes the penalty first, then digits', () => {
		const draft = type(['1', '2', '3', '+2', 'DEL']);
		expect(draft).toEqual({digits: '123', penalty: 0, special: null});
		expect(type(['1', '2', 'DEL']).digits).toBe('1');
		expect(type(['DNF', 'DEL'])).toEqual(EMPTY_DRAFT);
	});

	it('a DNF keeps the time typed with it, before or after; the result is DNF, the time goes as the reading', () => {
		// "Süreli ama DNF" (team, 12 Nov): 12.34 typed, then DNF.
		const after = type(['1', '2', '3', '4', 'DNF']);
		expect(draftValue(after)).toEqual({value: -1, rawValue: 1234, penalty: 0});
		expect(formatDraft(after)).toBe('DNF 12.34');
		// DNF first, then the time.
		expect(draftValue(type(['DNF', '1', '2', '3', '4']))).toEqual({value: -1, rawValue: 1234, penalty: 0});
		// DNF alone is still a DNF, without a time.
		expect(draftValue(type(['DNF']))).toEqual({value: -1, rawValue: null, penalty: 0});
		expect(formatDraft(type(['DNF']))).toBe('DNF');
		// Pressed again: the DNF goes, the time stays.
		expect(type(['1', '2', 'DNF', 'DNF'])).toEqual({digits: '12', penalty: 0, special: null});
		expect(type(['DNF', 'DNF'])).toEqual(EMPTY_DRAFT);
		// A DNF carries no penalty: +2 is dropped and refused.
		expect(type(['1', '2', '+2', 'DNF'])).toEqual({digits: '12', penalty: 0, special: 'DNF'});
		expect(type(['1', '2', 'DNF', '+2']).penalty).toBe(0);
		// Delete takes the time's digits first, then the DNF.
		expect(type(['1', '2', 'DNF', 'DEL'])).toEqual({digits: '1', penalty: 0, special: 'DNF'});
		expect(type(['1', 'DNF', 'DEL', 'DEL'])).toEqual(EMPTY_DRAFT);
	});

	it('DNS replaces what was typed and a digit replaces it; DNF over DNS has no time', () => {
		expect(draftValue(type(['1', '2', 'DNS']))).toEqual({value: -2, rawValue: null, penalty: 0});
		expect(type(['DNS', '7'])).toEqual({digits: '7', penalty: 0, special: null});
		expect(type(['DNS', 'DNF'])).toEqual({digits: '', penalty: 0, special: 'DNF'});
		expect(type(['1', '2', 'DNF', 'DNS'])).toEqual({digits: '', penalty: 0, special: 'DNS'});
	});

	it('FMC has no time beside a DNF', () => {
		expect(draftValue(type(['2', '8', 'DNF'], 'moves'), 'moves')).toEqual({value: -1, rawValue: null, penalty: 0});
		expect(type(['DNF', '2'], 'moves')).toEqual({digits: '2', penalty: 0, special: null});
	});

	it('a sent DNF reads with its time for the staff', () => {
		expect(formatJudgeLine(-1, 1234, '333')).toBe('DNF (12.34)');
		expect(formatJudgeLine(-1, 8345, '333')).toBe('DNF (1:23.45)');
		expect(formatJudgeLine(-1, null, '333')).toBe('DNF');
		expect(formatJudgeLine(-1, undefined, '333')).toBe('DNF');
		expect(formatJudgeLine(1234, 999, '333')).toBe('12.34');
		expect(formatJudgeLine(-2, 1234, '333')).toBe('DNS');
	});

	it('gives no value for an empty draft or one that is not a time', () => {
		expect(draftValue(EMPTY_DRAFT)).toBeNull();
		expect(draftValue(type(['7', '5', '0', '0']))).toBeNull();
		expect(type(['0']).digits).toBe('');
	});

	it('types a move count for FMC', () => {
		expect(judgeEntryMode('333fm')).toBe('moves');
		expect(judgeEntryMode('333mbf')).toBe('unsupported');
		const draft = type(['2', '8', '+2'], 'moves');
		expect(draftValue(draft, 'moves')).toEqual({value: 28, rawValue: null, penalty: 0});
		expect(type(['1', '2', '3', '4'], 'moves').digits).toBe('123');
	});

	it('formats values', () => {
		expect(formatJudgeValue(1224, '333')).toBe('12.24');
		expect(formatJudgeValue(8345, '333')).toBe('1:23.45');
		expect(formatJudgeValue(-1, '333')).toBe('DNF');
		expect(formatJudgeValue(-2, '333')).toBe('DNS');
		expect(formatJudgeValue(null, '333')).toBe('');
		expect(formatJudgeValue(28, '333fm')).toBe('28');
	});
});

describe('phone keyboard', () => {
	const typed = (texts: string[], mode: 'time' | 'moves' = 'time') =>
		texts.reduce((draft, text) => draftFromText(text, draft, mode), EMPTY_DRAFT);

	it('reads the field positionally, however it is punctuated', () => {
		expect(draftValue(typed(['1', '12', '0.122', '1.224']))).toEqual({value: 1224, rawValue: 1224, penalty: 0});
		expect(formatDraft(typed(['12345']))).toBe('1:23.45');
	});

	it('deleting the last character drops the last digit', () => {
		// "12.24" with its last character removed reads "12.2".
		expect(typed(['1224', '12.2']).digits).toBe('122');
		expect(typed(['5', ''])).toEqual(EMPTY_DRAFT);
	});

	it('a lone dot is DNF and a lone comma is DNS; among digits they are punctuation', () => {
		expect(typed(['.']).special).toBe('DNF');
		expect(typed([',']).special).toBe('DNS');
		expect(typed(['12', '12.']).special).toBeNull();
		expect(typed(['12', '12.']).digits).toBe('12');
	});

	it('letters reach DNF and DNS on a keyboard that has them', () => {
		for (const key of ['d', 'D', 'f', '/', '#']) expect(typed([key]).special).toBe('DNF');
		for (const key of ['s', 'S', '*']) expect(typed([key]).special).toBe('DNS');
		// The digits already typed stay as the DNF's time.
		expect(typed(['12', '12d'])).toEqual({digits: '12', penalty: 0, special: 'DNF'});
		expect(typed(['12', '12d'], 'moves')).toEqual({digits: '', penalty: 0, special: 'DNF'});
		expect(typed(['DNS']).special).toBe('DNS');
		expect(typed(['DNF']).special).toBe('DNF');
	});

	it('from DNF: digits type its time, delete takes them back, deleting into the word drops the DNF, S switches to DNS', () => {
		expect(typed(['d', 'DN'])).toEqual(EMPTY_DRAFT);
		expect(typed(['d', 'DNF7'])).toEqual({digits: '7', penalty: 0, special: 'DNF'});
		expect(typed(['d', 'DNF1', 'DNF 0.012', 'DNF 0.1234'])).toEqual({digits: '1234', penalty: 0, special: 'DNF'});
		expect(formatDraft(typed(['d', 'DNF1234']))).toBe('DNF 12.34');
		// Backspace on "DNF 12.34" reads "DNF 12.3".
		expect(typed(['d', 'DNF1234', 'DNF 12.3']).digits).toBe('123');
		// Into the word: the DNF goes, the time stays.
		expect(typed(['d', 'DNF1234', 'DN 12.34'])).toEqual({digits: '1234', penalty: 0, special: null});
		expect(typed(['d', 'DNFs']).special).toBe('DNS');
		expect(typed(['d', 'DNF']).special).toBe('DNF');
		// FMC: a digit after DNF starts a move count, as before.
		expect(typed(['d', 'DNF7'], 'moves')).toEqual({digits: '7', penalty: 0, special: null});
	});

	it('plus adds a penalty and keeps it while digits change', () => {
		const draft = typed(['1224', '12.24+']);
		expect(draft).toEqual({digits: '1224', penalty: 200, special: null});
		expect(draftFromText('1.22', draft).penalty).toBe(200);
		expect(draftFromText('', draft)).toEqual(EMPTY_DRAFT);
		expect(typed(['+'])).toEqual(EMPTY_DRAFT);
	});

	it('caps the digits, and reads moves for FMC', () => {
		expect(typed(['123456789']).digits).toBe('1234567');
		expect(typed(['0']).digits).toBe('');
		expect(draftValue(typed(['28+'], 'moves'), 'moves')).toEqual({value: 28, rawValue: null, penalty: 0});
	});
});

describe('card rules mirrored on the phone', () => {
	it('cutoff is decided only when every cutoff attempt is in', () => {
		expect(cutoffMissed([3500, null, null, null, null], round)).toBe(false);
		expect(cutoffMissed([3500, 3100, null, null, null], round)).toBe(true);
		expect(cutoffMissed([3500, 2999, null, null, null], round)).toBe(false);
		expect(cutoffMissed([-1, -1, null, null, null], round)).toBe(true);
	});

	it('no cutoff when the round has none', () => {
		expect(cutoffMissed([9000, 9000], {...round, cutoffCs: null, cutoffAttempts: null})).toBe(false);
	});

	it('flags a single over a per-attempt limit only', () => {
		expect(exceedsTimeLimit(6000, round)).toBe(true);
		expect(exceedsTimeLimit(5999, round)).toBe(false);
		expect(exceedsTimeLimit(-1, round)).toBe(false);
		expect(exceedsTimeLimit(9000, {...round, timeLimitCumulative: true})).toBe(false);
	});

	it('flags a time far from the rest of the card', () => {
		expect(inconsistentWithCard(123, [1230, 1300, null])).toBe(true);
		expect(inconsistentWithCard(1250, [1230, 1300, -1])).toBe(false);
		expect(inconsistentWithCard(1250, [null, null])).toBe(false);
		expect(inconsistentWithCard(-1, [1230])).toBe(false);
	});

	it('only applied, confirmed and conflict count as sent', () => {
		expect(outcomeLanded('APPLIED')).toBe(true);
		expect(outcomeLanded('CONFIRMED')).toBe(true);
		expect(outcomeLanded('CONFLICT')).toBe(true);
		expect(outcomeLanded('REJECTED_SENT')).toBe(false);
		expect(outcomeLanded('LATE')).toBe(false);
		expect(outcomeLanded(undefined)).toBe(false);
	});
});

describe('parseJudgeApproveToken', () => {
	const token = 'AbC1.x_y-Z09';

	it('reads the token of a production approval address', () => {
		expect(parseJudgeApproveToken(`https://zktimer.app/judge/approve?t=${token}`)).toBe(token);
		expect(parseJudgeApproveToken(`https://zktimer.app/judge/approve/?t=${token}`)).toBe(token);
		expect(parseJudgeApproveToken(`  https://www.zktimer.app/judge/approve?t=${token}\n`)).toBe(token);
	});

	it('accepts the current host when it is passed in', () => {
		expect(parseJudgeApproveToken(`http://localhost:3000/judge/approve?t=${token}`)).toBeNull();
		expect(parseJudgeApproveToken(`http://localhost:3000/judge/approve?t=${token}`, ['localhost:3000'])).toBe(token);
	});

	it('refuses anything that is not an approval address of ours', () => {
		expect(parseJudgeApproveToken(`https://evil.example/judge/approve?t=${token}`)).toBeNull();
		expect(parseJudgeApproveToken(`https://zktimer.app.evil.example/judge/approve?t=${token}`)).toBeNull();
		expect(parseJudgeApproveToken(`https://zktimer.app/timer?t=${token}`)).toBeNull();
		expect(parseJudgeApproveToken('https://zktimer.app/judge/approve')).toBeNull();
		expect(parseJudgeApproveToken('https://zktimer.app/judge/approve?t=<script>')).toBeNull();
		expect(parseJudgeApproveToken(`javascript:alert(1)//zktimer.app/judge/approve?t=${token}`)).toBeNull();
		expect(parseJudgeApproveToken('hello')).toBeNull();
		expect(parseJudgeApproveToken('')).toBeNull();
		expect(parseJudgeApproveToken(`https://zktimer.app/judge/approve?t=${'a'.repeat(1025)}`)).toBeNull();
	});
});


describe('the desk typing checks on the phone (site scoretaking/warnings.ts)', () => {
	test('a time after a DNS is flagged, wherever the DNS sits', () => {
		expect(dnsBeforeValid([1200, -2, 1300, null, null])).toBe(true);
		expect(dnsBeforeValid([-2, -1, null, null, null])).toBe(false);
		expect(dnsBeforeValid([1200, 1300, -2, null, null])).toBe(false);
		expect(dnsBeforeValid([1200, 1300, null, null, null])).toBe(false);
	});

	test('a single below half the ZKT record is flagged; beating the record is not', () => {
		expect(farBelowRecord(123, 900)).toBe(true);
		expect(farBelowRecord(800, 900)).toBe(false);
		expect(farBelowRecord(123, null)).toBe(false);
		expect(farBelowRecord(-1, 900)).toBe(false);
	});

	test('the card average follows the site rule (Mo3, Ao5, Ao12)', () => {
		expect(cardAverage([1000, 1100, 1200, 1300, 1400], 'AO5')).toBe(1200);
		expect(cardAverage([1000, -1, 1200, 1300, 1400], 'AO5')).toBe(1300);
		expect(cardAverage([1000, -1, -2, 1300, 1400], 'AO5')).toBe(-1);
		expect(cardAverage([1000, 1100, null, 1300, 1400], 'AO5')).toBeNull();
		expect(cardAverage([1000, 1100, 1300], 'MO3')).toBe(1133);
		expect(cardAverage([1000, -1, 1300], 'MO3')).toBe(-1);
		expect(cardAverage([1000], 'BO1')).toBeNull();
	});

	test('an average below half the ZKT average record is flagged once the card is complete', () => {
		expect(averageFarBelowRecord([300, 310, 320, 330, 340], 'AO5', 1000)).toBe(true);
		expect(averageFarBelowRecord([300, 310, 320, 330, null], 'AO5', 1000)).toBe(false);
		expect(averageFarBelowRecord([900, 910, 920, 930, 940], 'AO5', 1000)).toBe(false);
	});

	test('the card average follows the site for FMC, MBLD and averages past ten minutes', () => {
		// FMC: the mean of the move counts times 100, the way the record is stored.
		expect(cardAverage([26, 27, 27], 'MO3', '333fm')).toBe(2667);
		expect(cardAverage([26, -1, 27], 'MO3', '333fm')).toBe(-1);
		// An ordinary FMC card against a 25.33 record is not "below half of it".
		expect(averageFarBelowRecord([26, 27, 27], 'MO3', 2533, '333fm')).toBe(false);
		expect(averageFarBelowRecord([10, 11, 12], 'MO3', 2533, '333fm')).toBe(true);
		expect(formatJudgeAverage(2533, '333fm')).toBe('25.33');
		expect(formatJudgeAverage(1234, '333')).toBe('12.34');
		expect(cardAverage([100, 200, 300], 'MO3', '333mbf')).toBeNull();
		// 9f2: 10:00.33 is 10:00, 10:00.67 is 10:01.
		expect(cardAverage([60000, 60000, 60100], 'MO3', '555')).toBe(60000);
		expect(cardAverage([60000, 60100, 60100], 'MO3', '555')).toBe(60100);
	});
});
