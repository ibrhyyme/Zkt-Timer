import {classifyFetchError, retryDelayMs} from '../fetch-error';

const gql = (code: string, message = 'msg') => ({graphQLErrors: [{message, extensions: {code}}]});

describe('classifyFetchError', () => {
	it('treats a signed-out viewer as auth, never as a retryable failure', () => {
		expect(classifyFetchError(gql('FORBIDDEN'))).toMatchObject({kind: 'auth', retryable: false});
		expect(classifyFetchError(gql('UNAUTHENTICATED'))).toMatchObject({kind: 'auth', retryable: false});
	});

	it('maps the server rate limit to a translated, retryable message without the raw server text', () => {
		expect(classifyFetchError(gql('RATE_LIMITED', 'Çok fazla istek.'))).toEqual({
			kind: 'rate_limited',
			messageKey: 'my_schedule.rate_limited',
			detail: null,
			retryable: true,
		});
	});

	it('maps a federation outage to a translated, retryable message', () => {
		expect(classifyFetchError(gql('UPSTREAM_UNAVAILABLE'))).toMatchObject({
			kind: 'upstream',
			messageKey: 'my_schedule.zkt_unavailable',
			detail: null,
			retryable: true,
		});
	});

	it('reads errors delivered inside a network error body too', () => {
		const e = {networkError: {result: {errors: [{message: 'x', extensions: {code: 'RATE_LIMITED'}}]}}};
		expect(classifyFetchError(e).kind).toBe('rate_limited');
	});

	it('retries a request that never got an answer', () => {
		expect(classifyFetchError({networkError: new Error('Failed to fetch')})).toMatchObject({
			kind: 'network',
			detail: null,
			retryable: true,
		});
	});

	it('keeps the server sentence only for faults it cannot explain better', () => {
		expect(classifyFetchError(gql('INTERNAL_SERVER_ERROR', 'Sunucu hatası oluştu. Hata kodu: abc'))).toMatchObject({
			kind: 'other',
			messageKey: 'my_schedule.fetch_error',
			detail: 'Sunucu hatası oluştu. Hata kodu: abc',
		});
	});
});

describe('retryDelayMs', () => {
	it('backs off 5s, 10s, 20s and then holds at 30s', () => {
		expect([0, 1, 2, 3, 4, 10].map(retryDelayMs)).toEqual([5000, 10000, 20000, 30000, 30000, 30000]);
	});
});
