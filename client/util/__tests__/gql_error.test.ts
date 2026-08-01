import {getGqlErrorMessage} from '../gql-error';

// i18next returns the key itself when a translation is missing.
const t = ((key: string) => {
	const dict: Record<string, string> = {
		'support_error.ticket_closed': 'Bu talep çözüldü, yazmak için yeniden aç',
		'support.error': 'Bir hata oluştu, tekrar dene.',
	};
	return dict[key] ?? key;
}) as any;

describe('getGqlErrorMessage', () => {
	it('translates the i18nKey the server attached', () => {
		const error = {
			message: 'Çözülmüş talebe yeni mesaj yazılamaz',
			graphQLErrors: [{extensions: {code: 'FORBIDDEN', i18nKey: 'support_error.ticket_closed'}}],
		};

		expect(getGqlErrorMessage(error, t, 'support.error')).toBe('Bu talep çözüldü, yazmak için yeniden aç');
	});

	it('falls back to the server message when the key has no translation', () => {
		const error = {
			message: 'Raw server message',
			graphQLErrors: [{extensions: {code: 'BAD_INPUT', i18nKey: 'support_error.does_not_exist'}}],
		};

		expect(getGqlErrorMessage(error, t, 'support.error')).toBe('Raw server message');
	});

	it('falls back to the server message when no key is attached', () => {
		const error = {message: 'Network request failed', graphQLErrors: []};

		expect(getGqlErrorMessage(error, t, 'support.error')).toBe('Network request failed');
	});

	it('uses the fallback key when the error carries nothing usable', () => {
		expect(getGqlErrorMessage(undefined, t, 'support.error')).toBe('Bir hata oluştu, tekrar dene.');
	});

	it('reads extensions off a plain GraphQL error object', () => {
		const error = {message: 'raw', extensions: {i18nKey: 'support_error.ticket_closed'}};

		expect(getGqlErrorMessage(error, t, 'support.error')).toBe('Bu talep çözüldü, yazmak için yeniden aç');
	});
});
