jest.mock('../../../db/settings/query', () => ({ getSetting: () => undefined }));
jest.mock('../../../db/settings/update', () => ({ setSetting: jest.fn() }));
jest.mock('../../../util/hooks/useSettings', () => ({ useSettings: () => undefined }));
jest.mock('../../../util/cubes/util', () => ({ getCubeTypeInfoById: () => null }));

import { parseWarmupThresholdInput } from '../useWarmupThreshold';

describe('parseWarmupThresholdInput', () => {
	it('reads seconds as typed', () => {
		expect(parseWarmupThresholdInput('12.99')).toBeCloseTo(12.99);
		expect(parseWarmupThresholdInput(' 13 ')).toBe(13);
		expect(parseWarmupThresholdInput('1:05.20')).toBeCloseTo(65.2);
	});

	it('clears on empty', () => {
		expect(parseWarmupThresholdInput('')).toBeNull();
		expect(parseWarmupThresholdInput('   ')).toBeNull();
	});

	it('refuses what is not a time', () => {
		expect(parseWarmupThresholdInput('abc')).toBeUndefined();
		expect(parseWarmupThresholdInput('DNF')).toBeUndefined();
		expect(parseWarmupThresholdInput('12.99+')).toBeUndefined();
		expect(parseWarmupThresholdInput('0')).toBeUndefined();
	});
});
