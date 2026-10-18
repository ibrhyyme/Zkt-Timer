import {algSetHiddenSource, parseAlgSetReportReason} from '../alg_set_report';
import {ALG_SET_MODERATION, ALG_SET_REPORT_REASONS} from '../../../../../../shared/trainer/alg_sets';

describe('parseAlgSetReportReason', () => {
	it('returns null for a profile report', () => {
		expect(parseAlgSetReportReason('Rude username')).toBeNull();
		expect(parseAlgSetReportReason('')).toBeNull();
		expect(parseAlgSetReportReason(null)).toBeNull();
		expect(parseAlgSetReportReason(undefined)).toBeNull();
	});

	it('reads every known reason without a note', () => {
		for (const reason of ALG_SET_REPORT_REASONS) {
			expect(parseAlgSetReportReason(`${ALG_SET_MODERATION.REPORT_REASON_PREFIX}${reason}`)).toEqual({
				reason,
				rawReason: reason,
				note: '',
			});
		}
	});

	it('splits the note at the first colon and keeps colons inside the note', () => {
		expect(parseAlgSetReportReason('alg_set:other: see 1:30 in the video')).toEqual({
			reason: 'other',
			rawReason: 'other',
			note: 'see 1:30 in the video',
		});
	});

	it('keeps an unknown reason raw', () => {
		expect(parseAlgSetReportReason('alg_set:weird: x')).toEqual({reason: null, rawReason: 'weird', note: 'x'});
	});

	it('writes the same format the resolver writes', () => {
		const stored = `${ALG_SET_MODERATION.REPORT_REASON_PREFIX}wrong_algorithm${': ' + 'R U R'}`;
		expect(parseAlgSetReportReason(stored)).toEqual({
			reason: 'wrong_algorithm',
			rawReason: 'wrong_algorithm',
			note: 'R U R',
		});
	});
});

describe('algSetHiddenSource', () => {
	it('maps the stored hidden_reason', () => {
		expect(algSetHiddenSource(ALG_SET_MODERATION.AUTO_HIDE_REASON)).toBe('auto');
		expect(algSetHiddenSource('admin')).toBe('admin');
		expect(algSetHiddenSource(null)).toBe('admin');
		expect(algSetHiddenSource('spam wave')).toBe('other');
	});
});
