import {pickRecordsTab} from '../records_tab';

describe('pickRecordsTab', () => {
	it('opens the ZKT tab for a member who only has ZKT results', () => {
		expect(pickRecordsTab(null, ['zkt'])).toBe('zkt');
		expect(pickRecordsTab(null, ['zkt', 'zkt_results'])).toBe('zkt');
	});

	it('prefers the first available tab in bar order', () => {
		expect(pickRecordsTab(null, ['pb', 'wca', 'zkt'])).toBe('pb');
		expect(pickRecordsTab(null, ['wca', 'results'])).toBe('wca');
		expect(pickRecordsTab(null, ['results'])).toBe('results');
	});

	it('keeps the tab the viewer picked while it exists', () => {
		expect(pickRecordsTab('zkt_results', ['pb', 'zkt', 'zkt_results'])).toBe('zkt_results');
	});

	it('falls back when the picked tab disappears', () => {
		expect(pickRecordsTab('pb', ['zkt'])).toBe('zkt');
	});

	it('returns null when there is nothing to show', () => {
		expect(pickRecordsTab(null, [])).toBeNull();
		expect(pickRecordsTab('wca', [])).toBeNull();
	});
});
