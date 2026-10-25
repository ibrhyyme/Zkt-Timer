/**
 * The timer's session pick is temporary and never touches the main session (`session_id`),
 * which only the Sessions page changes.
 */

let mainSessionId = 'main';
const existing = new Set(['main', 'smart', 'oh']);

jest.mock('../../settings/query', () => ({
	getSetting: (key: string) => (key === 'session_id' ? mainSessionId : null),
}));
jest.mock('../query', () => ({
	fetchSessionById: (id: string) => (existing.has(id) ? {id} : null),
}));

import {
	clearTimerSession,
	getActiveSessionId,
	resolveActiveSessionId,
	setTimerSession,
	subscribeTimerSession,
} from '../active';

beforeEach(() => {
	mainSessionId = 'main';
	existing.clear();
	['main', 'smart', 'oh'].forEach((id) => existing.add(id));
	clearTimerSession();
});

describe('timer session', () => {
	it('is the main session until the timer picks another', () => {
		expect(getActiveSessionId()).toBe('main');
	});

	it('follows the timer pick without changing the main session', () => {
		setTimerSession('smart');
		expect(getActiveSessionId()).toBe('smart');
		expect(mainSessionId).toBe('main');
	});

	it('ends the temporary pick when the main session is picked in the timer', () => {
		setTimerSession('smart');
		setTimerSession('main');
		mainSessionId = 'oh';
		// Nothing temporary is left, so the timer follows the main session wherever it goes.
		expect(getActiveSessionId()).toBe('oh');
	});

	it('goes back to the main session once the picked one is deleted', () => {
		setTimerSession('smart');
		existing.delete('smart');
		expect(getActiveSessionId()).toBe('main');
	});

	it('gives way to a main session set on purpose', () => {
		setTimerSession('smart');
		clearTimerSession();
		expect(getActiveSessionId()).toBe('main');
	});

	it('resolves against whatever main session the caller passes in', () => {
		setTimerSession('smart');
		expect(resolveActiveSessionId('oh')).toBe('smart');
		expect(resolveActiveSessionId('smart')).toBe('smart');
	});

	it('tells subscribers about a change, and only about a change', () => {
		const listener = jest.fn();
		const unsubscribe = subscribeTimerSession(listener);
		setTimerSession('smart');
		setTimerSession('smart');
		clearTimerSession();
		unsubscribe();
		setTimerSession('oh');
		expect(listener).toHaveBeenCalledTimes(2);
	});
});
