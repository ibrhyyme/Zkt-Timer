/**
 * battleCubeBrand mirrors the routing table of createCubeForDevice (connect.js). The
 * protocol classes and the BLE layer are mocked, so the real routing function runs here
 * and the two tables cannot drift apart unnoticed.
 */
jest.mock('../../../timer/smart_cube/bluetooth/particula', () => class {});
jest.mock('../../../timer/smart_cube/bluetooth/smart_cube', () => class {});
jest.mock('../../../timer/smart_cube/bluetooth/gan', () => class {});
jest.mock('../../../timer/smart_cube/bluetooth/giiker', () => class {});
jest.mock('../../../timer/smart_cube/bluetooth/moyu', () => class {});
jest.mock('../../../timer/smart_cube/bluetooth/moyu32', () => class {});
jest.mock('../../../timer/smart_cube/bluetooth/qiyi', () => class {});
jest.mock('../../../timer/smart_cube/bluetooth/supported_cubes', () => ({SMART_CUBE_NAME_PREFIXES: []}));
jest.mock('../../../../util/ble', () => ({getBleAdapter: () => null}));
jest.mock('../../../../util/platform', () => ({isNative: () => false}));
jest.mock('../../../timer/helpers/params', () => ({setTimerParams: () => undefined}));
jest.mock('../../../../util/smart_cube/telemetry', () => ({
	setTelemetryDevice: () => undefined,
	recordConnectionEvent: () => undefined,
}));

import {createCubeForDevice} from '../../../timer/smart_cube/bluetooth/connect';
import {battleCubeBrand, battleCubeInfo, BattleCubeBrand} from '../cube_info';

const CUBE_TYPE_TO_BRAND: Record<string, BattleCubeBrand> = {
	Giiker: 'giiker',
	GAN: 'gan',
	Particula: 'particula',
	'MoYu MHC': 'moyu',
	'MoYu WeiLong AI': 'moyu32',
	QiYi: 'qiyi',
	unknown: 'unknown',
};

const NAMES = [
	'GANicXS_1234',
	'GAN12uiFM',
	'gan356i',
	'MG3-AB12',
	'AiCube_01',
	'Gi123',
	'GiC2',
	'Mi Smart Magic Cube',
	'Hi-Smart',
	'GoCube_X',
	'Rubiks_Connected',
	'MHC-0001',
	'WCU_MY32_ABCD',
	'^S1234',
	'QY-QYSC-S-1234',
	'XMD-TornadoV4-i-55',
	'SomeOtherCube',
	'',
];

describe('battleCubeBrand', () => {
	it.each(NAMES)('agrees with createCubeForDevice for %p', (name) => {
		const {cubeType} = createCubeForDevice({name}, null);
		expect(battleCubeBrand(name)).toBe(CUBE_TYPE_TO_BRAND[cubeType]);
	});

	it('handles a missing name', () => {
		expect(battleCubeBrand(null)).toBe('unknown');
		expect(battleCubeBrand(undefined)).toBe('unknown');
	});
});

describe('battleCubeInfo', () => {
	it('only cubes with their own clock can queue (design 4.3, Q2)', () => {
		expect(battleCubeInfo('GAN12uiFM')).toEqual({brand: 'gan', hasClock: true});
		expect(battleCubeInfo('QY-QYSC-S-1234')).toEqual({brand: 'qiyi', hasClock: true});
		expect(battleCubeInfo('WCU_MY32_ABCD')).toEqual({brand: 'moyu32', hasClock: true});
		expect(battleCubeInfo('Gi123').hasClock).toBe(false);
		expect(battleCubeInfo('GoCube_X').hasClock).toBe(false);
		expect(battleCubeInfo('MHC-0001').hasClock).toBe(false);
		expect(battleCubeInfo('SomeOtherCube').hasClock).toBe(false);
	});
});
