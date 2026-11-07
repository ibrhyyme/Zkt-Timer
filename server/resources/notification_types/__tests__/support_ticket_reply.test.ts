import SupportTicketReplyNotification from '../support_ticket_reply';

// Text methods are pure; send() is the only DB path and is never called here.
const stubInput: any = {user: {id: 'u1'}, triggeringUser: {id: 'admin'}, sendEmail: false};

function notif(locale?: string | null) {
	return new SupportTicketReplyNotification(stubInput, 'Bildirimler', 't1', locale);
}

describe('SupportTicketReplyNotification', () => {
	it('writes the reply in the recipient language, not a fixed Turkish text', () => {
		const n = notif('es');
		expect(n.subject()).toBe('Soporte ha respondido a tu solicitud');
		expect(n.inAppMessage()).toContain('"Bildirimler"');
		expect(n.inAppMessage()).not.toContain('talebine');
	});

	it('keeps the Turkish text for Turkish users', () => {
		expect(notif('tr').subject()).toBe('Destek talebine cevap geldi');
		expect(notif('tr').categoryName()).toBe('Destek');
	});

	it('falls back to English for a missing or unknown locale', () => {
		expect(notif(null).subject()).toBe('Support replied to your request');
		expect(notif('de').linkText()).toBe('View support requests');
	});

	it('has every key in all five languages', () => {
		for (const lng of ['tr', 'en', 'es', 'ru', 'zh']) {
			const n = notif(lng);
			for (const text of [n.subject(), n.inAppMessage(), n.message(), n.linkText(), n.categoryName()]) {
				expect(text).not.toContain('notifications.support_ticket_reply');
			}
		}
	});
});
