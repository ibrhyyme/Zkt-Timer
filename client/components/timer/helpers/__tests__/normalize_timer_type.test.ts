/**
 * What happens to the selected input when the user switches puzzle. The table itself is tested
 * in timer_type_support.test.ts; this runs the hook that acts on it (the timer page and rooms),
 * with the effect run on the spot, so each case reads like the switch the user makes.
 */

let mockTimerType = 'smart';
const mockSetSetting = jest.fn();

jest.mock('react', () => ({
	...jest.requireActual('react'),
	useEffect: (effect: () => void) => {
		effect();
	},
}));
jest.mock('../../../../util/hooks/useSettings', () => ({ useSettings: () => mockTimerType }));
jest.mock('../../../../db/settings/update', () => ({ setSetting: (...args: any[]) => mockSetSetting(...args) }));

import { useNormalizeTimerType } from '../timer_type_support';

beforeEach(() => {
	mockTimerType = 'smart';
	mockSetSetting.mockReset();
});

describe('useNormalizeTimerType with the smart cube selected', () => {
	it('keeps the smart cube when going from 3x3 to 2x2', () => {
		useNormalizeTimerType('222', null);
		useNormalizeTimerType('222', '222eg');
		useNormalizeTimerType('wca', '222');
		expect(mockSetSetting).not.toHaveBeenCalled();
	});

	it('falls back to the keyboard when going from 2x2 to 7x7, as from 3x3', () => {
		useNormalizeTimerType('777', null);
		expect(mockSetSetting).toHaveBeenCalledWith('timer_type', 'keyboard');
	});

	it('does the same for a non-cube puzzle and a big WCA event', () => {
		useNormalizeTimerType('megaminx', null);
		useNormalizeTimerType('wca', '444');
		expect(mockSetSetting).toHaveBeenCalledTimes(2);
	});

	it('lets a room drop the cube before the input changes', () => {
		const disconnect = jest.fn();
		useNormalizeTimerType('555', null, disconnect);
		expect(disconnect).toHaveBeenCalledTimes(1);
		expect(mockSetSetting).toHaveBeenCalledWith('timer_type', 'keyboard');
	});

	it('leaves the keyboard alone whatever the puzzle', () => {
		mockTimerType = 'keyboard';
		useNormalizeTimerType('777', null);
		expect(mockSetSetting).not.toHaveBeenCalled();
	});
});
