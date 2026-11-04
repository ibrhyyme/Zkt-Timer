import { buildIndexNowPayload, INDEXNOW_KEY, INDEXNOW_KEY_PATH } from '../indexnow_key';

describe('buildIndexNowPayload', () => {
	it('builds the body IndexNow expects, with the key served at the site root', () => {
		const payload = buildIndexNowPayload('https://zktimer.app', [
			'https://zktimer.app/timer',
			'https://zktimer.app/timer?lang=tr',
		]);
		expect(payload).toEqual({
			host: 'zktimer.app',
			key: INDEXNOW_KEY,
			keyLocation: `https://zktimer.app${INDEXNOW_KEY_PATH}`,
			urlList: ['https://zktimer.app/timer', 'https://zktimer.app/timer?lang=tr'],
		});
	});

	it('keeps the key a 32 character hex string', () => {
		// IndexNow accepts 8 to 128 characters of a-z, A-Z, 0-9 and dashes.
		expect(INDEXNOW_KEY).toMatch(/^[0-9a-f]{32}$/);
	});

	it('drops other hosts and duplicates, since one foreign URL fails the whole batch', () => {
		const payload = buildIndexNowPayload('https://zktimer.app', [
			'https://zktimer.app/trainer',
			'https://zktimer.app/trainer',
			'https://zekakuputurkiye.com/',
			'not a url',
		]);
		expect(payload?.urlList).toEqual(['https://zktimer.app/trainer']);
	});

	it('sends nothing without a base URI or URLs', () => {
		expect(buildIndexNowPayload(undefined, ['https://zktimer.app/timer'])).toBeNull();
		expect(buildIndexNowPayload('https://zktimer.app', [])).toBeNull();
	});
});
