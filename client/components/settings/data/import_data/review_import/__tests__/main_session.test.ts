import {largestImportedSession, suggestMainByDefault} from '../main_session';

const sessions = [
	{id: 'a', name: '2x2'},
	{id: 'b', name: '3x3x3'},
	{id: 'c', name: 'Empty'},
];
const solves = [{session_id: 'a'}, {session_id: 'b'}, {session_id: 'b'}, {session_id: 'b'}, {session_id: 'x'}];

describe('import main session suggestion', () => {
	it('picks the imported session with the most solves', () => {
		expect(largestImportedSession(sessions, solves)).toEqual({id: 'b', name: '3x3x3', solveCount: 3});
	});

	it('keeps the first session on a tie and offers nothing without solves', () => {
		expect(largestImportedSession(sessions, [{session_id: 'a'}, {session_id: 'b'}])?.id).toBe('a');
		expect(largestImportedSession(sessions, [])).toBeNull();
		expect(largestImportedSession([{id: 'c', name: 'Empty'}], solves)).toBeNull();
	});

	it('ticks the box only when the import beats the current main session', () => {
		const suggestion = {id: 'b', name: '3x3x3', solveCount: 43333};
		expect(suggestMainByDefault(suggestion, 26)).toBe(true);
		expect(suggestMainByDefault(suggestion, 50000)).toBe(false);
		expect(suggestMainByDefault(null, 0)).toBe(false);
	});
});
