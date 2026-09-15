import account from '../account';
import general from '../general';
import reducers from '../reducers';

const UNRELATED = {type: 'SOMETHING_ELSE_ENTIRELY'};

function modal(createdAt: number) {
	return {createdAt, body: null, options: {}};
}

describe('account reducer', () => {
	it('returns the same reference for an unrelated action', () => {
		const state = {me: {id: 'u1'}};

		expect(account(state, UNRELATED)).toBe(state);
	});

	it('returns a new slice on SET_ME', () => {
		const state = {me: null};
		const me = {id: 'u1'};

		const next = account(state, {type: 'SET_ME', payload: {me}});

		expect(next).not.toBe(state);
		expect(next.me).toBe(me);
	});
});

describe('general reducer modals', () => {
	const base = {
		app_loaded: true,
		browser_session_id: 's',
		mobile_mode: false,
		force_nav_collapsed: false,
	};

	it('OPEN_MODAL appends into a new array and leaves the old state alone', () => {
		const first = modal(1);
		const state = {...base, modals: [first]};

		const next = general(state, {type: 'OPEN_MODAL', payload: modal(2)});

		expect(next.modals).not.toBe(state.modals);
		expect(next.modals.map((m) => m.createdAt)).toEqual([1, 2]);
		expect(state.modals).toEqual([first]);
	});

	it('CLOSE_MODAL drops the top modal into a new array and leaves the old state alone', () => {
		const state = {...base, modals: [modal(1), modal(2)]};

		const next = general(state, {type: 'CLOSE_MODAL'});

		expect(next.modals).not.toBe(state.modals);
		expect(next.modals.map((m) => m.createdAt)).toEqual([1]);
		expect(state.modals.map((m) => m.createdAt)).toEqual([1, 2]);
	});

	it('CLOSE_MODAL with nothing open returns the same state', () => {
		const state = {...base, modals: []};

		expect(general(state, {type: 'CLOSE_MODAL'})).toBe(state);
	});

	it('returns the same reference for an unrelated action', () => {
		const state = {...base, modals: [modal(1)]};

		expect(general(state, UNRELATED)).toBe(state);
	});
});

describe('root reducer', () => {
	it('keeps the whole store state for an action no slice handles', () => {
		const state = reducers(undefined, {type: '@@INIT'});

		expect(reducers(state, UNRELATED)).toBe(state);
	});

	it('changes only the slice an action is meant for', () => {
		const state: any = reducers(undefined, {type: '@@INIT'});

		const next: any = reducers(state, {type: 'SET_TIMER_PARAM', payload: {params: {solving: true}}});

		expect(next).not.toBe(state);
		expect(next.timer).not.toBe(state.timer);
		expect(next.account).toBe(state.account);
		expect(next.general).toBe(state.general);
		expect(next.stats).toBe(state.stats);
	});
});
