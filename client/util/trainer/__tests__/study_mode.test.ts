/**
 * Study mode rules (trainer-sets 2.3): Smart Cube is Pro; a link or a synced lastMode never
 * opens it for a Basic user, it quietly opens Standard.
 */
import {isStudyMode, parseStudyModeParam, resolveStudyMode, smartModeAllowed} from '../study_mode';

describe('study mode', () => {
	it('knows only standard and smart', () => {
		expect(isStudyMode('standard')).toBe(true);
		expect(isStudyMode('smart')).toBe(true);
		expect(isStudyMode('recognition')).toBe(false);
		expect(isStudyMode(undefined)).toBe(false);
	});

	it('reads ?mode= and ignores anything else', () => {
		expect(parseStudyModeParam('?mode=smart')).toBe('smart');
		expect(parseStudyModeParam('?cat=pll&mode=standard')).toBe('standard');
		expect(parseStudyModeParam('?mode=SMART')).toBeNull();
		expect(parseStudyModeParam('?mode=efficiency')).toBeNull();
		expect(parseStudyModeParam('')).toBeNull();
		expect(parseStudyModeParam(null)).toBeNull();
	});

	it('Smart is allowed when Pro gating is off or the user is Pro', () => {
		expect(smartModeAllowed(false, false)).toBe(true);
		expect(smartModeAllowed(true, true)).toBe(true);
		expect(smartModeAllowed(true, false)).toBe(false);
	});

	it('URL first, then lastMode, then Standard', () => {
		expect(resolveStudyMode('smart', 'standard', true)).toBe('smart');
		expect(resolveStudyMode('standard', 'smart', true)).toBe('standard');
		expect(resolveStudyMode(null, 'smart', true)).toBe('smart');
		expect(resolveStudyMode(undefined, undefined, true)).toBe('standard');
	});

	it('a locked Smart (link or synced lastMode) opens Standard', () => {
		expect(resolveStudyMode('smart', 'standard', false)).toBe('standard');
		expect(resolveStudyMode(null, 'smart', false)).toBe('standard');
	});
});
