// Giiker and GoCube / Rubik's Connected against real cube traffic, recorded by
// smartcube-web-bluetooth (Pau Oliva, MIT) with the moves that library decoded.

jest.mock('../../../helpers/params', () => ({ setTimerParams: () => {} }));

import GiikerUtil from '../giiker_util';
import Particula, { goCubeChecksumValid, parseGoCubeOrientation } from '../particula';
import fixtures from './fixtures/uart_captures.json';

interface Capture {
	name: string;
	protocol: string;
	notifies: string[];
	notifyChars: string[];
	expectedMoves: string[];
	expectedLastFacelets: string | null;
	expectedGyroCount: number;
	expectedFirstGyro: { x: number; y: number; z: number; w: number } | null;
}

const CAPTURES = (fixtures as { captures: Capture[] }).captures;

function dataView(hex: string): DataView {
	const bytes = new Uint8Array(hex.length / 2);
	for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
	return new DataView(bytes.buffer);
}

describe('Giiker — real capture', () => {
	const capture = CAPTURES.find((c) => c.protocol === 'giiker')!;
	const stateNotifies = capture.notifies.filter((_, i) => capture.notifyChars[i].startsWith('0000aadc'));

	async function replay() {
		const util: any = new GiikerUtil({ name: capture.name, deviceId: 'test' }, {});
		const moves: string[] = [];
		let last: string | null = null;
		util.on('move', ({ move, facelets }: { move: string; facelets: string }) => {
			if (move) moves.push(move);
			last = facelets;
		});
		// connect() reads the cube's state before any notification is handled; the first
		// packet plays that part here, as it is the state the reference started from.
		util._state = (await util._parseCubeValue(dataView(stateNotifies[0]))).state;
		for (const hex of stateNotifies) await util._onCharacteristicValueChanged(dataView(hex));
		return { moves, last };
	}

	it('decodes the same moves as the reference', async () => {
		const { moves } = await replay();
		expect(moves).toEqual(capture.expectedMoves);
	});

	it('ends on the same cube state as the reference', async () => {
		const { last } = await replay();
		expect(last).toBe(capture.expectedLastFacelets);
	});

	it('reports no turn for a packet that repeats the state already held', async () => {
		const util: any = new GiikerUtil({ name: capture.name, deviceId: 'test' }, {});
		const moves: string[] = [];
		util.on('move', ({ move }: { move: string }) => move && moves.push(move));
		await util._onCharacteristicValueChanged(dataView(stateNotifies[1]));
		await util._onCharacteristicValueChanged(dataView(stateNotifies[1]));
		expect(moves).toHaveLength(1);
	});
});

describe('GoCube / Rubik\'s Connected — real captures', () => {
	for (const capture of CAPTURES.filter((c) => c.protocol === 'gocube')) {
		describe(capture.name, () => {
			function replay() {
				const cube: any = new Particula({ name: capture.name, deviceId: 'test' }, { writeCharacteristic: async () => {} });
				const moves: string[] = [];
				const facelets: string[] = [];
				const gyro: any[] = [];
				cube._sink = {
					handleMove: (move: string) => moves.push(move.trim()),
					handleFacelets: (state: string) => facelets.push(state),
					handleBattery: () => {},
					handleGyroSupported: () => {},
				};
				cube.subscribeGyro?.((e: any) => gyro.push(e));
				for (const hex of capture.notifies) cube.parseData(dataView(hex));
				return { moves, facelets, gyro };
			}

			it('decodes the same moves as the reference', () => {
				expect(replay().moves).toEqual(capture.expectedMoves);
			});

			it('ends on the same cube state as the reference', () => {
				const { facelets } = replay();
				expect(facelets[facelets.length - 1]).toBe(capture.expectedLastFacelets);
			});

			// The reference's recorder subscribed after its connect() returned, so orientation
			// packets that arrived during start-up are missing from its list: compare the tail.
			it('streams orientation only from the classic GoCube, the way the reference does', () => {
				const { gyro } = replay();
				const offset = gyro.length - capture.expectedGyroCount;
				expect(offset).toBeGreaterThanOrEqual(0);
				expect(offset).toBeLessThanOrEqual(4);
				if (capture.expectedFirstGyro) {
					for (const k of ['x', 'y', 'z', 'w'] as const) {
						expect(gyro[offset].quaternion[k]).toBeCloseTo(capture.expectedFirstGyro[k], 6);
					}
				}
			});

			it('accepts the checksum of every full frame the cube sent', () => {
				const full = capture.notifies.map(dataView).filter((v) => v.byteLength >= 7);
				expect(full.filter((v) => !goCubeChecksumValid(v))).toHaveLength(0);
			});
		});
	}

	it('parses an orientation payload into a unit quaternion', () => {
		const q = parseGoCubeOrientation('0#0#0#100')!;
		expect(q.w).toBeCloseTo(1, 6);
		expect(parseGoCubeOrientation('1#2#3')).toBeNull();
	});
});
